import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isAdminUser } from "@/app/api/shared/rbac";

/**
 * GET /api/organization/locations
 * Get all locations (admin only)
 *
 * Query params:
 * - active_only: boolean (optional, default false)
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

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active_only") === "true";

    let query = supabase
      .from("locations")
      .select(`
        id,
        name,
        address,
        latitude,
        longitude,
        timezone,
        is_active,
        geofence_enabled,
        radius_meters,
        allow_clock_outside,
        created_at,
        updated_at
      `)
      .eq("organization_id", profile.organization_id)
      .order("name", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: locations, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching locations:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch locations" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: locations || [] });
  } catch (error) {
    console.error("Error in GET /api/organization/locations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface CreateLocationRequest {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  geofence_enabled?: boolean;
  radius_meters?: number;
  allow_clock_outside?: boolean;
}

/**
 * POST /api/organization/locations
 * Create a new location (admin only)
 */
export async function POST(request: NextRequest) {
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

    const body: CreateLocationRequest = await request.json();
    const {
      name,
      address,
      latitude,
      longitude,
      timezone,
      geofence_enabled,
      radius_meters,
      allow_clock_outside,
    } = body;

    if (!name || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: "name, latitude, and longitude are required" },
        { status: 400 }
      );
    }

    const { data: location, error: insertError } = await supabase
      .from("locations")
      .insert({
        organization_id: profile.organization_id,
        name,
        address: address || null,
        latitude,
        longitude,
        timezone: timezone || null,
        geofence_enabled: geofence_enabled ?? false,
        radius_meters: radius_meters || 100,
        allow_clock_outside: allow_clock_outside ?? true,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating location:", insertError);
      return NextResponse.json(
        { error: "Failed to create location" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: location }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/organization/locations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
