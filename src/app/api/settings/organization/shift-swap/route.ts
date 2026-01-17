import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isAdminUser } from "@/app/api/shared/rbac";
import type { Json } from "@/types/database.types";

interface ShiftSwapSettings {
  enabled: boolean;
  require_manager_approval: boolean;
  allow_cross_location: boolean;
  allow_cross_department: boolean;
  min_notice_hours: number;
  max_future_days: number;
  auto_approve_same_position: boolean;
  notify_managers: boolean;
  notify_affected_employees: boolean;
}

const DEFAULT_SHIFT_SWAP_SETTINGS: ShiftSwapSettings = {
  enabled: true,
  require_manager_approval: true,
  allow_cross_location: false,
  allow_cross_department: false,
  min_notice_hours: 24,
  max_future_days: 30,
  auto_approve_same_position: false,
  notify_managers: true,
  notify_affected_employees: true,
};

/**
 * GET /api/settings/organization/shift-swap
 * Get organization shift swap settings (admin only)
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
    const shiftSwapSettings: ShiftSwapSettings = {
      ...DEFAULT_SHIFT_SWAP_SETTINGS,
      ...(orgSettings.shift_swap as Partial<ShiftSwapSettings> || {}),
    };

    return NextResponse.json({ success: true, data: shiftSwapSettings });
  } catch (error) {
    console.error("Error in GET /api/settings/organization/shift-swap:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/organization/shift-swap
 * Update organization shift swap settings (admin only)
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

    const body: Partial<ShiftSwapSettings> = await request.json();

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
    const currentShiftSwapSettings = (currentSettings.shift_swap as Partial<ShiftSwapSettings>) || {};

    const updatedShiftSwapSettings: ShiftSwapSettings = {
      ...DEFAULT_SHIFT_SWAP_SETTINGS,
      ...currentShiftSwapSettings,
      ...body,
    };

    const updatedSettings: { [key: string]: Json | undefined } = {
      ...currentSettings as { [key: string]: Json | undefined },
      shift_swap: updatedShiftSwapSettings as unknown as Json,
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
      console.error("Error updating shift swap settings:", updateError);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updatedShiftSwapSettings });
  } catch (error) {
    console.error("Error in PUT /api/settings/organization/shift-swap:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
