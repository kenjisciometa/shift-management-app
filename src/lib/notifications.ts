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
 * Create a notification for a shift swap request
 */
export async function createShiftSwapNotification(
  supabase: any,
  {
    userId,
    organizationId,
    type,
    requesterName,
    targetName,
    shiftDate,
    swapId,
  }: {
    userId: string;
    organizationId: string;
    type: "swap_requested" | "swap_accepted" | "swap_approved" | "swap_rejected" | "swap_manager_notification";
    requesterName: string;
    targetName?: string;
    shiftDate: string;
    swapId: string;
  }
): Promise<void> {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const dateStr = formatDate(shiftDate);

  let title: string;
  let body: string;
  let notificationType: string;

  switch (type) {
    case "swap_requested":
      title = "Shift Swap Request";
      body = `${requesterName} has requested to swap shifts with you for ${dateStr}.`;
      notificationType = "shift_swap_requested";
      break;
    case "swap_accepted":
      title = "Shift Swap Accepted";
      body = `${targetName || "The employee"} has accepted your shift swap request for ${dateStr}.`;
      notificationType = "shift_swap_accepted";
      break;
    case "swap_approved":
      title = "Shift Swap Approved";
      body = `Your shift swap for ${dateStr} has been approved.`;
      notificationType = "shift_swap_approved";
      break;
    case "swap_rejected":
      title = "Shift Swap Rejected";
      body = `Your shift swap request for ${dateStr} has been declined.`;
      notificationType = "shift_swap_rejected";
      break;
    case "swap_manager_notification":
      title = "Shift Swap Request Pending";
      body = `${requesterName} has requested a shift swap with ${targetName || "another employee"} for ${dateStr}.`;
      notificationType = "shift_swap_pending_approval";
      break;
    default:
      return;
  }

  await createNotification(supabase, {
    user_id: userId,
    organization_id: organizationId,
    type: notificationType,
    title,
    body,
    data: {
      swap_id: swapId,
      requester_name: requesterName,
      target_name: targetName,
      shift_date: shiftDate,
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
