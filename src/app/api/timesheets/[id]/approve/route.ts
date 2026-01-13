import { NextResponse } from "next/server";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

/**
 * PUT /api/timesheets/[id]/approve
 * Approve a timesheet (admin/manager only)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, profile } = authData;
    const { id } = await params;
    const body = await request.json();
    const reviewComment = body.review_comment || null;

    // Check if user is admin or manager
    const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await getCachedSupabase();

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

    if (existingTimesheet.status !== "submitted") {
      return NextResponse.json(
        { error: "Can only approve submitted timesheets" },
        { status: 400 }
      );
    }

    // Update the timesheet status
    const { data: updatedTimesheet, error: updateError } = await supabase
      .from("timesheets")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_comment: reviewComment,
      })
      .eq("id", id)
      .select(`
        *,
        profiles!timesheets_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
        profiles!timesheets_reviewed_by_fkey (id, first_name, last_name, display_name)
      `)
      .single();

    if (updateError) {
      console.error("Error approving timesheet:", updateError);
      return NextResponse.json({ error: "Failed to approve timesheet" }, { status: 500 });
    }

    // TODO: Create notification for the user
    // await createNotification(...)

    return NextResponse.json({ success: true, data: updatedTimesheet });
  } catch (error) {
    console.error("Error in PUT /api/timesheets/[id]/approve:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
