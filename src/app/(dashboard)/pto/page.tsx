import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { PTODashboard } from "@/components/pto/dashboard";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

interface SearchParams {
  year?: string;
}

export default async function PTOPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const params = await searchParams;
  const { user, profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";
  
  // Get year from search params or use current year
  const selectedYear = params.year ? parseInt(params.year) : new Date().getFullYear();
  const currentYear = new Date().getFullYear();

  const supabase = await getCachedSupabase();

  // Parallel fetch all data with error handling
  const [balancesResult, requestsResult, pendingRequestsResult, teamRequestsResult, policiesResult] = await Promise.all([
    // Get PTO balances for the current user (selected year)
    supabase
      .from("pto_balances")
      .select(`
        *,
        pto_policies (id, name, pto_type, annual_allowance, max_carryover)
      `)
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id)
      .eq("year", selectedYear)
      .order("pto_type", { ascending: true })
      .then((result) => {
        if (result.error) {
          console.error("Error fetching PTO balances:", result.error);
          return { data: [], error: null };
        }
        return result;
      }),
    // Get PTO requests for the current user (all time, but limit to recent)
    supabase
      .from("pto_requests")
      .select(`
        *,
        profiles!pto_requests_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then((result) => {
        if (result.error) {
          console.error("Error fetching PTO requests:", result.error);
          return { data: [], error: null };
        }
        return result;
      }),
    // Get pending requests for admins
    isAdmin
      ? supabase
          .from("pto_requests")
          .select(`
            *,
            profiles!pto_requests_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
          `)
          .eq("organization_id", profile.organization_id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .then((result) => {
            if (result.error) {
              console.error("Error fetching pending requests:", result.error);
              return { data: [], error: null };
            }
            return result;
          })
      : Promise.resolve({ data: [], error: null }),
    // Get team PTO requests for calendar view (approved and pending, current year)
    supabase
      .from("pto_requests")
      .select(`
        *,
        profiles!pto_requests_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .eq("organization_id", profile.organization_id)
      .in("status", ["pending", "approved"])
      .gte("end_date", new Date(currentYear, 0, 1).toISOString().split("T")[0])
      .lte("start_date", new Date(currentYear, 11, 31).toISOString().split("T")[0])
      .order("start_date", { ascending: true })
      .then((result) => {
        if (result.error) {
          console.error("Error fetching team requests:", result.error);
          return { data: [], error: null };
        }
        return result;
      }),
    // Get PTO policies for the organization
    supabase
      .from("pto_policies")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("pto_type", { ascending: true })
      .then((result) => {
        if (result.error) {
          console.error("Error fetching PTO policies:", result.error);
          return { data: [], error: null };
        }
        return result;
      }),
  ]);

  return (
    <>
      <DashboardHeader title="PTO" />
      <div className="container mx-auto p-6">
        <PTODashboard
          profile={profile}
          balances={balancesResult.data || []}
          requests={requestsResult.data || []}
          pendingRequests={pendingRequestsResult.data || []}
          teamRequests={teamRequestsResult.data || []}
          policies={policiesResult.data || []}
          isAdmin={isAdmin}
          selectedYear={selectedYear}
        />
      </div>
    </>
  );
}
