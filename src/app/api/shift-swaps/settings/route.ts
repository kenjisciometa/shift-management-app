import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";
import type { Json } from "@/types/database.types";

interface ShiftSwapSettings {
  enabled: boolean;
  require_manager_approval: boolean;
  allow_cross_location: boolean;
  allow_cross_department: boolean;
  min_notice_hours: number;
  max_future_days: number;
}

const DEFAULT_SETTINGS: ShiftSwapSettings = {
  enabled: true,
  require_manager_approval: true,
  allow_cross_location: false,
  allow_cross_department: false,
  min_notice_hours: 24,
  max_future_days: 30,
};

/**
 * GET /api/shift-swaps/settings
 * Get shift swap settings for the organization
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

    // Extract shift swap settings from organization settings
    const orgSettings = (org?.settings as Record<string, unknown>) || {};
    const shiftSwapSettings: ShiftSwapSettings = {
      ...DEFAULT_SETTINGS,
      ...(orgSettings.shift_swap as Partial<ShiftSwapSettings> || {}),
    };

    return NextResponse.json({ success: true, data: shiftSwapSettings });
  } catch (error) {
    console.error("Error in GET /api/shift-swaps/settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/shift-swaps/settings
 * Update shift swap settings (admin only)
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

    // Only admin can update settings
    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: Partial<ShiftSwapSettings> = await request.json();

    // Get current organization settings
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

    // Merge settings
    const currentSettings = (org?.settings as Record<string, unknown>) || {};
    const currentShiftSwapSettings = (currentSettings.shift_swap as Partial<ShiftSwapSettings>) || {};

    const updatedShiftSwapSettings: ShiftSwapSettings = {
      ...DEFAULT_SETTINGS,
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
      console.error("Error updating settings:", updateError);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updatedShiftSwapSettings });
  } catch (error) {
    console.error("Error in PUT /api/shift-swaps/settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
