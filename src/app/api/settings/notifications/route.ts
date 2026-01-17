import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import type { Json } from "@/types/database.types";

interface NotificationSettings {
  email_enabled: boolean;
  push_enabled: boolean;
  shift_reminders: boolean;
  shift_changes: boolean;
  pto_updates: boolean;
  swap_requests: boolean;
  chat_messages: boolean;
  task_assignments: boolean;
  weekly_summary: boolean;
  reminder_hours_before: number;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email_enabled: true,
  push_enabled: true,
  shift_reminders: true,
  shift_changes: true,
  pto_updates: true,
  swap_requests: true,
  chat_messages: true,
  task_assignments: true,
  weekly_summary: false,
  reminder_hours_before: 24,
};

/**
 * GET /api/settings/notifications
 * Get user's notification settings
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

    // Get current notification settings from profile
    const notificationSettings = (profile.notification_settings as Partial<NotificationSettings>) || {};

    const settings: NotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...notificationSettings,
    };

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error("Error in GET /api/settings/notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/notifications
 * Update user's notification settings
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

    const body: Partial<NotificationSettings> = await request.json();

    // Merge with existing settings
    const currentSettings = (profile.notification_settings as Partial<NotificationSettings>) || {};
    const updatedSettings: NotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...currentSettings,
      ...body,
    };

    // Update profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        notification_settings: updatedSettings as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating notification settings:", updateError);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updatedSettings });
  } catch (error) {
    console.error("Error in PUT /api/settings/notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
