import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isAdminUser } from "@/app/api/shared/rbac";
import type { Json } from "@/types/database.types";

interface ScheduleSettings {
  week_starts_on: number; // 0 = Sunday, 1 = Monday, etc.
  default_shift_duration_hours: number;
  min_shift_duration_hours: number;
  max_shift_duration_hours: number;
  min_rest_between_shifts_hours: number;
  max_hours_per_day: number;
  max_hours_per_week: number;
  overtime_threshold_daily: number;
  overtime_threshold_weekly: number;
  allow_overtime: boolean;
  require_break_after_hours: number;
  break_duration_minutes: number;
  auto_publish_days_ahead: number;
  show_unpublished_to_employees: boolean;
}

const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  week_starts_on: 0,
  default_shift_duration_hours: 8,
  min_shift_duration_hours: 2,
  max_shift_duration_hours: 12,
  min_rest_between_shifts_hours: 8,
  max_hours_per_day: 10,
  max_hours_per_week: 40,
  overtime_threshold_daily: 8,
  overtime_threshold_weekly: 40,
  allow_overtime: true,
  require_break_after_hours: 6,
  break_duration_minutes: 30,
  auto_publish_days_ahead: 7,
  show_unpublished_to_employees: false,
};

/**
 * GET /api/settings/organization/schedule
 * Get organization schedule settings (admin only)
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

    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const scheduleSettings: ScheduleSettings = {
      ...DEFAULT_SCHEDULE_SETTINGS,
      ...(orgSettings.schedule as Partial<ScheduleSettings> || {}),
    };

    return NextResponse.json({ success: true, data: scheduleSettings });
  } catch (error) {
    console.error("Error in GET /api/settings/organization/schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/organization/schedule
 * Update organization schedule settings (admin only)
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

    const body: Partial<ScheduleSettings> = await request.json();

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
    const currentScheduleSettings = (currentSettings.schedule as Partial<ScheduleSettings>) || {};

    const updatedScheduleSettings: ScheduleSettings = {
      ...DEFAULT_SCHEDULE_SETTINGS,
      ...currentScheduleSettings,
      ...body,
    };

    const updatedSettings: { [key: string]: Json | undefined } = {
      ...currentSettings as { [key: string]: Json | undefined },
      schedule: updatedScheduleSettings as unknown as Json,
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
      console.error("Error updating schedule settings:", updateError);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updatedScheduleSettings });
  } catch (error) {
    console.error("Error in PUT /api/settings/organization/schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
