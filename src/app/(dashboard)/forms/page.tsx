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
  const [templatesResult, submissionsResult] = await Promise.all([
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
  ]);

  return (
    <>
      <DashboardHeader title="Forms" />
      <div className="container mx-auto p-6">
        <FormsDashboard
          profile={profile}
          templates={templatesResult.data || []}
          submissions={submissionsResult.data || []}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
