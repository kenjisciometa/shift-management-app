import { NextRequest, NextResponse } from "next/server";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

const PRIVILEGED_ROLES = ["admin", "owner", "manager"];

/**
 * PUT /api/timesheets/entries/[id]
 * Update a time entry (clock in/out times, break times, status)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, profile } = authData;
    const { id: entryId } = await params;
    const body = await request.json();

    const {
      clockInTime,
      clockOutTime,
      breakStart,
      breakEnd,
      status,
      comment,
    } = body;

    const supabase = await getCachedSupabase();
    const isPrivileged = PRIVILEGED_ROLES.includes(profile.role || "");

    // The entryId is a composite key: {userId}_{date}
    // We need to parse it and update the individual time entries
    const [userId, date] = entryId.split("_");

    if (!userId || !date) {
      return NextResponse.json(
        { error: "Invalid entry ID format" },
        { status: 400 }
      );
    }

    // Verify access
    if (!isPrivileged && userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: Cannot edit other users' entries" },
        { status: 403 }
      );
    }

    // Get existing time entries for this user and date
    const { data: existingEntries, error: fetchError } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("organization_id", profile.organization_id)
      .gte("timestamp", `${date}T00:00:00`)
      .lte("timestamp", `${date}T23:59:59`);

    if (fetchError) {
      console.error("Error fetching entries:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch existing entries" },
        { status: 500 }
      );
    }

    // Find existing entries by type
    const clockInEntry = existingEntries?.find((e) => e.entry_type === "clock_in");
    const clockOutEntry = existingEntries?.find((e) => e.entry_type === "clock_out");
    const breakStartEntry = existingEntries?.find((e) => e.entry_type === "break_start");
    const breakEndEntry = existingEntries?.find((e) => e.entry_type === "break_end");

    // For non-privileged users, verify they can only edit pending entries
    if (!isPrivileged) {
      // Check if there's an associated timesheet and its status
      const { data: timesheet } = await supabase
        .from("timesheets")
        .select("status")
        .eq("user_id", userId)
        .eq("organization_id", profile.organization_id)
        .gte("period_start", date)
        .lte("period_end", date)
        .single();

      // If timesheet exists and is not pending, deny edit
      if (timesheet && timesheet.status !== "pending" && timesheet.status !== "draft") {
        return NextResponse.json(
          { error: "Cannot edit non-pending entries" },
          { status: 403 }
        );
      }
    }

    // Update clock in time
    if (clockInTime !== undefined) {
      const timestamp = `${date}T${clockInTime}:00`;
      if (clockInEntry) {
        await supabase
          .from("time_entries")
          .update({ timestamp, is_manual: true, updated_at: new Date().toISOString() })
          .eq("id", clockInEntry.id);
      } else if (clockInTime) {
        await supabase.from("time_entries").insert({
          user_id: userId,
          organization_id: profile.organization_id,
          entry_type: "clock_in",
          timestamp,
          is_manual: true,
        });
      }
    }

    // Update clock out time
    if (clockOutTime !== undefined) {
      const timestamp = `${date}T${clockOutTime}:00`;
      if (clockOutEntry) {
        await supabase
          .from("time_entries")
          .update({ timestamp, is_manual: true, updated_at: new Date().toISOString() })
          .eq("id", clockOutEntry.id);
      } else if (clockOutTime) {
        await supabase.from("time_entries").insert({
          user_id: userId,
          organization_id: profile.organization_id,
          entry_type: "clock_out",
          timestamp,
          is_manual: true,
        });
      }
    }

    // Update break start time
    if (breakStart !== undefined) {
      const timestamp = `${date}T${breakStart}:00`;
      if (breakStartEntry) {
        await supabase
          .from("time_entries")
          .update({ timestamp, is_manual: true, updated_at: new Date().toISOString() })
          .eq("id", breakStartEntry.id);
      } else if (breakStart) {
        await supabase.from("time_entries").insert({
          user_id: userId,
          organization_id: profile.organization_id,
          entry_type: "break_start",
          timestamp,
          is_manual: true,
        });
      }
    }

    // Update break end time
    if (breakEnd !== undefined) {
      const timestamp = `${date}T${breakEnd}:00`;
      if (breakEndEntry) {
        await supabase
          .from("time_entries")
          .update({ timestamp, is_manual: true, updated_at: new Date().toISOString() })
          .eq("id", breakEndEntry.id);
      } else if (breakEnd) {
        await supabase.from("time_entries").insert({
          user_id: userId,
          organization_id: profile.organization_id,
          entry_type: "break_end",
          timestamp,
          is_manual: true,
        });
      }
    }

    // Update status (privileged users only)
    if (isPrivileged && status !== undefined) {
      // Find or create timesheet for this date
      const { data: existingTimesheet } = await supabase
        .from("timesheets")
        .select("id")
        .eq("user_id", userId)
        .eq("organization_id", profile.organization_id)
        .lte("period_start", date)
        .gte("period_end", date)
        .single();

      if (existingTimesheet) {
        const updateData: Record<string, unknown> = {
          status,
          updated_at: new Date().toISOString(),
        };

        if (status === "approved" || status === "rejected") {
          updateData.reviewed_by = user.id;
          updateData.reviewed_at = new Date().toISOString();
          if (comment) {
            updateData.review_comment = comment;
          }
        }

        await supabase
          .from("timesheets")
          .update(updateData)
          .eq("id", existingTimesheet.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating time entry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
