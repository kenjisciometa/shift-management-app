import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { ShiftSwapsContainer } from "@/components/shift-swaps/shift-swaps-container";
import { defaultTeamSettings, type TeamSettings } from "@/components/settings/team-settings";

export default async function ShiftSwapsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile with organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/onboarding");
  }

  const isAdmin =
    profile.role === "admin" ||
    profile.role === "owner" ||
    profile.role === "manager";

  // Get organization settings
  const { data: organization } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", profile.organization_id)
    .single();

  // Parse settings with defaults
  const settings: TeamSettings = {
    ...defaultTeamSettings,
    ...(organization?.settings as Partial<TeamSettings> || {}),
    shiftSwapSettings: {
      ...defaultTeamSettings.shiftSwapSettings,
      ...((organization?.settings as any)?.shiftSwapSettings || {}),
    },
  };

  // Build the query based on admin status
  let swapsQuery = supabase
    .from("shift_swaps")
    .select(
      `
      *,
      requester_shift:shifts!shift_swaps_requester_shift_id_fkey (
        id, start_time, end_time,
        locations (id, name),
        positions (id, name, color)
      ),
      target_shift:shifts!shift_swaps_target_shift_id_fkey (
        id, start_time, end_time,
        locations (id, name),
        positions (id, name, color)
      ),
      requester:profiles!shift_swaps_requester_id_fkey (
        id, first_name, last_name, display_name, avatar_url
      ),
      target:profiles!shift_swaps_target_id_fkey (
        id, first_name, last_name, display_name, avatar_url
      )
    `
    )
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false });

  // If not admin, only fetch user's own swaps (as requester or target)
  if (!isAdmin) {
    swapsQuery = swapsQuery.or(`requester_id.eq.${user.id},target_id.eq.${user.id}`);
  }

  const { data: allSwaps } = await swapsQuery;

  // Get user's upcoming shifts for creating swap requests
  const now = new Date().toISOString();
  const { data: myShifts } = await supabase
    .from("shifts")
    .select(
      `
      id, start_time, end_time,
      locations (id, name),
      positions (id, name, color)
    `
    )
    .eq("user_id", user.id)
    .gte("start_time", now)
    .order("start_time", { ascending: true })
    .limit(20);

  // Get team members for targeting swap requests
  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, display_name, avatar_url")
    .eq("organization_id", profile.organization_id)
    .neq("id", user.id)
    .eq("status", "active");

  // Get all employees for filter dropdown (admin only)
  const { data: allEmployees } = isAdmin
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .eq("organization_id", profile.organization_id)
        .eq("status", "active")
        .order("first_name")
    : { data: null };

  // Transform employees for dropdown
  const employees = (allEmployees || []).map((emp) => ({
    id: emp.id,
    name: emp.display_name || `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Unknown",
  }));

  return (
    <>
      <DashboardHeader title="Shift Swaps" />
      <div className="container mx-auto p-6">
        <ShiftSwapsContainer
          profile={profile}
          initialSwaps={allSwaps || []}
          myShifts={myShifts || []}
          teamMembers={teamMembers || []}
          employees={employees}
          isAdmin={isAdmin}
          settings={settings}
        />
      </div>
    </>
  );
}
