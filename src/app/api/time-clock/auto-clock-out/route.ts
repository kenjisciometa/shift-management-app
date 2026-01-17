import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface TimeClockSettings {
  auto_clock_out_enabled: boolean;
  auto_clock_out_hours: number;
}

const DEFAULT_TIME_CLOCK_SETTINGS: TimeClockSettings = {
  auto_clock_out_enabled: false,
  auto_clock_out_hours: 12,
};

/**
 * POST /api/time-clock/auto-clock-out
 * Automatically clock out users who have exceeded the auto clock-out threshold.
 * This endpoint should be called by a cron job.
 * Requires CRON_SECRET header for authorization.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get("x-cron-secret");
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create admin supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const results: {
      processed: number;
      clockedOut: number;
      errors: string[];
    } = {
      processed: 0,
      clockedOut: 0,
      errors: [],
    };

    // Get all organizations with auto clock-out enabled
    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("id, settings");

    if (orgError) {
      console.error("Error fetching organizations:", orgError);
      return NextResponse.json(
        { error: "Failed to fetch organizations" },
        { status: 500 }
      );
    }

    for (const org of organizations || []) {
      const orgSettings = (org.settings as Record<string, unknown>) || {};
      const timeClockSettings: TimeClockSettings = {
        ...DEFAULT_TIME_CLOCK_SETTINGS,
        ...((orgSettings.time_clock as Partial<TimeClockSettings>) || {}),
      };

      // Skip if auto clock-out is not enabled for this organization
      if (!timeClockSettings.auto_clock_out_enabled) {
        continue;
      }

      // Find users who are currently clocked in for this organization
      // Get the latest time entry for each user that's a clock_in without a subsequent clock_out
      const { data: activeEntries, error: entriesError } = await supabase
        .from("time_entries")
        .select(`
          id,
          user_id,
          organization_id,
          location_id,
          shift_id,
          timestamp,
          entry_type
        `)
        .eq("organization_id", org.id)
        .eq("entry_type", "clock_in")
        .order("timestamp", { ascending: false });

      if (entriesError) {
        console.error(`Error fetching entries for org ${org.id}:`, entriesError);
        results.errors.push(`Org ${org.id}: ${entriesError.message}`);
        continue;
      }

      // Group entries by user and get the latest clock_in
      const userLatestClockIn = new Map<string, typeof activeEntries[0]>();
      for (const entry of activeEntries || []) {
        if (!userLatestClockIn.has(entry.user_id)) {
          userLatestClockIn.set(entry.user_id, entry);
        }
      }

      for (const [userId, clockInEntry] of userLatestClockIn) {
        results.processed++;

        // Check if there's a clock_out after this clock_in
        const { data: subsequentClockOut } = await supabase
          .from("time_entries")
          .select("id")
          .eq("user_id", userId)
          .eq("entry_type", "clock_out")
          .gt("timestamp", clockInEntry.timestamp)
          .limit(1);

        if (subsequentClockOut && subsequentClockOut.length > 0) {
          // User has already clocked out
          continue;
        }

        // Get employee-level settings
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, auto_clock_out_enabled, auto_clock_out_time")
          .eq("id", userId)
          .single();

        // Check if employee has auto clock-out explicitly disabled
        if (profile?.auto_clock_out_enabled === false) {
          continue;
        }

        // Calculate hours since clock-in
        const clockInTime = new Date(clockInEntry.timestamp);
        const hoursSinceClockIn = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

        // Determine the threshold: employee-level override or org-level default
        let shouldAutoClockOut = false;
        let autoClockOutReason = "";

        if (profile?.auto_clock_out_time) {
          // Employee has a specific auto clock-out time set
          const [hours, minutes] = profile.auto_clock_out_time.split(":").map(Number);
          const autoClockOutTime = new Date(clockInTime);
          autoClockOutTime.setHours(hours, minutes, 0, 0);

          // If the auto clock-out time is before clock-in time, it's for the next day
          if (autoClockOutTime <= clockInTime) {
            autoClockOutTime.setDate(autoClockOutTime.getDate() + 1);
          }

          if (now >= autoClockOutTime) {
            shouldAutoClockOut = true;
            autoClockOutReason = `Scheduled auto clock-out at ${profile.auto_clock_out_time}`;
          }
        } else if (hoursSinceClockIn >= timeClockSettings.auto_clock_out_hours) {
          // Use organization-level threshold
          shouldAutoClockOut = true;
          autoClockOutReason = `Exceeded ${timeClockSettings.auto_clock_out_hours} hour threshold`;
        }

        if (shouldAutoClockOut) {
          // Create auto clock-out entry
          const { error: insertError } = await supabase
            .from("time_entries")
            .insert({
              organization_id: org.id,
              user_id: userId,
              location_id: clockInEntry.location_id,
              shift_id: clockInEntry.shift_id,
              entry_type: "clock_out",
              timestamp: now.toISOString(),
              notes: `[AUTO] ${autoClockOutReason}`,
            });

          if (insertError) {
            console.error(`Error auto clocking out user ${userId}:`, insertError);
            results.errors.push(`User ${userId}: ${insertError.message}`);
          } else {
            results.clockedOut++;
            console.log(`Auto clocked out user ${userId}: ${autoClockOutReason}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error in POST /api/time-clock/auto-clock-out:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
