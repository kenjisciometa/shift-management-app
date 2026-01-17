import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";
import type { Database } from "@/types/database.types";

type TimesheetUpdate = Database["public"]["Tables"]["timesheets"]["Update"];

/**
 * GET /api/timesheets/[id]
 * Get a specific timesheet
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

    const { data: timesheet, error: fetchError } = await supabase
      .from("timesheets")
      .select(`
        *,
        profiles!timesheets_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
      }
      console.error("Error fetching timesheet:", fetchError);
      return NextResponse.json({ error: "Failed to fetch timesheet" }, { status: 500 });
    }

    // Check if user has access (owner or admin)
    const isAdmin = isPrivilegedUser(profile.role);
    if (timesheet.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: timesheet });
  } catch (error) {
    console.error("Error in GET /api/timesheets/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/timesheets/[id]
 * Update a timesheet (only if draft and user is owner)
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

    // Get the existing timesheet
    const { data: existingTimesheet, error: fetchError } = await supabase
      .from("timesheets")
      .select("*")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError || !existingTimesheet) {
      return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
    }

    // Only allow updates if draft and user is the owner
    if (existingTimesheet.status !== "draft") {
      return NextResponse.json(
        { error: "Can only update draft timesheets" },
        { status: 400 }
      );
    }

    if (existingTimesheet.user_id !== user.id) {
      const isAdmin = isPrivilegedUser(profile.role);
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Update the timesheet
    const updateData: TimesheetUpdate = {
      period_start: body.period_start || undefined,
      period_end: body.period_end || undefined,
      total_hours: body.total_hours !== undefined ? body.total_hours : undefined,
      break_hours: body.break_hours !== undefined ? body.break_hours : undefined,
      overtime_hours: body.overtime_hours !== undefined ? body.overtime_hours : undefined,
    };

    const { data: updatedTimesheet, error: updateError } = await supabase
      .from("timesheets")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        profiles!timesheets_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .single();

    if (updateError) {
      console.error("Error updating timesheet:", updateError);
      return NextResponse.json({ error: "Failed to update timesheet" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updatedTimesheet });
  } catch (error) {
    console.error("Error in PUT /api/timesheets/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/timesheets/[id]
 * Delete a timesheet (only if draft and user is owner)
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

    // Get the existing timesheet
    const { data: existingTimesheet, error: fetchError } = await supabase
      .from("timesheets")
      .select("*")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError || !existingTimesheet) {
      return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
    }

    // Only allow deletion if draft and user is the owner
    if (existingTimesheet.status !== "draft") {
      return NextResponse.json(
        { error: "Can only delete draft timesheets" },
        { status: 400 }
      );
    }

    if (existingTimesheet.user_id !== user.id) {
      const isAdmin = isPrivilegedUser(profile.role);
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Delete the timesheet
    const { error: deleteError } = await supabase.from("timesheets").delete().eq("id", id);

    if (deleteError) {
      console.error("Error deleting timesheet:", deleteError);
      return NextResponse.json({ error: "Failed to delete timesheet" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/timesheets/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
