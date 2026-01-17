import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/reports/work-hours
 * Get work hours report (admin/manager only)
 *
 * Query params:
 * - start_date: YYYY-MM-DD (required)
 * - end_date: YYYY-MM-DD (required)
 * - user_id: string (optional)
 * - department_id: string (optional)
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
    const userId = searchParams.get("user_id");
    const departmentId = searchParams.get("department_id");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    // Get time entries
    let query = supabase
      .from("time_entries")
      .select(`
        id,
        user_id,
        entry_type,
        timestamp,
        user:profiles!time_entries_user_id_fkey (
          id,
          first_name,
          last_name,
          display_name,
          department_id,
          hourly_rate
        )
      `)
      .eq("organization_id", profile.organization_id)
      .gte("timestamp", `${startDate}T00:00:00`)
      .lte("timestamp", `${endDate}T23:59:59`)
      .order("user_id")
      .order("timestamp", { ascending: true });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: entries, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching time entries:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch data" },
        { status: 500 }
      );
    }

    // Filter by department if specified
    let filteredEntries = entries || [];
    if (departmentId) {
      filteredEntries = filteredEntries.filter(
        (e) => e.user?.department_id === departmentId
      );
    }

    // Calculate hours per user
    const userHours: Record<string, {
      user_id: string;
      full_name: string;
      hourly_rate: number | null;
      total_minutes: number;
      total_break_minutes: number;
      days_worked: Set<string>;
    }> = {};

    let currentClockIn: Record<string, Date> = {};
    let currentBreakStart: Record<string, Date> = {};

    for (const entry of filteredEntries) {
      const userId = entry.user_id;
      const timestamp = new Date(entry.timestamp);
      const dateStr = entry.timestamp.split("T")[0];

      if (!userHours[userId]) {
        userHours[userId] = {
          user_id: userId,
          full_name: entry.user?.display_name || `${entry.user?.first_name || ""} ${entry.user?.last_name || ""}`.trim() || "Unknown",
          hourly_rate: entry.user?.hourly_rate || null,
          total_minutes: 0,
          total_break_minutes: 0,
          days_worked: new Set(),
        };
      }

      switch (entry.entry_type) {
        case "clock_in":
          currentClockIn[userId] = timestamp;
          userHours[userId].days_worked.add(dateStr);
          break;
        case "break_start":
          if (currentClockIn[userId]) {
            userHours[userId].total_minutes +=
              (timestamp.getTime() - currentClockIn[userId].getTime()) / 60000;
          }
          currentBreakStart[userId] = timestamp;
          break;
        case "break_end":
          if (currentBreakStart[userId]) {
            userHours[userId].total_break_minutes +=
              (timestamp.getTime() - currentBreakStart[userId].getTime()) / 60000;
          }
          currentClockIn[userId] = timestamp;
          delete currentBreakStart[userId];
          break;
        case "clock_out":
          if (currentClockIn[userId]) {
            userHours[userId].total_minutes +=
              (timestamp.getTime() - currentClockIn[userId].getTime()) / 60000;
          }
          delete currentClockIn[userId];
          delete currentBreakStart[userId];
          break;
      }
    }

    // Format result
    const report = Object.values(userHours).map((u) => ({
      user_id: u.user_id,
      full_name: u.full_name,
      hourly_rate: u.hourly_rate,
      total_hours: Math.round(u.total_minutes / 60 * 100) / 100,
      total_break_hours: Math.round(u.total_break_minutes / 60 * 100) / 100,
      days_worked: u.days_worked.size,
      estimated_pay: u.hourly_rate
        ? Math.round(u.hourly_rate * (u.total_minutes / 60) * 100) / 100
        : null,
    }));

    // Calculate totals
    const totals = {
      total_hours: report.reduce((sum, r) => sum + r.total_hours, 0),
      total_break_hours: report.reduce((sum, r) => sum + r.total_break_hours, 0),
      total_estimated_pay: report.reduce(
        (sum, r) => sum + (r.estimated_pay || 0),
        0
      ),
      employee_count: report.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        period: { start_date: startDate, end_date: endDate },
        employees: report,
        totals,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/reports/work-hours:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
