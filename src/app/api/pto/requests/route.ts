import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";
import type { Database } from "@/types/database.types";

type PTORequestInsert = Database["public"]["Tables"]["pto_requests"]["Insert"];

/**
 * GET /api/pto/requests
 * List PTO requests for the current user or all requests (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { error, user, profile, supabase } = await authenticateAndAuthorize(request);
    if (error || !user || !profile || !supabase) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const isAdmin = isPrivilegedUser(profile.role);
    const targetUserId = userId || (isAdmin ? null : user.id);

    let query = supabase
      .from("pto_requests")
      .select(`
        *,
        profiles!pto_requests_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: requests, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching PTO requests:", fetchError);
      return NextResponse.json({ error: "Failed to fetch PTO requests" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: requests || [] });
  } catch (error) {
    console.error("Error in GET /api/pto/requests:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/pto/requests
 * Create a new PTO request
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user, profile, supabase } = await authenticateAndAuthorize(request);
    if (error || !user || !profile || !supabase) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const { start_date, end_date, pto_type, reason, attachment_urls } = body;

    // Validate required fields
    if (!start_date || !end_date || !pto_type) {
      return NextResponse.json(
        { error: "Missing required fields: start_date, end_date, pto_type" },
        { status: 400 }
      );
    }

    // Calculate total days
    const start = new Date(start_date);
    const end = new Date(end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days

    // Check for date conflicts with existing approved/pending requests
    const { data: conflictingRequests } = await supabase
      .from("pto_requests")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "approved"])
      .or(`start_date.lte.${end_date},end_date.gte.${start_date}`);

    if (conflictingRequests && conflictingRequests.length > 0) {
      return NextResponse.json(
        { error: "Date range conflicts with existing PTO request" },
        { status: 400 }
      );
    }

    // Check PTO balance
    const currentYear = new Date().getFullYear();
    const { data: balance } = await supabase
      .from("pto_balances")
      .select("*")
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id)
      .eq("pto_type", pto_type)
      .eq("year", currentYear)
      .single();

    if (balance) {
      const availableDays = (balance.entitled_days || 0) - (balance.used_days || 0) - (balance.pending_days || 0);
      if (diffDays > availableDays) {
        return NextResponse.json(
          { error: `Insufficient PTO balance. Available: ${availableDays} days, Requested: ${diffDays} days` },
          { status: 400 }
        );
      }
    }

    // Create the request
    const requestData: PTORequestInsert = {
      organization_id: profile.organization_id,
      user_id: user.id,
      start_date,
      end_date,
      pto_type,
      total_days: diffDays,
      reason: reason || null,
      attachment_urls: attachment_urls || null,
      status: "pending",
    };

    const { data: newRequest, error: createError } = await supabase
      .from("pto_requests")
      .insert(requestData)
      .select(`
        *,
        profiles!pto_requests_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .single();

    if (createError) {
      console.error("Error creating PTO request:", createError);
      return NextResponse.json({ error: "Failed to create PTO request" }, { status: 500 });
    }

    // Update pending days in balance
    if (balance) {
      await supabase
        .from("pto_balances")
        .update({ pending_days: (balance.pending_days || 0) + diffDays })
        .eq("id", balance.id);
    }

    return NextResponse.json({ success: true, data: newRequest }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/pto/requests:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
