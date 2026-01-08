import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { ChecklistsDashboard } from "@/components/checklists/dashboard";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function ChecklistsPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { user, profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";

  const supabase = await getCachedSupabase();

  // Parallel fetch all data
  const [checklistsResult, assignmentsResult, teamMembersResult] = await Promise.all([
    // Get checklists (templates)
    supabase
      .from("checklists")
      .select(`
        *,
        profiles!checklists_created_by_fkey (
          id,
          first_name,
          last_name,
          display_name
        )
      `)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false }),
    // Get checklist assignments for current user
    supabase
      .from("checklist_assignments")
      .select(`
        *,
        checklists (
          id,
          name,
          description,
          items
        ),
        shifts (
          id,
          start_time,
          end_time
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    // Get team members for assignment (only if admin)
    isAdmin
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name, display_name, avatar_url, role")
          .eq("organization_id", profile.organization_id)
          .eq("status", "active")
          .order("first_name")
      : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <DashboardHeader title="Checklists" />
      <div className="container mx-auto p-6">
        <ChecklistsDashboard
          profile={profile}
          checklists={checklistsResult.data || []}
          assignments={assignmentsResult.data || []}
          teamMembers={teamMembersResult.data || []}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
