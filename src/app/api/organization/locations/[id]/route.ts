import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isAdminUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface UpdateLocationRequest {
  name?: string;
  address?: string | null;
  latitude?: number;
  longitude?: number;
  timezone?: string | null;
  is_active?: boolean;
  geofence_enabled?: boolean;
  radius_meters?: number;
  allow_clock_outside?: boolean;
}

/**
 * PUT /api/organization/locations/[id]
 * Update a location (admin only)
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

    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body: UpdateLocationRequest = await request.json();

    // Check location exists and belongs to organization
    const { data: existingLocation, error: checkError } = await supabase
      .from("locations")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingLocation) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.latitude !== undefined) updateData.latitude = body.latitude;
    if (body.longitude !== undefined) updateData.longitude = body.longitude;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.geofence_enabled !== undefined) updateData.geofence_enabled = body.geofence_enabled;
    if (body.radius_meters !== undefined) updateData.radius_meters = body.radius_meters;
    if (body.allow_clock_outside !== undefined) updateData.allow_clock_outside = body.allow_clock_outside;

    const { data: location, error: updateError } = await supabase
      .from("locations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating location:", updateError);
      return NextResponse.json(
        { error: "Failed to update location" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: location });
  } catch (error) {
    console.error("Error in PUT /api/organization/locations/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organization/locations/[id]
 * Delete a location (admin only)
 * Note: This deactivates the location rather than deleting it
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    // Check location exists and belongs to organization
    const { data: existingLocation, error: checkError } = await supabase
      .from("locations")
      .select("id, is_active")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingLocation) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // Deactivate location
    const { error: updateError } = await supabase
      .from("locations")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error deactivating location:", updateError);
      return NextResponse.json(
        { error: "Failed to delete location" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/organization/locations/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
