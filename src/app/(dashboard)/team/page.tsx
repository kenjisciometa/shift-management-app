import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { TeamDashboard } from "@/components/team/dashboard";
import { getAuthData, getCachedSupabase } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function TeamPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";

  const supabase = await getCachedSupabase();
  const adminSupabase = createAdminClient();

  // Parallel fetch all data - using admin client to bypass RLS for team members
  const [teamMembersResult, invitationsResult, departmentsResult, positionsResult, locationsResult] = await Promise.all([
    // Get team members with their positions (using admin client to bypass RLS)
    adminSupabase
      .from("profiles")
      .select(`
        *,
        departments!profiles_department_id_fkey (id, name),
        user_positions (
          position_id,
          positions (*)
        )
      `)
      .eq("organization_id", profile.organization_id)
      .order("first_name"),
    // Get pending invitations (only fetch if admin)
    isAdmin
      ? supabase
          .from("employee_invitations")
          .select(`
            *,
            departments (id, name),
            profiles!employee_invitations_invited_by_fkey (
              id,
              first_name,
              last_name,
              display_name
            )
          `)
          .eq("organization_id", profile.organization_id)
          .in("status", ["pending"])
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    // Get departments for invitation form
    supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("name"),
    // Get positions
    supabase
      .from("positions")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("sort_order"),
    // Get locations
    supabase
      .from("locations")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("name"),
  ]);

  return (
    <>
      <DashboardHeader title="Team" profile={profile} />
      <div className="container mx-auto p-6">
        <TeamDashboard
          profile={profile}
          teamMembers={teamMembersResult.data || []}
          invitations={invitationsResult.data || []}
          departments={departmentsResult.data || []}
          positions={positionsResult.data || []}
          locations={locationsResult.data || []}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
