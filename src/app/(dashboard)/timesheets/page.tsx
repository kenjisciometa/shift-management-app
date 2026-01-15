import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { TimesheetsContainer } from "@/components/timesheets/timesheets-container";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function TimesheetsPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { profile } = authData;
  const isPrivileged = ["admin", "owner", "manager"].includes(profile.role || "");

  const supabase = await getCachedSupabase();

  // Fetch locations and employees for filters
  const [locationsResult, employeesResult] = await Promise.all([
    // Get locations for filter
    supabase
      .from("locations")
      .select("id, name")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("name"),
    // Get employees for filter (only for privileged users)
    isPrivileged
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name, display_name")
          .eq("organization_id", profile.organization_id)
          .eq("status", "active")
          .order("first_name")
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Transform locations for filter
  const locations = (locationsResult.data || []).map((loc) => ({
    id: loc.id,
    name: loc.name,
  }));

  // Transform employees for filter
  const employees = (employeesResult.data || []).map((emp) => ({
    id: emp.id,
    name:
      emp.display_name ||
      `${emp.first_name || ""} ${emp.last_name || ""}`.trim() ||
      "Unknown",
  }));

  // Page title based on role
  const pageTitle = isPrivileged ? "Timesheets" : "My Timesheets";

  return (
    <>
      <DashboardHeader title={pageTitle} />
      <div className="container mx-auto p-6">
        <TimesheetsContainer
          profile={profile}
          initialLocations={locations}
          initialEmployees={employees}
        />
      </div>
    </>
  );
}
