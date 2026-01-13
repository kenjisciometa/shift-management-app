import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DashboardHeader } from "@/components/dashboard/header";
import { TimesheetsDashboard } from "@/components/timesheets/dashboard";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
} from "date-fns";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ period_start?: string; period_end?: string }>;
}) {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const params = await searchParams;
  const { user, profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";

  // Get the current period (this week and last week)
  const now = new Date();
  const currentWeekStart = params.period_start
    ? new Date(params.period_start)
    : startOfWeek(now, { weekStartsOn: 0 });
  const currentWeekEnd = params.period_end
    ? new Date(params.period_end)
    : endOfWeek(now, { weekStartsOn: 0 });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const cookieHeader = cookies().toString();
  const supabase = await getCachedSupabase();

  // Fetch data using API routes for timesheets, direct Supabase for time entries
  const [timesheetsResponse, timeEntriesResult, pendingTimesheetsResponse] = await Promise.all([
    // Get user's timesheets using API route
    fetch(
      `${baseUrl}/api/timesheets?user_id=${user.id}&limit=10`,
      { headers: { Cookie: cookieHeader } }
    ).then((res) => res.json()).catch(() => ({ data: [] })),
    // Get time entries for the current period (direct Supabase since no API route exists yet)
    supabase
      .from("time_entries")
      .select(`
        *,
        locations (id, name)
      `)
      .eq("user_id", user.id)
      .gte("timestamp", lastWeekStart.toISOString())
      .lte("timestamp", currentWeekEnd.toISOString())
      .order("timestamp", { ascending: true }),
    // Get pending timesheets for admins using API route
    isAdmin
      ? fetch(
          `${baseUrl}/api/timesheets?status=submitted&limit=100`,
          { headers: { Cookie: cookieHeader } }
        ).then((res) => res.json()).catch(() => ({ data: [] }))
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <DashboardHeader title="Timesheets" />
      <div className="container mx-auto p-6">
        <TimesheetsDashboard
          profile={profile}
          timesheets={timesheetsResponse.data || []}
          timeEntries={timeEntriesResult.data || []}
          pendingTimesheets={pendingTimesheetsResponse.data || []}
          isAdmin={isAdmin}
          currentWeekStart={currentWeekStart}
          currentWeekEnd={currentWeekEnd}
        />
      </div>
    </>
  );
}
