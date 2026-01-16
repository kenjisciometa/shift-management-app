import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { FormsDashboard } from "@/components/forms/dashboard";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function FormsPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { user, profile } = authData;
  const isAdmin = profile.role === "admin" || profile.role === "owner" || profile.role === "manager";

  const supabase = await getCachedSupabase();

  // Parallel fetch all data
  const [templatesResult, mySubmissionsResult, allSubmissionsResult] = await Promise.all([
    // Get form templates
    supabase
      .from("form_templates")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    // Get user's form submissions
    supabase
      .from("form_submissions")
      .select(`
        *,
        form_templates (id, name)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    // Get all submissions for admins
    isAdmin
      ? supabase
          .from("form_submissions")
          .select(`
            *,
            form_templates (id, name),
            profiles (id, first_name, last_name, display_name, avatar_url)
          `)
          .eq("organization_id", profile.organization_id)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <DashboardHeader title="Forms" />
      <div className="container mx-auto p-6">
        <FormsDashboard
          profile={profile}
          templates={templatesResult.data || []}
          mySubmissions={mySubmissionsResult.data || []}
          allSubmissions={allSubmissionsResult.data || []}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
