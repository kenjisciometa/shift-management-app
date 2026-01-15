import { redirect, notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { TimesheetDetail } from "@/components/timesheets/detail";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function TimesheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { id } = await params;
  const { user, profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";

  const supabase = await getCachedSupabase();

  // Fetch timesheet details directly using Supabase client
  const { data: timesheet, error: timesheetError } = await supabase
    .from("timesheets")
    .select(`
      *,
      profiles!timesheets_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (timesheetError || !timesheet) {
    notFound();
  }

  // Check if user has access (owner or admin)
  if (timesheet.user_id !== user.id && !isAdmin) {
    notFound();
  }

  // Fetch time entries for this period
  const periodStart = new Date(timesheet.period_start);
  const periodEnd = new Date(timesheet.period_end);
  periodEnd.setHours(23, 59, 59, 999);

  const { data: timeEntries } = await supabase
    .from("time_entries")
    .select(`
      *,
      locations (id, name)
    `)
    .eq("user_id", timesheet.user_id)
    .eq("organization_id", profile.organization_id)
    .gte("timestamp", periodStart.toISOString())
    .lte("timestamp", periodEnd.toISOString())
    .order("timestamp", { ascending: true });

  return (
    <>
      <DashboardHeader title="Timesheet Details" />
      <div className="container mx-auto p-6">
        <TimesheetDetail
          timesheet={timesheet}
          timeEntries={timeEntries || []}
          profile={profile}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
