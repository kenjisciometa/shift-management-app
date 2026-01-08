import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { TimeClockWidget } from "@/components/time-clock/widget";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function TimeClockPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { user, profile } = authData;

  const supabase = await getCachedSupabase();

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Parallel fetch all data
  const [locationsResult, todayEntriesResult] = await Promise.all([
    // Get locations for the organization
    supabase
      .from("locations")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true),
    // Get today's time entries for this user
    supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", user.id)
      .gte("timestamp", today.toISOString())
      .lt("timestamp", tomorrow.toISOString())
      .order("timestamp", { ascending: false }),
  ]);

  return (
    <>
      <DashboardHeader title="Time Clock" />
      <div className="container mx-auto p-6">
        <TimeClockWidget
          profile={profile}
          locations={locationsResult.data || []}
          currentEntry={null}
          todayEntries={todayEntriesResult.data || []}
        />
      </div>
    </>
  );
}
