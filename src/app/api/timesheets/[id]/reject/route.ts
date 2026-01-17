import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";
import { createTimesheetNotification } from "@/lib/notifications";

/**
 * PUT /api/timesheets/[id]/reject
 * Reject a timesheet (admin/manager only)
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
        { error: "Can only reject submitted timesheets" },
        { status: 400 }
      );
    }

    if (!reviewComment || reviewComment.trim() === "") {
      return NextResponse.json(
        { error: "Review comment is required for rejection" },
        { status: 400 }
      );
    }

    // Get reviewer name before update
    const { data: reviewerProfile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, display_name")
      .eq("id", user.id)
      .single();

    // Update the timesheet status (rejected timesheets can be edited and resubmitted)
    const { data: updatedTimesheet, error: updateError } = await supabase
      .from("timesheets")
      .update({
        status: "rejected",
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
      console.error("Error rejecting timesheet:", updateError);
      return NextResponse.json({ error: "Failed to reject timesheet" }, { status: 500 });
    }

    // Create notification for the employee
    const reviewerName =
      reviewerProfile?.display_name ||
      `${reviewerProfile?.first_name} ${reviewerProfile?.last_name}`;

    await createTimesheetNotification(supabase, {
      userId: existingTimesheet.user_id,
      organizationId: profile.organization_id,
      type: "rejected",
      timesheetId: id,
      periodStart: existingTimesheet.period_start,
      periodEnd: existingTimesheet.period_end,
      reviewerName,
      comment: reviewComment,
    });

    return NextResponse.json({ success: true, data: updatedTimesheet });
  } catch (error) {
    console.error("Error in PUT /api/timesheets/[id]/reject:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
