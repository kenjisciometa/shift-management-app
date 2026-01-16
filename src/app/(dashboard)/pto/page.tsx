import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { PTOContainer } from "@/components/pto/pto-container";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function PTOPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { user, profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";
  const currentYear = new Date().getFullYear();

  const supabase = await getCachedSupabase();

  // Build requests query - fetch all requests for admins, own requests for employees
  let requestsQuery = supabase
    .from("pto_requests")
    .select(`
      *,
      profiles!pto_requests_user_id_fkey (
        id,
        first_name,
        last_name,
        display_name,
        avatar_url,
        employee_code
      )
    `)
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!isAdmin) {
    requestsQuery = requestsQuery.eq("user_id", user.id);
  }

  // Parallel fetch all data
  const [requestsResult, balancesResult, policiesResult, employeesResult] = await Promise.all([
    // Get PTO requests
    requestsQuery.then((result) => {
      if (result.error) {
        console.error("Error fetching PTO requests:", result.error);
        return { data: [], error: null };
      }
      return result;
    }),
    // Get PTO balances for the current user
    supabase
      .from("pto_balances")
      .select(`
        *,
        pto_policies (id, name, pto_type, annual_allowance, max_carryover)
      `)
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id)
      .eq("year", currentYear)
      .order("pto_type", { ascending: true })
      .then((result) => {
        if (result.error) {
          console.error("Error fetching PTO balances:", result.error);
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
    // Get employees for filter dropdown (admin only)
    isAdmin
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name, display_name")
          .eq("organization_id", profile.organization_id)
          .or("status.is.null,status.eq.active")
          .order("first_name", { ascending: true })
          .then((result) => {
            if (result.error) {
              console.error("Error fetching employees:", result.error);
              return { data: [], error: null };
            }
            return {
              data: (result.data || []).map((p) => ({
                id: p.id,
                name: p.display_name || `${p.first_name} ${p.last_name}`,
              })),
              error: null,
            };
          })
      : Promise.resolve({ data: [], error: null }),
  ]);

  return (
    <>
      <DashboardHeader title="PTO" />
      <div className="container mx-auto p-6">
        <PTOContainer
          profile={profile}
          initialRequests={requestsResult.data || []}
          initialBalances={balancesResult.data || []}
          policies={policiesResult.data || []}
          employees={employeesResult.data || []}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
