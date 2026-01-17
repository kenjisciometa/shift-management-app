import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

/**
 * GET /api/time-clock/status
 * Get current time clock status for the user
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

    const today = new Date().toISOString().split("T")[0];

    // Get today's time entries
    const { data: entries, error: fetchError } = await supabase
      .from("time_entries")
      .select(`
        *,
        location:locations (id, name)
      `)
      .eq("user_id", user.id)
      .gte("timestamp", `${today}T00:00:00`)
      .lte("timestamp", `${today}T23:59:59`)
      .order("timestamp", { ascending: true });

    if (fetchError) {
      console.error("Error fetching time entries:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch status" },
        { status: 500 }
      );
    }

    // Determine current status based on entries
    let status: "not_clocked_in" | "clocked_in" | "on_break" = "not_clocked_in";
    let lastEntry = null;

    if (entries && entries.length > 0) {
      lastEntry = entries[entries.length - 1];

      switch (lastEntry.entry_type) {
        case "clock_in":
          status = "clocked_in";
          break;
        case "break_start":
          status = "on_break";
          break;
        case "break_end":
          status = "clocked_in";
          break;
        case "clock_out":
          status = "not_clocked_in";
          break;
      }
    }

    // Calculate total worked time and break time
    let totalWorkedMinutes = 0;
    let totalBreakMinutes = 0;
    let clockInTime: Date | null = null;
    let breakStartTime: Date | null = null;

    for (const entry of entries || []) {
      const entryTime = new Date(entry.timestamp);

      switch (entry.entry_type) {
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
          if (breakStartTime) {
            totalBreakMinutes += (entryTime.getTime() - breakStartTime.getTime()) / 60000;
          }
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

    // If still clocked in, add time until now
    if (status === "clocked_in" && clockInTime) {
      totalWorkedMinutes += (Date.now() - clockInTime.getTime()) / 60000;
    }

    // If on break, add break time until now
    if (status === "on_break" && breakStartTime) {
      totalBreakMinutes += (Date.now() - breakStartTime.getTime()) / 60000;
    }

    return NextResponse.json({
      success: true,
      data: {
        status,
        lastEntry,
        entries: entries || [],
        totalWorkedMinutes: Math.round(totalWorkedMinutes),
        totalBreakMinutes: Math.round(totalBreakMinutes),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/time-clock/status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
