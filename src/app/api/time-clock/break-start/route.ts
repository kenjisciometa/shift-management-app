import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

interface BreakStartRequest {
  notes?: string;
  coordinates?: { lat: number; lng: number };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * POST /api/time-clock/break-start
 * Start a break for the current user
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

    const body: BreakStartRequest = await request.json();
    const { notes, coordinates } = body;

    // Check current status
    const today = new Date().toISOString().split("T")[0];
    const { data: todayEntries, error: fetchError } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", user.id)
      .gte("timestamp", `${today}T00:00:00`)
      .lte("timestamp", `${today}T23:59:59`)
      .order("timestamp", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error("Error fetching entries:", fetchError);
      return NextResponse.json(
        { error: "Failed to check status" },
        { status: 500 }
      );
    }

    if (!todayEntries || todayEntries.length === 0) {
      return NextResponse.json(
        { error: "Not clocked in" },
        { status: 400 }
      );
    }

    const lastEntry = todayEntries[0];
    if (lastEntry.entry_type === "clock_out") {
      return NextResponse.json(
        { error: "Not clocked in" },
        { status: 400 }
      );
    }

    if (lastEntry.entry_type === "break_start") {
      return NextResponse.json(
        { error: "Already on break" },
        { status: 400 }
      );
    }

    // Get location settings for geofence check
    let isInsideGeofence: boolean | null = null;

    if (lastEntry.location_id && coordinates) {
      const { data: location } = await supabase
        .from("locations")
        .select("latitude, longitude, radius_meters, geofence_enabled")
        .eq("id", lastEntry.location_id)
        .single();

      if (location?.geofence_enabled && location.latitude && location.longitude && location.radius_meters) {
        const distance = calculateDistance(
          coordinates.lat,
          coordinates.lng,
          Number(location.latitude),
          Number(location.longitude)
        );
        isInsideGeofence = distance <= location.radius_meters;
      }
    }

    // Create break start entry
    const { data: entry, error: insertError } = await supabase
      .from("time_entries")
      .insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        location_id: lastEntry.location_id,
        entry_type: "break_start",
        timestamp: new Date().toISOString(),
        notes: notes || null,
        latitude: coordinates?.lat || null,
        longitude: coordinates?.lng || null,
        is_inside_geofence: isInsideGeofence,
      })
      .select(`
        *,
        location:locations (id, name)
      `)
      .single();

    if (insertError) {
      console.error("Error creating break start entry:", insertError);
      return NextResponse.json(
        { error: "Failed to start break" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/time-clock/break-start:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
