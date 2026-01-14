import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { OrganizationSettings } from "@/components/organization/settings";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function OrganizationPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner";

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const supabase = await getCachedSupabase();

  // Parallel fetch all data
  const [locationsResult, departmentsResult, teamMembersResult, ptoPoliciesResult] = await Promise.all([
    // Get locations
    supabase
      .from("locations")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("name"),
    // Get departments
    supabase
      .from("departments")
      .select(`
        *,
        profiles!fk_departments_manager (
          id,
          first_name,
          last_name,
          display_name
        )
      `)
      .eq("organization_id", profile.organization_id)
      .order("sort_order"),
    // Get team members for department manager selection
    supabase
      .from("profiles")
      .select("id, first_name, last_name, display_name, role")
      .eq("organization_id", profile.organization_id)
      .eq("status", "active")
      .in("role", ["admin", "owner", "manager"])
      .order("first_name"),
    // Get PTO policies
    supabase
      .from("pto_policies")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("name"),
  ]);

  return (
    <>
      <DashboardHeader title="Organization" profile={profile} />
      <div className="container mx-auto p-6">
        <OrganizationSettings
          profile={profile}
          organization={profile.organizations!}
          locations={locationsResult.data || []}
          departments={departmentsResult.data || []}
          teamMembers={teamMembersResult.data || []}
          ptoPolicies={ptoPoliciesResult.data || []}
        />
      </div>
    </>
  );
}
