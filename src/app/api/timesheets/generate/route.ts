import { NextResponse } from "next/server";
import { getAuthData, getCachedSupabase } from "@/lib/auth";
import type { Database } from "@/types/database.types";

type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];

/**
 * POST /api/timesheets/generate
 * Auto-generate timesheet from time entries for a given period
 */
export async function POST(request: Request) {
  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, profile } = authData;
    const body = await request.json();

    const { period_start, period_end, user_id } = body;

    // Validate required fields
    if (!period_start || !period_end) {
      return NextResponse.json(
        { error: "Missing required fields: period_start, period_end" },
        { status: 400 }
      );
    }

    const targetUserId = user_id || user.id;

    // Only allow generating timesheets for yourself unless admin
    const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";
    if (targetUserId !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await getCachedSupabase();

    // Check if timesheet already exists
    const { data: existing } = await supabase
      .from("timesheets")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("organization_id", profile.organization_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Timesheet already exists for this period" },
        { status: 409 }
      );
    }

    // Fetch time entries for the period
    const periodStartDate = new Date(period_start);
    periodStartDate.setHours(0, 0, 0, 0);
    const periodEndDate = new Date(period_end);
    periodEndDate.setHours(23, 59, 59, 999);

    const { data: timeEntries, error: entriesError } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", targetUserId)
      .eq("organization_id", profile.organization_id)
      .gte("timestamp", periodStartDate.toISOString())
      .lte("timestamp", periodEndDate.toISOString())
      .order("timestamp", { ascending: true });

    if (entriesError) {
      console.error("Error fetching time entries:", entriesError);
      return NextResponse.json({ error: "Failed to fetch time entries" }, { status: 500 });
    }

    // Calculate timesheet data from time entries
    const calculations = calculateTimesheetFromEntries(timeEntries || []);

    // Create the timesheet
    const { data: newTimesheet, error: createError } = await supabase
      .from("timesheets")
      .insert({
        organization_id: profile.organization_id,
        user_id: targetUserId,
        period_start,
        period_end,
        total_hours: calculations.totalHours,
        break_hours: calculations.breakHours,
        overtime_hours: calculations.overtimeHours,
        status: "draft",
      })
      .select(`
        *,
        profiles!timesheets_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .single();

    if (createError) {
      console.error("Error creating timesheet:", createError);
      return NextResponse.json({ error: "Failed to create timesheet" }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        data: newTimesheet,
        calculations: {
          entries_processed: timeEntries?.length || 0,
          total_hours: calculations.totalHours,
          break_hours: calculations.breakHours,
          overtime_hours: calculations.overtimeHours,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/timesheets/generate:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Calculate timesheet totals from time entries
 */
function calculateTimesheetFromEntries(entries: TimeEntry[]): {
  totalHours: number;
  breakHours: number;
  overtimeHours: number;
} {
  if (!entries || entries.length === 0) {
    return { totalHours: 0, breakHours: 0, overtimeHours: 0 };
  }

  // Group entries by day
  const entriesByDay = new Map<string, TimeEntry[]>();
  entries.forEach((entry) => {
    const date = new Date(entry.timestamp).toISOString().split("T")[0];
    if (!entriesByDay.has(date)) {
      entriesByDay.set(date, []);
    }
    entriesByDay.get(date)!.push(entry);
  });

  let totalHours = 0;
  let breakHours = 0;
  const dailyHours: number[] = [];

  // Process each day
  entriesByDay.forEach((dayEntries) => {
    const sortedEntries = dayEntries.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let clockIn: Date | null = null;
    let clockOut: Date | null = null;
    let breakStart: Date | null = null;
    let breakEnd: Date | null = null;
    let dayWorkHours = 0;
    let dayBreakHours = 0;

    sortedEntries.forEach((entry) => {
      const entryTime = new Date(entry.timestamp);

      switch (entry.entry_type) {
        case "clock_in":
          clockIn = entryTime;
          break;
        case "clock_out":
          clockOut = entryTime;
          if (clockIn) {
            const workMs = clockOut.getTime() - clockIn.getTime();
            dayWorkHours += workMs / (1000 * 60 * 60);
          }
          break;
        case "break_start":
          breakStart = entryTime;
          break;
        case "break_end":
          breakEnd = entryTime;
          if (breakStart) {
            const breakMs = breakEnd.getTime() - breakStart.getTime();
            dayBreakHours += breakMs / (1000 * 60 * 60);
          }
          break;
      }
    });

    // Subtract break time from work hours
    dayWorkHours = Math.max(0, dayWorkHours - dayBreakHours);
    totalHours += dayWorkHours;
    breakHours += dayBreakHours;
    dailyHours.push(dayWorkHours);
  });

  // Calculate overtime (assuming 8 hours/day is standard, can be configurable)
  const standardHoursPerDay = 8;
  const overtimeHours = dailyHours.reduce((sum, hours) => {
    return sum + Math.max(0, hours - standardHoursPerDay);
  }, 0);

  return {
    totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
    breakHours: Math.round(breakHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
  };
}
