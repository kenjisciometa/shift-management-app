import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/reports/attendance
 * Get attendance report (admin/manager only)
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

    // Get scheduled shifts
    let shiftsQuery = supabase
      .from("shifts")
      .select(`
        id,
        user_id,
        start_time,
        end_time,
        user:profiles!shifts_user_id_fkey (
          id,
          first_name,
          last_name,
          display_name,
          department_id
        )
      `)
      .eq("organization_id", profile.organization_id)
      .eq("is_published", true)
      .gte("start_time", `${startDate}T00:00:00`)
      .lte("start_time", `${endDate}T23:59:59`);

    if (userId) {
      shiftsQuery = shiftsQuery.eq("user_id", userId);
    }

    const { data: shifts, error: shiftsError } = await shiftsQuery;

    if (shiftsError) {
      console.error("Error fetching shifts:", shiftsError);
      return NextResponse.json(
        { error: "Failed to fetch data" },
        { status: 500 }
      );
    }

    // Filter by department
    let filteredShifts = shifts || [];
    if (departmentId) {
      filteredShifts = filteredShifts.filter(
        (s) => s.user?.department_id === departmentId
      );
    }

    // Get time entries
    let entriesQuery = supabase
      .from("time_entries")
      .select("user_id, entry_type, timestamp")
      .eq("organization_id", profile.organization_id)
      .in("entry_type", ["clock_in", "clock_out"])
      .gte("timestamp", `${startDate}T00:00:00`)
      .lte("timestamp", `${endDate}T23:59:59`);

    if (userId) {
      entriesQuery = entriesQuery.eq("user_id", userId);
    }

    const { data: entries, error: entriesError } = await entriesQuery;

    if (entriesError) {
      console.error("Error fetching entries:", entriesError);
      return NextResponse.json(
        { error: "Failed to fetch data" },
        { status: 500 }
      );
    }

    // Group clock-ins by user and date
    const clockInsByUserDate: Record<string, Record<string, Date>> = {};
    for (const entry of entries || []) {
      if (entry.entry_type === "clock_in") {
        const date = entry.timestamp.split("T")[0];
        const key = `${entry.user_id}_${date}`;
        if (!clockInsByUserDate[entry.user_id]) {
          clockInsByUserDate[entry.user_id] = {};
        }
        // Take the first clock-in of the day
        if (!clockInsByUserDate[entry.user_id][date]) {
          clockInsByUserDate[entry.user_id][date] = new Date(entry.timestamp);
        }
      }
    }

    // Analyze attendance per user
    const userAttendance: Record<string, {
      user_id: string;
      full_name: string;
      scheduled_shifts: number;
      attended: number;
      missed: number;
      on_time: number;
      late: number;
      late_minutes_total: number;
    }> = {};

    const LATE_THRESHOLD_MINUTES = 5;

    for (const shift of filteredShifts) {
      const userId = shift.user_id;
      const shiftDate = shift.start_time.split("T")[0];
      const shiftStart = new Date(shift.start_time);

      if (!userAttendance[userId]) {
        userAttendance[userId] = {
          user_id: userId,
          full_name: shift.user?.display_name || `${shift.user?.first_name || ""} ${shift.user?.last_name || ""}`.trim() || "Unknown",
          scheduled_shifts: 0,
          attended: 0,
          missed: 0,
          on_time: 0,
          late: 0,
          late_minutes_total: 0,
        };
      }

      userAttendance[userId].scheduled_shifts++;

      const clockIn = clockInsByUserDate[userId]?.[shiftDate];
      if (clockIn) {
        userAttendance[userId].attended++;

        const lateMinutes = Math.max(
          0,
          (clockIn.getTime() - shiftStart.getTime()) / 60000
        );

        if (lateMinutes <= LATE_THRESHOLD_MINUTES) {
          userAttendance[userId].on_time++;
        } else {
          userAttendance[userId].late++;
          userAttendance[userId].late_minutes_total += Math.round(lateMinutes);
        }
      } else {
        // Only count as missed if shift date is in the past
        if (new Date(shiftDate) < new Date()) {
          userAttendance[userId].missed++;
        }
      }
    }

    const attendanceList = Object.values(userAttendance).map((u) => ({
      ...u,
      attendance_rate: u.scheduled_shifts > 0
        ? Math.round((u.attended / u.scheduled_shifts) * 100)
        : 0,
      on_time_rate: u.attended > 0
        ? Math.round((u.on_time / u.attended) * 100)
        : 0,
      avg_late_minutes: u.late > 0
        ? Math.round(u.late_minutes_total / u.late)
        : 0,
    }));

    // Calculate totals
    const totals = {
      total_scheduled: attendanceList.reduce((sum, a) => sum + a.scheduled_shifts, 0),
      total_attended: attendanceList.reduce((sum, a) => sum + a.attended, 0),
      total_missed: attendanceList.reduce((sum, a) => sum + a.missed, 0),
      total_late: attendanceList.reduce((sum, a) => sum + a.late, 0),
      overall_attendance_rate: 0,
      overall_on_time_rate: 0,
    };

    totals.overall_attendance_rate = totals.total_scheduled > 0
      ? Math.round((totals.total_attended / totals.total_scheduled) * 100)
      : 0;
    totals.overall_on_time_rate = totals.total_attended > 0
      ? Math.round(((totals.total_attended - totals.total_late) / totals.total_attended) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        period: { start_date: startDate, end_date: endDate },
        employees: attendanceList,
        totals,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/reports/attendance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
