import { NextResponse } from "next/server";
import { getAuthData, getCachedSupabase } from "@/lib/auth";
import {
  createTimesheetNotification,
  createTimesheetSubmittedAdminNotification,
} from "@/lib/notifications";

/**
 * PUT /api/timesheets/[id]/submit
 * Submit a timesheet for approval
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

    // Only allow submission if draft and user is the owner
    if (existingTimesheet.status !== "draft") {
      return NextResponse.json(
        { error: "Can only submit draft timesheets" },
        { status: 400 }
      );
    }

    if (existingTimesheet.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate that timesheet has required data
    if (!existingTimesheet.total_hours && existingTimesheet.total_hours !== 0) {
      return NextResponse.json(
        { error: "Timesheet must have total hours before submission" },
        { status: 400 }
      );
    }

    // Update the timesheet status
    const { data: updatedTimesheet, error: updateError } = await supabase
      .from("timesheets")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        profiles!timesheets_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .single();

    if (updateError) {
      console.error("Error submitting timesheet:", updateError);
      return NextResponse.json({ error: "Failed to submit timesheet" }, { status: 500 });
    }

    // Create notification for the employee
    await createTimesheetNotification(supabase, {
      userId: user.id,
      organizationId: profile.organization_id,
      type: "submitted",
      timesheetId: id,
      periodStart: existingTimesheet.period_start,
      periodEnd: existingTimesheet.period_end,
    });

    // Get all admins/managers to notify them
    const { data: admins } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, display_name")
      .eq("organization_id", profile.organization_id)
      .in("role", ["admin", "owner", "manager"]);

    if (admins) {
      const employeeName =
        updatedTimesheet.profiles?.display_name ||
        `${updatedTimesheet.profiles?.first_name} ${updatedTimesheet.profiles?.last_name}`;

      // Notify all admins/managers
      await Promise.all(
        admins.map((admin) =>
          createTimesheetSubmittedAdminNotification(supabase, {
            adminUserId: admin.id,
            organizationId: profile.organization_id,
            employeeName,
            timesheetId: id,
            periodStart: existingTimesheet.period_start,
            periodEnd: existingTimesheet.period_end,
          })
        )
      );
    }

    return NextResponse.json({ success: true, data: updatedTimesheet });
  } catch (error) {
    console.error("Error in PUT /api/timesheets/[id]/submit:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
