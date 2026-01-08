import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { PTODashboard } from "@/components/pto/dashboard";
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

  // Parallel fetch all data
  const [balancesResult, requestsResult, pendingRequestsResult, teamRequestsResult, policiesResult] = await Promise.all([
    // Get PTO balances for the current user
    supabase
      .from("pto_balances")
      .select(`
        *,
        pto_policies (id, name, pto_type, annual_allowance)
      `)
      .eq("user_id", user.id)
      .eq("year", currentYear),
    // Get PTO requests for the current user
    supabase
      .from("pto_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
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
      : Promise.resolve({ data: null }),
    // Get team PTO requests for calendar view (approved and pending)
    supabase
      .from("pto_requests")
      .select(`
        *,
        profiles!pto_requests_user_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .eq("organization_id", profile.organization_id)
      .in("status", ["pending", "approved"])
      .gte("end_date", new Date(currentYear, 0, 1).toISOString().split("T")[0])
      .order("start_date", { ascending: true }),
    // Get PTO policies for the organization
    supabase
      .from("pto_policies")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true),
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
        />
      </div>
    </>
  );
}
