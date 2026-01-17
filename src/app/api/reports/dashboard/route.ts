import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { format } from "date-fns";

/**
 * GET /api/reports/dashboard
 * Get dashboard report data for a date range
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

    // Parse date range from query params
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get("start_date");
    const endDateStr = searchParams.get("end_date");

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    const organizationId = profile.organization_id;

    // Fetch all data in parallel
    const [
      shiftsResult,
      timeEntriesResult,
      ptoResult,
      tasksResult,
    ] = await Promise.all([
      // Shifts in date range
      supabase
        .from("shifts")
        .select("id, user_id, start_time, end_time, status")
        .eq("organization_id", organizationId)
        .gte("start_time", startDate.toISOString())
        .lte("start_time", endDate.toISOString()),
      // Time entries in date range
      supabase
        .from("time_entries")
        .select("id, user_id, entry_type, timestamp")
        .eq("organization_id", organizationId)
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", endDate.toISOString())
        .order("timestamp"),
      // PTO requests in date range
      supabase
        .from("pto_requests")
        .select("id, user_id, pto_type, total_days, status, start_date")
        .eq("organization_id", organizationId)
        .gte("start_date", format(startDate, "yyyy-MM-dd"))
        .lte("start_date", format(endDate, "yyyy-MM-dd")),
      // Tasks created in date range
      supabase
        .from("tasks")
        .select("id, status, created_at")
        .eq("organization_id", organizationId)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString()),
    ]);

    // Calculate shifts count
    const shiftsData = shiftsResult.data || [];
    const shiftsCount = shiftsData.length;

    // Calculate shift change (compare with previous period of same length)
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - periodLength);
    const prevEnd = new Date(startDate.getTime() - 1);

    const prevShiftsResult = await supabase
      .from("shifts")
      .select("id")
      .eq("organization_id", organizationId)
      .gte("start_time", prevStart.toISOString())
      .lte("start_time", prevEnd.toISOString());

    const prevShiftsCount = prevShiftsResult.data?.length || 0;
    const shiftChangePercent = prevShiftsCount > 0
      ? ((shiftsCount - prevShiftsCount) / prevShiftsCount) * 100
      : 0;

    // Calculate work hours from time entries
    const entries = timeEntriesResult.data || [];
    let workHours = 0;
    const userSessions: Record<string, { clockIn?: Date; totalHours: number }> = {};

    entries.forEach((entry) => {
      if (!userSessions[entry.user_id]) {
        userSessions[entry.user_id] = { totalHours: 0 };
      }

      if (entry.entry_type === "clock_in") {
        userSessions[entry.user_id].clockIn = new Date(entry.timestamp);
      } else if (entry.entry_type === "clock_out" && userSessions[entry.user_id].clockIn) {
        const clockIn = userSessions[entry.user_id].clockIn!;
        const clockOut = new Date(entry.timestamp);
        const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
        userSessions[entry.user_id].totalHours += hours;
        userSessions[entry.user_id].clockIn = undefined;
      }
    });

    Object.values(userSessions).forEach((session) => {
      workHours += session.totalHours;
    });
    workHours = Math.round(workHours * 10) / 10;

    // Calculate PTO data
    const ptoData = ptoResult.data || [];
    const approvedPTODays = ptoData
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + Number(r.total_days), 0);

    // PTO breakdown by type
    const ptoByType: Record<string, number> = {};
    ptoData.forEach((req) => {
      if (!ptoByType[req.pto_type]) {
        ptoByType[req.pto_type] = 0;
      }
      ptoByType[req.pto_type] += Number(req.total_days);
    });
    const ptoBreakdown = Object.entries(ptoByType).map(([type, days]) => ({ type, days }));

    // Calculate task metrics
    const tasksData = tasksResult.data || [];
    const completedTasks = tasksData.filter((t) => t.status === "completed").length;
    const totalTasks = tasksData.length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Calculate daily shift counts (max 7 days)
    const dailyShiftCounts: { day: string; shifts: number }[] = [];
    const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const maxDays = Math.min(dayCount, 7);

    for (let i = 0; i < maxDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dayStr = format(date, "yyyy-MM-dd");
      const count = shiftsData.filter((s) => {
        const shiftDate = format(new Date(s.start_time), "yyyy-MM-dd");
        return shiftDate === dayStr;
      }).length;
      dailyShiftCounts.push({
        day: format(date, "EEE"),
        shifts: count,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        shifts: {
          count: shiftsCount,
          changePercent: shiftChangePercent,
          dailyCounts: dailyShiftCounts,
        },
        workHours,
        pto: {
          approvedDays: approvedPTODays,
          breakdown: ptoBreakdown,
        },
        tasks: {
          completionRate: taskCompletionRate,
          completed: completedTasks,
          total: totalTasks,
        },
      },
    });
  } catch (error) {
    console.error("Error in GET /api/reports/dashboard:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
