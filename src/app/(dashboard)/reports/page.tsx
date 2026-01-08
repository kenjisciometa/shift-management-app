import { redirect } from "next/navigation";
import { startOfMonth, endOfMonth, subMonths, format, startOfWeek, endOfWeek } from "date-fns";
import { DashboardHeader } from "@/components/dashboard/header";
import { ReportsDashboard } from "@/components/reports/dashboard";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function ReportsPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";

  if (!isAdmin) {
    redirect("/dashboard");
  }

  // Date ranges
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 0 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 0 });

  const supabase = await getCachedSupabase();

  // Extended date range for detailed reports (last 3 months)
  const extendedStart = startOfMonth(subMonths(now, 2));

  // Parallel fetch all data
  const [
    employeeCountResult,
    shiftsThisMonthResult,
    shiftsLastMonthResult,
    timeEntriesResult,
    ptoRequestsResult,
    tasksResult,
    pendingPTOResult,
    shiftsThisWeekResult,
    allTimeEntriesResult,
    allShiftsResult,
  ] = await Promise.all([
    // Get team member count
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .eq("status", "active"),
    // Get shifts this month
    supabase
      .from("shifts")
      .select("id, user_id, start_time, end_time, status")
      .eq("organization_id", profile.organization_id)
      .gte("start_time", thisMonthStart.toISOString())
      .lte("start_time", thisMonthEnd.toISOString()),
    // Get shifts last month for comparison
    supabase
      .from("shifts")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .gte("start_time", lastMonthStart.toISOString())
      .lte("start_time", lastMonthEnd.toISOString()),
    // Get time entries this month
    supabase
      .from("time_entries")
      .select("id, user_id, entry_type, timestamp")
      .eq("organization_id", profile.organization_id)
      .gte("timestamp", thisMonthStart.toISOString())
      .lte("timestamp", thisMonthEnd.toISOString())
      .order("timestamp"),
    // Get PTO requests this month
    supabase
      .from("pto_requests")
      .select("id, user_id, pto_type, total_days, status, start_date")
      .eq("organization_id", profile.organization_id)
      .gte("start_date", format(thisMonthStart, "yyyy-MM-dd"))
      .lte("start_date", format(thisMonthEnd, "yyyy-MM-dd")),
    // Get tasks
    supabase
      .from("tasks")
      .select("id, status, created_at")
      .eq("organization_id", profile.organization_id),
    // Get pending PTO requests
    supabase
      .from("pto_requests")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .eq("status", "pending"),
    // Get shifts this week for daily breakdown
    supabase
      .from("shifts")
      .select("id, start_time, user_id")
      .eq("organization_id", profile.organization_id)
      .gte("start_time", thisWeekStart.toISOString())
      .lte("start_time", thisWeekEnd.toISOString()),
    // Get all time entries for work hours report (last 3 months)
    supabase
      .from("time_entries")
      .select(`
        id, user_id, entry_type, timestamp,
        profiles!time_entries_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
        locations (id, name)
      `)
      .eq("organization_id", profile.organization_id)
      .gte("timestamp", extendedStart.toISOString())
      .order("timestamp"),
    // Get all shifts for coverage report (last 3 months)
    supabase
      .from("shifts")
      .select(`
        id, user_id, start_time, end_time, status,
        profiles!shifts_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
        locations (id, name)
      `)
      .eq("organization_id", profile.organization_id)
      .gte("start_time", extendedStart.toISOString())
      .order("start_time"),
  ]);

  const shiftsThisMonth = shiftsThisMonthResult.data;
  const shiftsLastMonth = shiftsLastMonthResult.data;
  const timeEntriesThisMonth = timeEntriesResult.data;
  const ptoRequestsThisMonth = ptoRequestsResult.data;
  const tasks = tasksResult.data;
  const shiftsThisWeek = shiftsThisWeekResult.data;

  // Calculate metrics
  const totalShiftsThisMonth = shiftsThisMonth?.length || 0;
  const totalShiftsLastMonth = shiftsLastMonth?.length || 0;
  const shiftChangePercent = totalShiftsLastMonth > 0
    ? ((totalShiftsThisMonth - totalShiftsLastMonth) / totalShiftsLastMonth) * 100
    : 0;

  // Calculate total work hours from time entries
  let totalWorkHours = 0;
  const userSessions: Record<string, { clockIn?: Date; totalHours: number }> = {};

  timeEntriesThisMonth?.forEach((entry) => {
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
    totalWorkHours += session.totalHours;
  });

  // Calculate PTO days
  const approvedPTODays = ptoRequestsThisMonth
    ?.filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + Number(r.total_days), 0) || 0;

  // Task completion rate
  const completedTasks = tasks?.filter((t) => t.status === "completed").length || 0;
  const totalTasks = tasks?.length || 0;
  const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Daily shift counts for the week
  const dailyShiftCounts: { day: string; shifts: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(thisWeekStart);
    date.setDate(date.getDate() + i);
    const dayStr = format(date, "yyyy-MM-dd");
    const count = shiftsThisWeek?.filter((s) => {
      const shiftDate = format(new Date(s.start_time), "yyyy-MM-dd");
      return shiftDate === dayStr;
    }).length || 0;
    dailyShiftCounts.push({
      day: format(date, "EEE"),
      shifts: count,
    });
  }

  // PTO by type
  const ptoByType: Record<string, number> = {};
  ptoRequestsThisMonth?.forEach((req) => {
    if (!ptoByType[req.pto_type]) {
      ptoByType[req.pto_type] = 0;
    }
    ptoByType[req.pto_type] += Number(req.total_days);
  });

  const ptoBreakdown = Object.entries(ptoByType).map(([type, days]) => ({
    type,
    days,
  }));

  return (
    <>
      <DashboardHeader title="Reports" profile={profile} />
      <div className="container mx-auto p-6">
        <ReportsDashboard
          totalEmployees={employeeCountResult.count || 0}
          totalShiftsThisMonth={totalShiftsThisMonth}
          shiftChangePercent={shiftChangePercent}
          totalWorkHours={Math.round(totalWorkHours * 10) / 10}
          approvedPTODays={approvedPTODays}
          pendingPTOCount={pendingPTOResult.count || 0}
          taskCompletionRate={Math.round(taskCompletionRate)}
          completedTasks={completedTasks}
          totalTasks={totalTasks}
          dailyShiftCounts={dailyShiftCounts}
          ptoBreakdown={ptoBreakdown}
          timeEntries={allTimeEntriesResult.data || []}
          shifts={allShiftsResult.data || []}
          organizationId={profile.organization_id}
        />
      </div>
    </>
  );
}
