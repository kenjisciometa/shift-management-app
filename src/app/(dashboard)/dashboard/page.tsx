import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/header";
import { TimeClockWidget } from "@/components/time-clock/widget";
import { getAuthData } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { startOfDay, endOfDay } from "date-fns";

export default async function DashboardPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { user, profile } = authData;
  const supabase = await createClient();
  const today = new Date();
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();

  // Get today's date range for time entries
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  const tomorrowMidnight = new Date(todayMidnight);
  tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);

  // Fetch dashboard data in parallel (including time clock data)
  const [
    todaysShiftsResult,
    clockedInResult,
    pendingPtoResult,
    pendingSwapsResult,
    unreadMessagesResult,
    locationsResult,
    todayEntriesResult,
    userTodayShiftsResult,
    orgSettingsResult,
  ] = await Promise.all([
    // Today's shifts for the organization
    supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .gte("start_time", todayStart)
      .lte("start_time", todayEnd),

    // Currently clocked in employees (users whose latest entry is not clock_out)
    supabase.rpc("count_clocked_in_employees", { org_id: profile.organization_id }),

    // Pending PTO requests
    supabase
      .from("pto_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .eq("status", "pending"),

    // Pending shift swap requests
    supabase
      .from("shift_swaps")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .eq("status", "pending"),

    // Unread messages for the current user (using RPC or raw count)
    supabase.rpc("count_unread_messages", { user_id: profile.id }),

    // Get locations assigned to the current user (for time clock)
    supabase
      .from("user_locations")
      .select(`
        location:locations!inner (*)
      `)
      .eq("user_id", user.id)
      .eq("location.is_active", true),

    // Get today's time entries for this user (for time clock)
    supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", user.id)
      .gte("timestamp", todayMidnight.toISOString())
      .lt("timestamp", tomorrowMidnight.toISOString())
      .order("timestamp", { ascending: false }),

    // Get user's shifts for today (for time clock)
    supabase
      .from("shifts")
      .select(`
        id,
        start_time,
        end_time,
        location_id,
        location:locations (id, name)
      `)
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id)
      .eq("is_published", true)
      .gte("start_time", todayStart)
      .lte("start_time", todayEnd)
      .order("start_time", { ascending: true }),

    // Get organization settings for time clock
    supabase
      .from("organizations")
      .select("settings")
      .eq("id", profile.organization_id)
      .single(),
  ]);

  const todaysShifts = todaysShiftsResult.count || 0;
  const clockedIn = clockedInResult.data || 0;
  const pendingRequests = (pendingPtoResult.count || 0) + (pendingSwapsResult.count || 0);
  const unreadMessages = unreadMessagesResult.data || 0;

  // Extract time-clock settings
  const orgSettings = (orgSettingsResult.data?.settings as Record<string, unknown>) || {};
  const timeClockSettings = {
    require_shift_for_clock_in: false,
    allow_early_clock_in_minutes: 30,
    allow_late_clock_in_minutes: 60,
    ...(orgSettings.time_clock as Record<string, unknown> || {}),
  };

  const displayName =
    profile.display_name || profile.first_name || authData.user.email;

  return (
    <>
      <DashboardHeader title="Dashboard" />
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <p className="text-muted-foreground">Welcome back, {displayName}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Time Clock Widget - Main Feature */}
          <div className="lg:col-span-2">
            <TimeClockWidget
              profile={profile}
              locations={(locationsResult.data || []).map((ul) => ul.location).filter(Boolean)}
              currentEntry={null}
              todayEntries={todayEntriesResult.data || []}
              userTodayShifts={userTodayShiftsResult.data || []}
              timeClockSettings={timeClockSettings}
            />
          </div>

          {/* Stats Cards - Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Today&apos;s Shifts</CardTitle>
                <CardDescription className="text-xs">Active shifts for today</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todaysShifts}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Clocked In</CardTitle>
                <CardDescription className="text-xs">Employees currently working</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clockedIn}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                <CardDescription className="text-xs">PTO and shift swap requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingRequests}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
                <CardDescription className="text-xs">New chat messages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unreadMessages}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
