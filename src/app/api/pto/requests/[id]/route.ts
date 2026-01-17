import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";
import type { Database } from "@/types/database.types";

type PTORequestUpdate = Database["public"]["Tables"]["pto_requests"]["Update"];

/**
 * GET /api/pto/requests/[id]
 * Get a specific PTO request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user, profile, supabase } = await authenticateAndAuthorize(request);
    if (error || !user || !profile || !supabase) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: ptoRequest, error: fetchError } = await supabase
      .from("pto_requests")
      .select(`
        *,
        user:profiles!pto_requests_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
        reviewer:profiles!pto_requests_reviewed_by_fkey (id, first_name, last_name, display_name)
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json({ error: "PTO request not found" }, { status: 404 });
      }
      console.error("Error fetching PTO request:", fetchError);
      return NextResponse.json({ error: "Failed to fetch PTO request" }, { status: 500 });
    }

    // Check if user has access (owner or admin)
    const isAdmin = isPrivilegedUser(profile.role);
    if (ptoRequest.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: ptoRequest });
  } catch (error) {
    console.error("Error in GET /api/pto/requests/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/pto/requests/[id]
 * Update a PTO request (only if pending and user is owner)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user, profile, supabase } = await authenticateAndAuthorize(request);
    if (error || !user || !profile || !supabase) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Get the existing request
    const { data: existingRequest, error: fetchError } = await supabase
      .from("pto_requests")
      .select("*")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json({ error: "PTO request not found" }, { status: 404 });
    }

    // Only allow updates if pending and user is the owner
    if (existingRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Can only update pending requests" },
        { status: 400 }
      );
    }

    if (existingRequest.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Calculate new total days if dates changed
    let totalDays = existingRequest.total_days;
    if (body.start_date || body.end_date) {
      const start = new Date(body.start_date || existingRequest.start_date);
      const end = new Date(body.end_date || existingRequest.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // Update the request
    const updateData: PTORequestUpdate = {
      start_date: body.start_date || undefined,
      end_date: body.end_date || undefined,
      pto_type: body.pto_type || undefined,
      total_days: totalDays,
      reason: body.reason !== undefined ? body.reason : undefined,
      attachment_urls: body.attachment_urls !== undefined ? body.attachment_urls : undefined,
    };

    const { data: updatedRequest, error: updateError } = await supabase
      .from("pto_requests")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        profiles!pto_requests_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .single();

    if (updateError) {
      console.error("Error updating PTO request:", updateError);
      return NextResponse.json({ error: "Failed to update PTO request" }, { status: 500 });
    }

    // Update pending days in balance if total days changed
    if (totalDays !== existingRequest.total_days) {
      const currentYear = new Date().getFullYear();
      const { data: balance } = await supabase
        .from("pto_balances")
        .select("*")
        .eq("user_id", user.id)
        .eq("organization_id", profile.organization_id)
        .eq("pto_type", updatedRequest.pto_type)
        .eq("year", currentYear)
        .single();

      if (balance) {
        const daysDiff = totalDays - existingRequest.total_days;
        await supabase
          .from("pto_balances")
          .update({ pending_days: (balance.pending_days || 0) + daysDiff })
          .eq("id", balance.id);
      }
    }

    return NextResponse.json({ success: true, data: updatedRequest });
  } catch (error) {
    console.error("Error in PUT /api/pto/requests/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/pto/requests/[id]
 * Delete a PTO request (only if pending and user is owner)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user, profile, supabase } = await authenticateAndAuthorize(request);
    if (error || !user || !profile || !supabase) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the existing request
    const { data: existingRequest, error: fetchError } = await supabase
      .from("pto_requests")
      .select("*")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json({ error: "PTO request not found" }, { status: 404 });
    }

    // Only allow deletion if pending and user is the owner
    if (existingRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Can only delete pending requests" },
        { status: 400 }
      );
    }

    if (existingRequest.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete the request
    const { error: deleteError } = await supabase.from("pto_requests").delete().eq("id", id);

    if (deleteError) {
      console.error("Error deleting PTO request:", deleteError);
      return NextResponse.json({ error: "Failed to delete PTO request" }, { status: 500 });
    }

    // Update pending days in balance
    const currentYear = new Date().getFullYear();
    const { data: balance } = await supabase
      .from("pto_balances")
      .select("*")
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id)
      .eq("pto_type", existingRequest.pto_type)
      .eq("year", currentYear)
      .single();

    if (balance) {
      await supabase
        .from("pto_balances")
        .update({ pending_days: Math.max(0, (balance.pending_days || 0) - existingRequest.total_days) })
        .eq("id", balance.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/pto/requests/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
