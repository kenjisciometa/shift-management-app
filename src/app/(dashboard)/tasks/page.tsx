import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { TasksDashboard } from "@/components/tasks/dashboard";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function TasksPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";

  const supabase = await getCachedSupabase();

  // Parallel fetch all data
  const [tasksResult, teamMembersResult] = await Promise.all([
    // Get tasks with assignments
    supabase
      .from("tasks")
      .select(`
        *,
        task_assignments (
          id,
          user_id,
          assigned_by,
          created_at,
          profiles!task_assignments_user_id_fkey (
            id,
            first_name,
            last_name,
            display_name,
            avatar_url
          )
        ),
        profiles!tasks_created_by_fkey (
          id,
          first_name,
          last_name,
          display_name
        )
      `)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false }),
    // Get team members for assignment
    supabase
      .from("profiles")
      .select("id, first_name, last_name, display_name, avatar_url, role")
      .eq("organization_id", profile.organization_id)
      .eq("status", "active")
      .order("first_name"),
  ]);

  return (
    <>
      <DashboardHeader title="Tasks" />
      <div className="container mx-auto p-6">
        <TasksDashboard
          profile={profile}
          tasks={tasksResult.data || []}
          teamMembers={teamMembersResult.data || []}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
