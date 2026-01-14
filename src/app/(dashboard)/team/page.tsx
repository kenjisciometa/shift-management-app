import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { TeamDashboard } from "@/components/team/dashboard";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function TeamPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";

  const supabase = await getCachedSupabase();

  // Parallel fetch all data
  const [teamMembersResult, invitationsResult, departmentsResult, positionsResult] = await Promise.all([
    // Get team members with their positions
    supabase
      .from("profiles")
      .select(`
        *,
        departments (id, name),
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
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
