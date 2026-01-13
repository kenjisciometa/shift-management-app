import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ');

  // Fetch timesheet details using API route
  const timesheetResponse = await fetch(
    `${baseUrl}/api/timesheets/${id}`,
    { headers: { Cookie: cookieHeader } }
  );

  if (!timesheetResponse.ok) {
    if (timesheetResponse.status === 404) {
      notFound();
    }
    throw new Error("Failed to fetch timesheet");
  }

  const timesheetData = await timesheetResponse.json();
  const timesheet = timesheetData.data;

  // Fetch time entries for this period
  const supabase = await getCachedSupabase();
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
