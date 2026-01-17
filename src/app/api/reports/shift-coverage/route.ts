import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/reports/shift-coverage
 * Get shift coverage report (admin/manager only)
 *
 * Query params:
 * - start_date: YYYY-MM-DD (required)
 * - end_date: YYYY-MM-DD (required)
 * - location_id: string (optional)
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

    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const locationId = searchParams.get("location_id");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    // Get all shifts
    let shiftsQuery = supabase
      .from("shifts")
      .select(`
        id,
        user_id,
        start_time,
        end_time,
        location_id,
        is_published,
        location:locations (id, name)
      `)
      .eq("organization_id", profile.organization_id)
      .gte("start_time", `${startDate}T00:00:00`)
      .lte("start_time", `${endDate}T23:59:59`);

    if (locationId) {
      shiftsQuery = shiftsQuery.eq("location_id", locationId);
    }

    const { data: shifts, error: shiftsError } = await shiftsQuery;

    if (shiftsError) {
      console.error("Error fetching shifts:", shiftsError);
      return NextResponse.json(
        { error: "Failed to fetch data" },
        { status: 500 }
      );
    }

    // Get time entries to check actual attendance
    let entriesQuery = supabase
      .from("time_entries")
      .select("user_id, entry_type, timestamp, location_id")
      .eq("organization_id", profile.organization_id)
      .gte("timestamp", `${startDate}T00:00:00`)
      .lte("timestamp", `${endDate}T23:59:59`)
      .eq("entry_type", "clock_in");

    if (locationId) {
      entriesQuery = entriesQuery.eq("location_id", locationId);
    }

    const { data: clockIns, error: entriesError } = await entriesQuery;

    if (entriesError) {
      console.error("Error fetching entries:", entriesError);
      return NextResponse.json(
        { error: "Failed to fetch data" },
        { status: 500 }
      );
    }

    // Group shifts by date
    const shiftsByDate: Record<string, typeof shifts> = {};
    for (const shift of shifts || []) {
      const date = shift.start_time.split("T")[0];
      if (!shiftsByDate[date]) {
        shiftsByDate[date] = [];
      }
      shiftsByDate[date].push(shift);
    }

    // Group clock ins by date and user
    const clockInsByDate: Record<string, Set<string>> = {};
    for (const entry of clockIns || []) {
      const date = entry.timestamp.split("T")[0];
      if (!clockInsByDate[date]) {
        clockInsByDate[date] = new Set();
      }
      clockInsByDate[date].add(entry.user_id);
    }

    // Calculate coverage per date
    const dailyCoverage = Object.entries(shiftsByDate).map(([date, dateShifts]) => {
      const scheduledCount = dateShifts.length;
      const publishedCount = dateShifts.filter((s) => s.is_published).length;
      const attendedUsers = clockInsByDate[date] || new Set();

      // Count how many scheduled users actually clocked in
      const scheduledUserIds = new Set(dateShifts.map((s) => s.user_id));
      const attendedScheduled = [...scheduledUserIds].filter(
        (uid) => attendedUsers.has(uid)
      ).length;

      const coverageRate = scheduledCount > 0
        ? Math.round((attendedScheduled / scheduledCount) * 100)
        : 0;

      return {
        date,
        scheduled_shifts: scheduledCount,
        published_shifts: publishedCount,
        unique_employees_scheduled: scheduledUserIds.size,
        employees_attended: attendedScheduled,
        coverage_rate: coverageRate,
      };
    });

    // Sort by date
    dailyCoverage.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate overall stats
    const totalScheduled = dailyCoverage.reduce((sum, d) => sum + d.scheduled_shifts, 0);
    const totalAttended = dailyCoverage.reduce((sum, d) => sum + d.employees_attended, 0);
    const overallCoverage = totalScheduled > 0
      ? Math.round((totalAttended / totalScheduled) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        period: { start_date: startDate, end_date: endDate },
        daily: dailyCoverage,
        summary: {
          total_scheduled_shifts: totalScheduled,
          total_attended: totalAttended,
          overall_coverage_rate: overallCoverage,
          days_reported: dailyCoverage.length,
        },
      },
    });
  } catch (error) {
    console.error("Error in GET /api/reports/shift-coverage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
