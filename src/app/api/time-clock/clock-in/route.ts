import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

interface ClockInRequest {
  location_id: string;
  shift_id?: string;
  notes?: string;
  coordinates?: { lat: number; lng: number };
}

interface TimeClockSettings {
  require_shift_for_clock_in: boolean;
  allow_early_clock_in_minutes: number;
  allow_late_clock_in_minutes: number;
}

const DEFAULT_TIME_CLOCK_SETTINGS: TimeClockSettings = {
  require_shift_for_clock_in: false,
  allow_early_clock_in_minutes: 30,
  allow_late_clock_in_minutes: 60,
};

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
 * POST /api/time-clock/clock-in
 * Clock in for the current user
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

    const body: ClockInRequest = await request.json();
    const { location_id, shift_id, notes, coordinates } = body;

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

    // Validate shift_id if required
    let validatedShiftId: string | null = null;

    if (timeClockSettings.require_shift_for_clock_in) {
      if (!shift_id) {
        return NextResponse.json(
          { error: "shift_id is required" },
          { status: 400 }
        );
      }
    }

    if (shift_id) {
      // Verify shift exists and belongs to this user
      const today = new Date().toISOString().split("T")[0];
      const { data: shift, error: shiftError } = await supabase
        .from("shifts")
        .select("id, user_id, start_time, end_time, location_id")
        .eq("id", shift_id)
        .eq("organization_id", profile.organization_id)
        .single();

      if (shiftError || !shift) {
        return NextResponse.json(
          { error: "Invalid shift" },
          { status: 400 }
        );
      }

      // Verify shift belongs to this user
      if (shift.user_id !== user.id) {
        return NextResponse.json(
          { error: "This shift is not assigned to you" },
          { status: 400 }
        );
      }

      // Verify shift is for today
      const shiftDate = shift.start_time.split("T")[0];
      if (shiftDate !== today) {
        return NextResponse.json(
          { error: "This shift is not for today" },
          { status: 400 }
        );
      }

      // Check Early/Late Clock-in Window (only when require_shift_for_clock_in is true)
      if (timeClockSettings.require_shift_for_clock_in) {
        const now = new Date();
        const shiftStartTime = new Date(shift.start_time);
        const diffMinutes = (now.getTime() - shiftStartTime.getTime()) / (1000 * 60);

        // Check if too early
        if (diffMinutes < -timeClockSettings.allow_early_clock_in_minutes) {
          const minsUntilAllowed = Math.ceil(-diffMinutes - timeClockSettings.allow_early_clock_in_minutes);
          return NextResponse.json(
            { error: `Too early to clock in. Please wait ${minsUntilAllowed} more minute${minsUntilAllowed === 1 ? '' : 's'}.` },
            { status: 400 }
          );
        }

        // Check if too late
        if (diffMinutes > timeClockSettings.allow_late_clock_in_minutes) {
          return NextResponse.json(
            { error: `Clock-in window has expired. The shift started ${Math.floor(diffMinutes)} minutes ago.` },
            { status: 400 }
          );
        }
      }

      // Check if this shift is already clocked in
      const { data: existingEntry } = await supabase
        .from("time_entries")
        .select("id")
        .eq("shift_id", shift_id)
        .eq("entry_type", "clock_in")
        .limit(1);

      if (existingEntry && existingEntry.length > 0) {
        return NextResponse.json(
          { error: "This shift has already been clocked in" },
          { status: 400 }
        );
      }

      validatedShiftId = shift_id;

      // Use shift's location if not provided
      if (!location_id && shift.location_id) {
        body.location_id = shift.location_id;
      }
    }

    if (!body.location_id) {
      return NextResponse.json(
        { error: "location_id is required" },
        { status: 400 }
      );
    }

    const finalLocationId = body.location_id;

    // Verify location belongs to organization and get geofence settings
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id, name, is_active, geofence_enabled, allow_clock_outside, latitude, longitude, radius_meters")
      .eq("id", finalLocationId)
      .eq("organization_id", profile.organization_id)
      .single();

    if (locationError || !location) {
      return NextResponse.json(
        { error: "Invalid location" },
        { status: 400 }
      );
    }

    // Check if location is active
    if (!location.is_active) {
      return NextResponse.json(
        { error: "This location is not active" },
        { status: 400 }
      );
    }

    // Check geofence if enabled
    let isInsideGeofence: boolean | null = null;

    if (location.geofence_enabled && location.latitude && location.longitude && location.radius_meters) {
      if (coordinates) {
        const distance = calculateDistance(
          coordinates.lat,
          coordinates.lng,
          Number(location.latitude),
          Number(location.longitude)
        );
        isInsideGeofence = distance <= location.radius_meters;

        // Block if outside geofence and not allowed
        if (!isInsideGeofence && !location.allow_clock_outside) {
          return NextResponse.json(
            { error: "You must be within the work location to clock in" },
            { status: 400 }
          );
        }
      } else if (!location.allow_clock_outside) {
        // No coordinates provided but geofence is required
        return NextResponse.json(
          { error: "Location coordinates are required for this location" },
          { status: 400 }
        );
      }
    }

    // Check if already clocked in (not related to shift - check general status)
    const todayForCheck = new Date().toISOString().split("T")[0];
    const { data: todayEntries } = await supabase
      .from("time_entries")
      .select("entry_type, shift_id")
      .eq("user_id", user.id)
      .gte("timestamp", `${todayForCheck}T00:00:00`)
      .lte("timestamp", `${todayForCheck}T23:59:59`)
      .order("timestamp", { ascending: false })
      .limit(1);

    if (todayEntries && todayEntries.length > 0) {
      const lastEntry = todayEntries[0];
      if (lastEntry.entry_type !== "clock_out") {
        return NextResponse.json(
          { error: "Already clocked in. Please clock out first." },
          { status: 400 }
        );
      }
    }

    // Create clock in entry
    const { data: entry, error: insertError } = await supabase
      .from("time_entries")
      .insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        location_id: finalLocationId,
        shift_id: validatedShiftId,
        entry_type: "clock_in",
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
      console.error("Error creating clock in entry:", insertError);
      return NextResponse.json(
        { error: "Failed to clock in" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/time-clock/clock-in:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
