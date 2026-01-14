import type { Database } from "@/types/database.types";

type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];

/**
 * Create a notification for a user
 */
export async function createNotification(
  supabase: any,
  notification: Omit<NotificationInsert, "id" | "created_at">
): Promise<void> {
  try {
    const { error } = await supabase.from("notifications").insert({
      ...notification,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error creating notification:", error);
      // Don't throw - notifications are non-critical
    }
  } catch (error) {
    console.error("Error creating notification:", error);
    // Don't throw - notifications are non-critical
  }
}

/**
 * Create a timesheet notification
 */
export async function createTimesheetNotification(
  supabase: any,
  {
    userId,
    organizationId,
    type,
    timesheetId,
    periodStart,
    periodEnd,
    reviewerName,
    comment,
  }: {
    userId: string;
    organizationId: string;
    type: "submitted" | "approved" | "rejected";
    timesheetId: string;
    periodStart: string;
    periodEnd: string;
    reviewerName?: string;
    comment?: string | null;
  }
): Promise<void> {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const period = `${formatDate(periodStart)} - ${formatDate(periodEnd)}`;

  let title: string;
  let body: string;
  let notificationType: string;

  switch (type) {
    case "submitted":
      title = "Timesheet Submitted";
      body = `Your timesheet for ${period} has been submitted for approval.`;
      notificationType = "timesheet_submitted";
      break;
    case "approved":
      title = "Timesheet Approved";
      body = reviewerName
        ? `Your timesheet for ${period} has been approved by ${reviewerName}.`
        : `Your timesheet for ${period} has been approved.`;
      if (comment) {
        body += ` Comment: ${comment}`;
      }
      notificationType = "timesheet_approved";
      break;
    case "rejected":
      title = "Timesheet Rejected";
      body = reviewerName
        ? `Your timesheet for ${period} has been rejected by ${reviewerName}.`
        : `Your timesheet for ${period} has been rejected.`;
      if (comment) {
        body += ` Reason: ${comment}`;
      }
      notificationType = "timesheet_rejected";
      break;
  }

  await createNotification(supabase, {
    user_id: userId,
    organization_id: organizationId,
    type: notificationType,
    title,
    body,
    data: {
      timesheet_id: timesheetId,
      period_start: periodStart,
      period_end: periodEnd,
      reviewer_name: reviewerName,
      comment,
    },
  });
}

/**
 * Create a notification for admins when a timesheet is submitted
 */
export async function createTimesheetSubmittedAdminNotification(
  supabase: any,
  {
    adminUserId,
    organizationId,
    employeeName,
    timesheetId,
    periodStart,
    periodEnd,
  }: {
    adminUserId: string;
    organizationId: string;
    employeeName: string;
    timesheetId: string;
    periodStart: string;
    periodEnd: string;
  }
): Promise<void> {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const period = `${formatDate(periodStart)} - ${formatDate(periodEnd)}`;

  await createNotification(supabase, {
    user_id: adminUserId,
    organization_id: organizationId,
    type: "timesheet_pending_approval",
    title: "Timesheet Pending Approval",
    body: `${employeeName} has submitted a timesheet for ${period} that requires your approval.`,
    data: {
      timesheet_id: timesheetId,
      employee_name: employeeName,
      period_start: periodStart,
      period_end: periodEnd,
    },
  });
}
