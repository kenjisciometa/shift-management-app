import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

/**
 * GET /api/profile
 * Get the current user's profile
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

    // Get full profile with related data
    const { data: fullProfile, error: fetchError } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        first_name,
        last_name,
        display_name,
        avatar_url,
        phone,
        role,
        status,
        hire_date,
        employee_code,
        employment_type,
        hourly_rate,
        department_id,
        allow_time_edit,
        auto_clock_out_enabled,
        auto_clock_out_time,
        notification_settings,
        created_at,
        updated_at,
        organization:organizations (id, name, slug, logo_url, timezone),
        department:departments!profiles_department_id_fkey (id, name),
        user_positions (
          id,
          is_primary,
          wage_rate,
          position:positions (id, name, color)
        ),
        user_locations (
          id,
          location:locations (id, name, address)
        )
      `)
      .eq("id", user.id)
      .single();

    if (fetchError) {
      console.error("Error fetching profile:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: fullProfile });
  } catch (error) {
    console.error("Error in GET /api/profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  display_name?: string;
  phone?: string;
  notification_settings?: Record<string, unknown>;
}

/**
 * PUT /api/profile
 * Update the current user's profile
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

    const body: UpdateProfileRequest = await request.json();
    const { first_name, last_name, display_name, phone, notification_settings } = body;

    // Build update object (only allow certain fields to be updated by user)
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (display_name !== undefined) updateData.display_name = display_name;
    if (phone !== undefined) updateData.phone = phone;
    if (notification_settings !== undefined) updateData.notification_settings = notification_settings;

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)
      .select(`
        id,
        email,
        first_name,
        last_name,
        display_name,
        avatar_url,
        phone,
        role,
        notification_settings,
        updated_at
      `)
      .single();

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updatedProfile });
  } catch (error) {
    console.error("Error in PUT /api/profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
