import { redirect } from "next/navigation";
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

  const supabase = await getCachedSupabase();

  // Fetch data directly from Supabase instead of API routes for better performance
  const [timesheetsResult, timeEntriesResult, pendingTimesheetsResult] = await Promise.all([
    // Get user's timesheets directly from Supabase
    supabase
      .from("timesheets")
      .select("*")
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id)
      .order("period_start", { ascending: false })
      .limit(10),
    // Get time entries for the current period
    supabase
      .from("time_entries")
      .select(`
        *,
        locations (id, name)
      `)
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id)
      .gte("timestamp", lastWeekStart.toISOString())
      .lte("timestamp", currentWeekEnd.toISOString())
      .order("timestamp", { ascending: true }),
    // Get pending timesheets for admins
    isAdmin
      ? supabase
          .from("timesheets")
          .select(`
            *,
            profiles!timesheets_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
          `)
          .eq("organization_id", profile.organization_id)
          .eq("status", "submitted")
          .order("submitted_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);

  return (
    <>
      <DashboardHeader title="Timesheets" />
      <div className="container mx-auto p-6">
        <TimesheetsDashboard
          profile={profile}
          timesheets={timesheetsResult.data || []}
          timeEntries={timeEntriesResult.data || []}
          pendingTimesheets={pendingTimesheetsResult.data || []}
          isAdmin={isAdmin}
          currentWeekStart={currentWeekStart}
          currentWeekEnd={currentWeekEnd}
        />
      </div>
    </>
  );
}
