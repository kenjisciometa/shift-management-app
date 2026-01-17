import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isAdminUser } from "@/app/api/shared/rbac";
import type { Json } from "@/types/database.types";

interface TimeClockSettings {
  // Shift requirements
  require_shift_for_clock_in: boolean;
  allow_early_clock_in_minutes: number;
  allow_late_clock_in_minutes: number;

  // Auto clock-out
  auto_clock_out_enabled: boolean;
  auto_clock_out_hours: number;

  // Manual time entry
  allow_manual_time_entry: boolean;
  require_notes_for_manual_entry: boolean;

  // Overtime
  overtime_threshold_hours: number;
  notify_on_overtime: boolean;
}

const DEFAULT_TIME_CLOCK_SETTINGS: TimeClockSettings = {
  // Shift requirements
  require_shift_for_clock_in: false,
  allow_early_clock_in_minutes: 30,
  allow_late_clock_in_minutes: 60,

  // Auto clock-out
  auto_clock_out_enabled: false,
  auto_clock_out_hours: 12,

  // Manual time entry
  allow_manual_time_entry: true,
  require_notes_for_manual_entry: true,

  // Overtime
  overtime_threshold_hours: 8,
  notify_on_overtime: true,
};

/**
 * GET /api/settings/organization/time-clock
 * Get organization time clock settings
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    // Get organization settings
    const { data: org, error: fetchError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", profile.organization_id)
      .single();

    if (fetchError) {
      console.error("Error fetching organization:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      );
    }

    const orgSettings = (org?.settings as Record<string, unknown>) || {};
    const timeClockSettings: TimeClockSettings = {
      ...DEFAULT_TIME_CLOCK_SETTINGS,
      ...(orgSettings.time_clock as Partial<TimeClockSettings> || {}),
    };

    return NextResponse.json({ success: true, data: timeClockSettings });
  } catch (error) {
    console.error("Error in GET /api/settings/organization/time-clock:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/organization/time-clock
 * Update organization time clock settings (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: Partial<TimeClockSettings> = await request.json();

    // Get current settings
    const { data: org, error: fetchError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", profile.organization_id)
      .single();

    if (fetchError) {
      console.error("Error fetching organization:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      );
    }

    const currentSettings = (org?.settings as Record<string, unknown>) || {};
    const currentTimeClockSettings = (currentSettings.time_clock as Partial<TimeClockSettings>) || {};

    const updatedTimeClockSettings: TimeClockSettings = {
      ...DEFAULT_TIME_CLOCK_SETTINGS,
      ...currentTimeClockSettings,
      ...body,
    };

    const updatedSettings: { [key: string]: Json | undefined } = {
      ...currentSettings as { [key: string]: Json | undefined },
      time_clock: updatedTimeClockSettings as unknown as Json,
    };

    // Update organization settings
    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        settings: updatedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.organization_id);

    if (updateError) {
      console.error("Error updating time clock settings:", updateError);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updatedTimeClockSettings });
  } catch (error) {
    console.error("Error in PUT /api/settings/organization/time-clock:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
