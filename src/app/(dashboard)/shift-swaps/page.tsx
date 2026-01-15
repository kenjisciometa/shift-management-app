import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { ShiftSwapsDashboard } from "@/components/shift-swaps/dashboard";

export default async function ShiftSwapsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile
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

  // Get user's shift swap requests
  const { data: mySwapRequests } = await supabase
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
      target:profiles!shift_swaps_target_id_fkey (
        id, first_name, last_name, display_name, avatar_url
      )
    `
    )
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false });

  // Get swap requests targeting the user
  const { data: incomingRequests } = await supabase
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
      )
    `
    )
    .eq("target_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // Get pending swap requests for admin approval
  let pendingForAdmin = null;
  if (isAdmin) {
    const { data } = await supabase
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
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    pendingForAdmin = data;
  }

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

  return (
    <>
      <DashboardHeader title="Shift Swaps" />
      <div className="container mx-auto p-6">
        <ShiftSwapsDashboard
          profile={profile}
          mySwapRequests={mySwapRequests || []}
          incomingRequests={incomingRequests || []}
          pendingForAdmin={pendingForAdmin || []}
          myShifts={myShifts || []}
          teamMembers={teamMembers || []}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
