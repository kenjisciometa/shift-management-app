import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { AuditLogsDashboard } from "@/components/audit-logs/dashboard";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function AuditLogsPage() {
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

  // Get audit logs
  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select(`
      *,
      profiles!audit_logs_user_id_fkey (
        id,
        first_name,
        last_name,
        display_name
      )
    `)
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <DashboardHeader title="Audit Logs" profile={profile} />
      <div className="container mx-auto p-6">
        <AuditLogsDashboard
          auditLogs={auditLogs || []}
        />
      </div>
    </>
  );
}
