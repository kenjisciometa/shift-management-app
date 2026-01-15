import { NextResponse } from "next/server";

/**
 * @deprecated This endpoint is deprecated as of the Timesheet Redesign.
 * The submit workflow has been removed. Timesheets are now automatically
 * set to 'pending' status and can be directly approved/rejected by managers.
 *
 * Use PUT /api/timesheets/entries/[id] to update time entries.
 * Use PUT /api/timesheets/[id]/approve to approve a timesheet.
 * Use PUT /api/timesheets/[id]/reject to reject a timesheet.
 */
export async function PUT() {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated",
      message:
        "The submit workflow has been removed. Timesheets are now automatically pending and can be directly approved or rejected by managers.",
      alternatives: {
        updateEntry: "PUT /api/timesheets/entries/[id]",
        approve: "PUT /api/timesheets/[id]/approve",
        reject: "PUT /api/timesheets/[id]/reject",
      },
    },
    { status: 410 } // Gone
  );
}
