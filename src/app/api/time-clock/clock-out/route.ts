import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

interface ClockOutRequest {
  notes?: string;
  coordinates?: { lat: number; lng: number };
}

interface TimeClockSettings {
  overtime_threshold_hours: number;
  notify_on_overtime: boolean;
}

const DEFAULT_TIME_CLOCK_SETTINGS: TimeClockSettings = {
  overtime_threshold_hours: 8,
  notify_on_overtime: true,
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
 * POST /api/time-clock/clock-out
 * Clock out for the current user
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

    const body: ClockOutRequest = await request.json();
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
        { error: "Already clocked out" },
        { status: 400 }
      );
    }

    if (lastEntry.entry_type === "break_start") {
      return NextResponse.json(
        { error: "Must end break before clocking out" },
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

    // Create clock out entry
    const { data: entry, error: insertError } = await supabase
      .from("time_entries")
      .insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        location_id: lastEntry.location_id,
        entry_type: "clock_out",
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
      console.error("Error creating clock out entry:", insertError);
      return NextResponse.json(
        { error: "Failed to clock out" },
        { status: 500 }
      );
    }

    // Check for overtime and send notifications
    try {
      // Get organization settings
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

      // Get all entries for today to calculate total hours
      const { data: allTodayEntries } = await supabase
        .from("time_entries")
        .select("entry_type, timestamp")
        .eq("user_id", user.id)
        .gte("timestamp", `${today}T00:00:00`)
        .lte("timestamp", `${today}T23:59:59`)
        .order("timestamp", { ascending: true });

      if (allTodayEntries && allTodayEntries.length > 0) {
        // Calculate total worked hours
        let totalWorkedMinutes = 0;
        let clockInTime: Date | null = null;
        let breakStartTime: Date | null = null;

        for (const e of allTodayEntries) {
          const entryTime = new Date(e.timestamp);

          switch (e.entry_type) {
            case "clock_in":
              clockInTime = entryTime;
              break;
            case "break_start":
              if (clockInTime) {
                totalWorkedMinutes += (entryTime.getTime() - clockInTime.getTime()) / 60000;
              }
              breakStartTime = entryTime;
              break;
            case "break_end":
              clockInTime = entryTime;
              breakStartTime = null;
              break;
            case "clock_out":
              if (clockInTime) {
                totalWorkedMinutes += (entryTime.getTime() - clockInTime.getTime()) / 60000;
              }
              clockInTime = null;
              break;
          }
        }

        const totalWorkedHours = totalWorkedMinutes / 60;

        // Check if overtime threshold is exceeded
        if (totalWorkedHours > timeClockSettings.overtime_threshold_hours && timeClockSettings.notify_on_overtime) {
          const overtimeHours = (totalWorkedHours - timeClockSettings.overtime_threshold_hours).toFixed(1);
          const employeeName = profile.display_name || `${profile.first_name} ${profile.last_name}`;

          // Get all managers/admins to notify
          const { data: managers } = await supabase
            .from("profiles")
            .select("id")
            .eq("organization_id", profile.organization_id)
            .in("role", ["admin", "owner", "manager"])
            .neq("id", user.id);

          if (managers && managers.length > 0) {
            const notifications = managers.map((manager) => ({
              organization_id: profile.organization_id,
              user_id: manager.id,
              type: "overtime_alert",
              title: "Overtime Alert",
              body: `${employeeName} has worked ${overtimeHours} hours of overtime today.`,
              data: {
                employee_id: user.id,
                employee_name: employeeName,
                total_hours: totalWorkedHours.toFixed(1),
                overtime_hours: overtimeHours,
                date: today,
              },
            }));

            await supabase.from("notifications").insert(notifications);
          }
        }
      }
    } catch (overtimeError) {
      // Don't fail the clock-out if overtime check fails
      console.error("Error checking overtime:", overtimeError);
    }

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/time-clock/clock-out:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
