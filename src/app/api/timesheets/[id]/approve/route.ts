import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";
import { createTimesheetNotification } from "@/lib/notifications";

/**
 * PUT /api/timesheets/[id]/approve
 * Approve a timesheet (admin/manager only)
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
    const reviewComment = body.review_comment || null;

    // Check if user is admin or manager
    const isAdmin = isPrivilegedUser(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
        profiles!timesheets_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .single();

    if (updateError) {
      console.error("Error approving timesheet:", updateError);
      return NextResponse.json({ error: "Failed to approve timesheet" }, { status: 500 });
    }

    // Create notification for the employee
    // Use the current user's profile as the reviewer
    const reviewerName =
      profile.display_name ||
      `${profile.first_name} ${profile.last_name}`;

    await createTimesheetNotification(supabase, {
      userId: existingTimesheet.user_id,
      organizationId: profile.organization_id,
      type: "approved",
      timesheetId: id,
      periodStart: existingTimesheet.period_start,
      periodEnd: existingTimesheet.period_end,
      reviewerName,
      comment: reviewComment,
    });

    return NextResponse.json({ success: true, data: updatedTimesheet });
  } catch (error) {
    console.error("Error in PUT /api/timesheets/[id]/approve:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
