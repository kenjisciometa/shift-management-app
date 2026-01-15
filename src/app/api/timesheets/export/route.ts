import { NextRequest, NextResponse } from "next/server";
import { getAuthData, getCachedSupabase } from "@/lib/auth";
import { format } from "date-fns";

const PRIVILEGED_ROLES = ["admin", "owner", "manager"];

interface TimeEntryRow {
  id: string;
  user_id: string;
  timestamp: string;
  entry_type: string;
  location_id: string | null;
  notes: string | null;
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
  } | null;
  locations: {
    id: string;
    name: string;
  } | null;
}

/**
 * GET /api/timesheets/export
 * Export timesheet data as CSV
 */
export async function GET(request: NextRequest) {
  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, profile } = authData;
    const isPrivileged = PRIVILEGED_ROLES.includes(profile.role || "");

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const statusFilter = searchParams.get("status");
    const employeeId = searchParams.get("employee_id");
    const locationId = searchParams.get("location_id");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    const supabase = await getCachedSupabase();

    // Build query
    let query = supabase
      .from("time_entries")
      .select(`
        id,
        user_id,
        timestamp,
        entry_type,
        location_id,
        notes,
        profiles!time_entries_user_id_fkey (
          id,
          first_name,
          last_name,
          display_name
        ),
        locations (
          id,
          name
        )
      `)
      .eq("organization_id", profile.organization_id)
      .gte("timestamp", `${startDate}T00:00:00`)
      .lte("timestamp", `${endDate}T23:59:59`);

    // Apply role-based filtering
    if (!isPrivileged) {
      query = query.eq("user_id", user.id);
    } else if (employeeId && employeeId !== "all") {
      query = query.eq("user_id", employeeId);
    }

    // Apply location filter
    if (locationId && locationId !== "all") {
      query = query.eq("location_id", locationId);
    }

    const { data: timeEntries, error } = await query;

    if (error) {
      console.error("Error fetching time entries:", error);
      return NextResponse.json(
        { error: "Failed to fetch data" },
        { status: 500 }
      );
    }

    // Process time entries into rows
    const rows = processTimeEntriesForExport(timeEntries as TimeEntryRow[] || [], statusFilter);

    // Generate CSV content
    const csvContent = generateCSV(rows);

    // Return CSV file
    const filename = `timesheets_${startDate}_${endDate}.csv`;
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting timesheets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Process time entries into export rows
 */
function processTimeEntriesForExport(
  timeEntries: TimeEntryRow[],
  statusFilter: string | null
): ExportRow[] {
  // Group entries by user and date
  const grouped = new Map<string, TimeEntryRow[]>();

  for (const entry of timeEntries) {
    const date = entry.timestamp.split("T")[0];
    const key = `${entry.user_id}_${date}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  }

  // Convert groups to export rows
  const rows: ExportRow[] = [];

  for (const [key, entries] of grouped) {
    const [, date] = key.split("_");
    const firstEntry = entries[0];

    // Find specific entry types
    const clockIn = entries.find((e) => e.entry_type === "clock_in");
    const clockOut = entries.find((e) => e.entry_type === "clock_out");
    const breakStart = entries.find((e) => e.entry_type === "break_start");
    const breakEnd = entries.find((e) => e.entry_type === "break_end");

    // Calculate times
    const clockInTime = clockIn
      ? format(new Date(clockIn.timestamp), "HH:mm")
      : "";
    const clockOutTime = clockOut
      ? format(new Date(clockOut.timestamp), "HH:mm")
      : "";
    const breakStartTime = breakStart
      ? format(new Date(breakStart.timestamp), "HH:mm")
      : "";
    const breakEndTime = breakEnd
      ? format(new Date(breakEnd.timestamp), "HH:mm")
      : "";

    // Calculate durations
    let shiftMinutes = 0;
    let breakMinutes = 0;

    if (clockIn && clockOut) {
      const inTime = new Date(clockIn.timestamp).getTime();
      const outTime = new Date(clockOut.timestamp).getTime();
      shiftMinutes = Math.round((outTime - inTime) / 60000);
    }

    if (breakStart && breakEnd) {
      const startTime = new Date(breakStart.timestamp).getTime();
      const endTime = new Date(breakEnd.timestamp).getTime();
      breakMinutes = Math.round((endTime - startTime) / 60000);
    }

    const workMinutes = shiftMinutes - breakMinutes;

    // Get employee name
    const empProfile = firstEntry.profiles;
    const name = empProfile?.display_name ||
      `${empProfile?.first_name || ""} ${empProfile?.last_name || ""}`.trim() ||
      "Unknown";

    // Get location
    const location = firstEntry.locations;
    const locationName = location?.name || "";

    // Check for auto clock-out
    const autoClockOut = clockOut?.notes?.includes("auto") ? "Yes" : "No";

    // Determine status (placeholder)
    const status = "Pending";

    // Apply status filter
    if (statusFilter && statusFilter !== "all" && status.toLowerCase() !== statusFilter) {
      continue;
    }

    rows.push({
      name,
      date: format(new Date(date), "yyyy-MM-dd"),
      locations: locationName,
      positions: "",
      clockInTime,
      clockOutTime,
      autoClockOut,
      breakDuration: formatDuration(breakMinutes),
      breakStart: breakStartTime,
      breakEnd: breakEndTime,
      shiftDuration: formatDuration(workMinutes),
      scheduleShiftDuration: "",
      difference: formatDuration(workMinutes),
      status,
    });
  }

  // Sort by name then date
  rows.sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) return nameCompare;
    return a.date.localeCompare(b.date);
  });

  return rows;
}

interface ExportRow {
  name: string;
  date: string;
  locations: string;
  positions: string;
  clockInTime: string;
  clockOutTime: string;
  autoClockOut: string;
  breakDuration: string;
  breakStart: string;
  breakEnd: string;
  shiftDuration: string;
  scheduleShiftDuration: string;
  difference: string;
  status: string;
}

/**
 * Format minutes to HH:mm string
 */
function formatDuration(minutes: number): string {
  if (minutes === 0) return "0:00";
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  return `${sign}${hours}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Generate CSV content from rows
 */
function generateCSV(rows: ExportRow[]): string {
  const headers = [
    "Name",
    "Date",
    "Locations",
    "Positions",
    "Clock In Time",
    "Clock Out Time",
    "Auto Clock-out",
    "Break Duration",
    "Break Start",
    "Break End",
    "Shift Duration",
    "Schedule Shift Duration",
    "Difference",
    "Status",
  ];

  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      [
        escapeCSV(row.name),
        row.date,
        escapeCSV(row.locations),
        escapeCSV(row.positions),
        row.clockInTime,
        row.clockOutTime,
        row.autoClockOut,
        row.breakDuration,
        row.breakStart,
        row.breakEnd,
        row.shiftDuration,
        row.scheduleShiftDuration,
        row.difference,
        row.status,
      ].join(",")
    ),
  ];

  return csvRows.join("\n");
}

/**
 * Escape CSV field value
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
