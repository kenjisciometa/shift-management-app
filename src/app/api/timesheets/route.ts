import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";
import type { Database } from "@/types/database.types";

type TimesheetInsert = Database["public"]["Tables"]["timesheets"]["Insert"];

/**
 * GET /api/timesheets
 * List timesheets for the current user or all timesheets (admin only)
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
    const periodStart = searchParams.get("period_start");
    const periodEnd = searchParams.get("period_end");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const isAdmin = isPrivilegedUser(profile.role);
    const targetUserId = userId || (isAdmin ? null : user.id);

    let query = supabase
      .from("timesheets")
      .select(`
        *,
        profiles!timesheets_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .eq("organization_id", profile.organization_id)
      .order("period_start", { ascending: false })
      .range(offset, offset + limit - 1);

    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (periodStart) {
      query = query.gte("period_start", periodStart);
    }

    if (periodEnd) {
      query = query.lte("period_end", periodEnd);
    }

    const { data: timesheets, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching timesheets:", fetchError);
      return NextResponse.json({ error: "Failed to fetch timesheets" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: timesheets || [] });
  } catch (error) {
    console.error("Error in GET /api/timesheets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/timesheets
 * Create a new timesheet
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user, profile, supabase } = await authenticateAndAuthorize(request);
    if (error || !user || !profile || !supabase) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const { period_start, period_end, user_id } = body;

    // Validate required fields
    if (!period_start || !period_end) {
      return NextResponse.json(
        { error: "Missing required fields: period_start, period_end" },
        { status: 400 }
      );
    }

    const targetUserId = user_id || user.id;

    // Only allow creating timesheets for yourself unless admin
    const isAdmin = isPrivilegedUser(profile.role);
    if (targetUserId !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if timesheet already exists for this period
    const { data: existing } = await supabase
      .from("timesheets")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("organization_id", profile.organization_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Timesheet already exists for this period" },
        { status: 409 }
      );
    }

    // Create the timesheet (will be calculated later or manually entered)
    const timesheetData: TimesheetInsert = {
      organization_id: profile.organization_id,
      user_id: targetUserId,
      period_start,
      period_end,
      status: "draft",
      total_hours: null,
      break_hours: null,
      overtime_hours: null,
    };

    const { data: newTimesheet, error: createError } = await supabase
      .from("timesheets")
      .insert(timesheetData)
      .select(`
        *,
        profiles!timesheets_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .single();

    if (createError) {
      console.error("Error creating timesheet:", createError);
      return NextResponse.json({ error: "Failed to create timesheet" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: newTimesheet }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/timesheets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
