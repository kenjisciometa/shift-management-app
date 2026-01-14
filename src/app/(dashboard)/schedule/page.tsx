import { redirect } from "next/navigation";
import { ScheduleHeader } from "@/components/schedule/schedule-header";
import { ScheduleCalendar } from "@/components/schedule/calendar";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

interface SearchParams {
  view?: string;
  date?: string;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, authData] = await Promise.all([
    searchParams,
    getAuthData(),
  ]);

  if (!authData) {
    redirect("/login");
  }

  const { user, profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";

  // Parse view and date from search params
  const view = (params.view as "week" | "month" | "day") || "month";
  const currentDate = params.date ? parseISO(params.date) : new Date();

  // Calculate date range based on view
  let startDate: Date;
  let endDate: Date;

  if (view === "month") {
    startDate = startOfMonth(currentDate);
    endDate = endOfMonth(currentDate);
  } else if (view === "day") {
    startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(currentDate);
    endDate.setHours(23, 59, 59, 999);
  } else {
    startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
    endDate = endOfWeek(currentDate, { weekStartsOn: 0 });
  }

  const supabase = await getCachedSupabase();

  // Parallel fetch all data
  const [shiftsResult, teamMembersResult, locationsResult, departmentsResult, positionsResult, ptoRequestsResult] = await Promise.all([
    // Get shifts for the date range
    (async () => {
      const query = supabase
        .from("shifts")
        .select(`
          *,
          profiles!shifts_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
          locations (id, name),
          departments (id, name)
        `)
        .eq("organization_id", profile.organization_id)
        .gte("start_time", startDate.toISOString())
        .lte("start_time", endDate.toISOString())
        .order("start_time", { ascending: true });

      if (!isAdmin) {
        query.or(`user_id.eq.${user.id},is_published.eq.true`);
      }

      return query;
    })(),
    // Get team members
    supabase
      .from("profiles")
      .select("id, first_name, last_name, display_name, avatar_url, role")
      .eq("organization_id", profile.organization_id)
      .eq("status", "active")
      .order("first_name", { ascending: true }),
    // Get locations
    supabase
      .from("locations")
      .select("id, name")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true),
    // Get departments
    supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true),
    // Get positions
    supabase
      .from("positions")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("sort_order"),
    // Get PTO requests for the date range (approved and pending only)
    supabase
      .from("pto_requests")
      .select(`
        *,
        profiles!pto_requests_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .eq("organization_id", profile.organization_id)
      .in("status", ["approved", "pending"])
      .gte("end_date", startDate.toISOString().split("T")[0])
      .lte("start_date", endDate.toISOString().split("T")[0])
      .order("start_date", { ascending: true }),
  ]);

  return (
    <>
      <ScheduleHeader isAdmin={isAdmin} />
      <div className="flex-1 overflow-hidden">
        <ScheduleCalendar
          shifts={shiftsResult.data || []}
          teamMembers={teamMembersResult.data || []}
          locations={locationsResult.data || []}
          departments={departmentsResult.data || []}
          positions={positionsResult.data || []}
          ptoRequests={ptoRequestsResult.data || []}
          currentDate={currentDate}
          view={view}
          isAdmin={isAdmin}
          currentUserId={user.id}
          organizationId={profile.organization_id}
        />
      </div>
    </>
  );
}
