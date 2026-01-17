import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface TimeClockSettings {
  allow_manual_time_entry: boolean;
  require_notes_for_manual_entry: boolean;
}

const DEFAULT_TIME_CLOCK_SETTINGS: TimeClockSettings = {
  allow_manual_time_entry: true,
  require_notes_for_manual_entry: true,
};

/**
 * PUT /api/time-entries/[id]
 * Update a single time entry by its actual ID
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Fetch the existing time entry to verify ownership
    const { data: entry, error: fetchError } = await supabase
      .from("time_entries")
      .select("*")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError || !entry) {
      return NextResponse.json(
        { error: "Time entry not found" },
        { status: 404 }
      );
    }

    const isPrivileged = isPrivilegedUser(profile.role);

    // Non-privileged users can only edit their own entries
    if (!isPrivileged && entry.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: Cannot edit other users' entries" },
        { status: 403 }
      );
    }

    // Get organization time-clock settings
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", profile.organization_id)
      .single();

    const orgSettings = (org?.settings as Record<string, unknown>) || {};
    const timeClockSettings: TimeClockSettings = {
      ...DEFAULT_TIME_CLOCK_SETTINGS,
      ...(orgSettings.time_clock as Partial<TimeClockSettings> || {}),
    };

    // Check if manual time entry is allowed
    const isTimeChange = body.timestamp !== undefined && body.timestamp !== entry.timestamp;

    if (isTimeChange) {
      // Check if user has allow_time_edit permission (employee-level override)
      if (!isPrivileged) {
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("allow_time_edit")
          .eq("id", entry.user_id)
          .single();

        if (userProfile?.allow_time_edit === false) {
          return NextResponse.json(
            { error: "You are not allowed to edit time entries" },
            { status: 403 }
          );
        }
      }

      // Check organization setting
      if (!timeClockSettings.allow_manual_time_entry) {
        return NextResponse.json(
          { error: "Manual time entry is not allowed for this organization" },
          { status: 403 }
        );
      }

      // Check if notes are required
      if (timeClockSettings.require_notes_for_manual_entry) {
        if (!body.notes || body.notes.trim() === "") {
          return NextResponse.json(
            { error: "Notes are required when editing time entries" },
            { status: 400 }
          );
        }
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.timestamp !== undefined) {
      updateData.timestamp = body.timestamp;
      updateData.is_manual = true;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    if (body.status !== undefined && isPrivileged) {
      updateData.status = body.status;
      if (body.status === "approved") {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user.id;
      }
    }

    const { error: updateError } = await supabase
      .from("time_entries")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Error updating time entry:", updateError);
      return NextResponse.json(
        { error: "Failed to update time entry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PUT /api/time-entries/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
