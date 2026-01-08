import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { TimesheetsDashboard } from "@/components/timesheets/dashboard";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
} from "date-fns";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function TimesheetsPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { user, profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";

  // Get the current period (this week and last week)
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
  const currentWeekEnd = endOfWeek(now, { weekStartsOn: 0 });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });

  const supabase = await getCachedSupabase();

  // Parallel fetch all data
  const [timesheetsResult, timeEntriesResult, pendingTimesheetsResult] = await Promise.all([
    // Get user's timesheets
    supabase
      .from("timesheets")
      .select("*")
      .eq("user_id", user.id)
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
      : Promise.resolve({ data: null }),
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
