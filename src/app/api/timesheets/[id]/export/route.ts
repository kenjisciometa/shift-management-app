import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";
import { format, parseISO } from "date-fns";

/**
 * GET /api/timesheets/[id]/export
 * Export timesheet as PDF or CSV
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user, profile, supabase } = await authenticateAndAuthorize(request);
    if (error || !user || !profile || !supabase) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const formatType = searchParams.get("format") || "pdf";

    // Get the timesheet
    const { data: timesheet, error: timesheetError } = await supabase
      .from("timesheets")
      .select(`
        *,
        profiles!timesheets_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (timesheetError || !timesheet) {
      return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
    }

    // Check if user has access
    const isAdmin = isPrivilegedUser(profile.role);
    if (timesheet.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get time entries for this period
    const periodStart = new Date(timesheet.period_start);
    const periodEnd = new Date(timesheet.period_end);
    periodEnd.setHours(23, 59, 59, 999);

    const { data: timeEntries } = await supabase
      .from("time_entries")
      .select(`
        *,
        locations (id, name)
      `)
      .eq("user_id", timesheet.user_id)
      .eq("organization_id", profile.organization_id)
      .gte("timestamp", periodStart.toISOString())
      .lte("timestamp", periodEnd.toISOString())
      .order("timestamp", { ascending: true });

    if (formatType === "pdf") {
      // Generate PDF HTML
      const html = generatePDFHTML(timesheet, timeEntries || []);

      // For now, return HTML that can be printed to PDF
      // In production, you might want to use a library like puppeteer or pdfkit
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `inline; filename="timesheet-${format(parseISO(timesheet.period_start), "yyyy-MM-dd")}.html"`,
        },
      });
    }

    // CSV export
    if (formatType === "csv") {
      const csv = generateCSV(timesheet, timeEntries || []);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="timesheet-${format(parseISO(timesheet.period_start), "yyyy-MM-dd")}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  } catch (error) {
    console.error("Error in GET /api/timesheets/[id]/export:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function generateCSV(timesheet: any, timeEntries: any[]): string {
  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const formatTime = (date: Date | string | null) => {
    if (!date) return "N/A";
    return format(typeof date === "string" ? parseISO(date) : date, "h:mm a");
  };

  // Calculate daily breakdown
  const dailyBreakdown: Array<{
    date: Date;
    clockIn: Date | null;
    clockOut: Date | null;
    totalWorkMinutes: number;
    totalBreakMinutes: number;
    location: string | null;
    breaks: number;
  }> = [];

  let currentClockIn: Date | null = null;
  let currentBreakStart: Date | null = null;
  const dayData: Record<string, any> = {};
  const dayBreaks: Record<string, Array<{ start: Date; end: Date }>> = {};

  timeEntries.forEach((entry) => {
    const entryTime = parseISO(entry.timestamp);
    const dateKey = format(entryTime, "yyyy-MM-dd");

    if (!dayData[dateKey]) {
      dayData[dateKey] = {
        date: entryTime,
        clockIn: null,
        clockOut: null,
        totalWorkMinutes: 0,
        totalBreakMinutes: 0,
        location: entry.locations?.name || null,
      };
      dayBreaks[dateKey] = [];
    }

    switch (entry.entry_type) {
      case "clock_in":
        currentClockIn = entryTime;
        dayData[dateKey].clockIn = entryTime;
        dayData[dateKey].location = entry.locations?.name || dayData[dateKey].location;
        break;
      case "clock_out":
        if (currentClockIn) {
          dayData[dateKey].clockOut = entryTime;
          const workMinutes = entryTime.getTime() - currentClockIn.getTime();
          const breakMinutes = dayBreaks[dateKey].reduce(
            (sum, b) => sum + (b.end.getTime() - b.start.getTime()),
            0
          ) / (1000 * 60);
          dayData[dateKey].totalWorkMinutes = (workMinutes / (1000 * 60)) - breakMinutes;
          dayData[dateKey].totalBreakMinutes = breakMinutes;
          currentClockIn = null;
        }
        break;
      case "break_start":
        currentBreakStart = entryTime;
        break;
      case "break_end":
        if (currentBreakStart) {
          dayBreaks[dateKey].push({
            start: currentBreakStart,
            end: entryTime,
          });
          currentBreakStart = null;
        }
        break;
    }
  });

  Object.values(dayData).forEach((day) => {
    dailyBreakdown.push({
      date: day.date,
      clockIn: day.clockIn,
      clockOut: day.clockOut,
      totalWorkMinutes: day.totalWorkMinutes,
      totalBreakMinutes: day.totalBreakMinutes,
      location: day.location,
      breaks: dayBreaks[format(day.date, "yyyy-MM-dd")]?.length || 0,
    });
  });

  dailyBreakdown.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate totals from daily breakdown (not stored values)
  const totalWorkMinutes = dailyBreakdown.reduce((sum, day) => sum + day.totalWorkMinutes, 0);
  const totalBreakMinutes = dailyBreakdown.reduce((sum, day) => sum + day.totalBreakMinutes, 0);
  const regularHoursLimit = 40 * 60; // 40 hours in minutes
  const overtimeMinutes = Math.max(0, totalWorkMinutes - regularHoursLimit);

  const calculatedTotals = {
    totalHours: totalWorkMinutes / 60,
    breakHours: totalBreakMinutes / 60,
    overtimeHours: overtimeMinutes / 60,
  };

  const headers = [
    "Date",
    "Day",
    "Location",
    "Clock In",
    "Clock Out",
    "Work Hours",
    "Break Hours",
    "Number of Breaks",
  ];

  const rows = dailyBreakdown.map((day) => [
    format(day.date, "yyyy-MM-dd"),
    format(day.date, "EEEE"),
    day.location || "N/A",
    day.clockIn ? formatTime(day.clockIn) : "N/A",
    day.clockOut ? formatTime(day.clockOut) : "N/A",
    formatHours(day.totalWorkMinutes / 60),
    formatHours(day.totalBreakMinutes / 60),
    String(day.breaks),
  ]);

  // Add summary
  rows.push([]);
  rows.push(["Summary"]);
  rows.push(["Employee", timesheet.profiles?.display_name || `${timesheet.profiles?.first_name} ${timesheet.profiles?.last_name}`]);
  rows.push(["Period", `${format(parseISO(timesheet.period_start), "MMM d")} - ${format(parseISO(timesheet.period_end), "MMM d, yyyy")}`]);
  rows.push(["Total Hours", formatHours(calculatedTotals.totalHours)]);
  rows.push(["Break Hours", formatHours(calculatedTotals.breakHours)]);
  rows.push(["Overtime Hours", formatHours(calculatedTotals.overtimeHours)]);
  rows.push(["Status", timesheet.status || "N/A"]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell)}"`).join(",")),
  ].join("\n");

  return csvContent;
}

function generatePDFHTML(timesheet: any, timeEntries: any[]): string {
  const employeeName = timesheet.profiles?.display_name ||
    `${timesheet.profiles?.first_name} ${timesheet.profiles?.last_name}`;
  const period = `${format(parseISO(timesheet.period_start), "MMM d")} - ${format(parseISO(timesheet.period_end), "MMM d, yyyy")}`;

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const formatTime = (date: Date | string | null) => {
    if (!date) return "N/A";
    return format(typeof date === "string" ? parseISO(date) : date, "h:mm a");
  };

  // Calculate daily breakdown (similar to detail component)
  const dailyBreakdown: Array<{
    date: Date;
    clockIn: Date | null;
    clockOut: Date | null;
    totalWorkMinutes: number;
    totalBreakMinutes: number;
    location: string | null;
  }> = [];

  let currentClockIn: Date | null = null;
  const dayData: Record<string, any> = {};
  const dayBreaks: Record<string, Array<{ start: Date; end: Date }>> = {};

  timeEntries.forEach((entry) => {
    const entryTime = parseISO(entry.timestamp);
    const dateKey = format(entryTime, "yyyy-MM-dd");

    if (!dayData[dateKey]) {
      dayData[dateKey] = {
        date: entryTime,
        clockIn: null,
        clockOut: null,
        totalWorkMinutes: 0,
        totalBreakMinutes: 0,
        location: entry.locations?.name || null,
      };
      dayBreaks[dateKey] = [];
    }

    switch (entry.entry_type) {
      case "clock_in":
        currentClockIn = entryTime;
        dayData[dateKey].clockIn = entryTime;
        dayData[dateKey].location = entry.locations?.name || dayData[dateKey].location;
        break;
      case "clock_out":
        if (currentClockIn) {
          dayData[dateKey].clockOut = entryTime;
          const workMinutes = (entryTime.getTime() - currentClockIn.getTime()) / (1000 * 60);
          const breakMinutes = (dayBreaks[dateKey].reduce(
            (sum, b) => sum + (b.end.getTime() - b.start.getTime()),
            0
          ) / (1000 * 60));
          dayData[dateKey].totalWorkMinutes = workMinutes - breakMinutes;
          dayData[dateKey].totalBreakMinutes = breakMinutes;
          currentClockIn = null;
        }
        break;
      case "break_start":
        // Will be handled by break_end
        break;
      case "break_end":
        const breakStart = timeEntries.find(
          (e) => e.entry_type === "break_start" &&
          format(parseISO(e.timestamp), "yyyy-MM-dd") === dateKey &&
          parseISO(e.timestamp) < entryTime
        );
        if (breakStart) {
          dayBreaks[dateKey].push({
            start: parseISO(breakStart.timestamp),
            end: entryTime,
          });
        }
        break;
    }
  });

  Object.values(dayData).forEach((day) => {
    dailyBreakdown.push({
      date: day.date,
      clockIn: day.clockIn,
      clockOut: day.clockOut,
      totalWorkMinutes: day.totalWorkMinutes,
      totalBreakMinutes: day.totalBreakMinutes,
      location: day.location,
    });
  });

  dailyBreakdown.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate totals from daily breakdown (not stored values)
  const totalWorkMinutes = dailyBreakdown.reduce((sum, day) => sum + day.totalWorkMinutes, 0);
  const totalBreakMinutes = dailyBreakdown.reduce((sum, day) => sum + day.totalBreakMinutes, 0);
  const regularHoursLimit = 40 * 60; // 40 hours in minutes
  const overtimeMinutes = Math.max(0, totalWorkMinutes - regularHoursLimit);

  const calculatedTotals = {
    totalHours: totalWorkMinutes / 60,
    breakHours: totalBreakMinutes / 60,
    overtimeHours: overtimeMinutes / 60,
  };

  const rowsHTML = dailyBreakdown.length > 0
    ? dailyBreakdown.map((day) => `
      <tr>
        <td>${format(day.date, "yyyy-MM-dd")}</td>
        <td>${format(day.date, "EEEE")}</td>
        <td>${day.location || "N/A"}</td>
        <td>${formatTime(day.clockIn)}</td>
        <td>${formatTime(day.clockOut)}</td>
        <td>${formatHours(day.totalWorkMinutes / 60)}</td>
        <td>${formatHours(day.totalBreakMinutes / 60)}</td>
      </tr>
    `).join("")
    : "<tr><td colspan='7'>No time entries</td></tr>";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Timesheet - ${period}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      margin-bottom: 10px;
    }
    .header {
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    .summary {
      margin-top: 20px;
      padding: 15px;
      background-color: #f9f9f9;
      border: 1px solid #ddd;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    @media print {
      body {
        padding: 0;
      }
      @page {
        margin: 1cm;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Timesheet</h1>
    <p><strong>Employee:</strong> ${employeeName}</p>
    <p><strong>Period:</strong> ${period}</p>
    <p><strong>Status:</strong> ${timesheet.status || "N/A"}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Day</th>
        <th>Location</th>
        <th>Clock In</th>
        <th>Clock Out</th>
        <th>Work Hours</th>
        <th>Break Hours</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML}
    </tbody>
  </table>

  <div class="summary">
    <h2>Summary</h2>
    <div class="summary-row">
      <span>Total Hours:</span>
      <span>${formatHours(calculatedTotals.totalHours)}</span>
    </div>
    <div class="summary-row">
      <span>Break Hours:</span>
      <span>${formatHours(calculatedTotals.breakHours)}</span>
    </div>
    <div class="summary-row">
      <span>Overtime Hours:</span>
      <span>${formatHours(calculatedTotals.overtimeHours)}</span>
    </div>
    ${timesheet.review_comment ? `
    <div class="summary-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
      <span><strong>Review Comment:</strong></span>
    </div>
    <div style="margin-top: 5px;">
      ${timesheet.review_comment}
    </div>
    ` : ""}
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>
  `;
}
