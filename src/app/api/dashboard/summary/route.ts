import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/dashboard/summary
 * Get dashboard summary data including counts and today's entries
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const isAdmin = isPrivilegedUser(profile.role);

    // Fetch all data in parallel
    const [
      shiftsResult,
      clockedInResult,
      pendingPtoResult,
      pendingSwapsResult,
      unreadMessagesResult,
      locationsResult,
      todayEntriesResult,
    ] = await Promise.all([
      // Today's shifts count
      supabase
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("date", today),

      // Clocked in employees count
      supabase.rpc("count_clocked_in_employees", {
        org_id: profile.organization_id,
      }),

      // Pending PTO requests count
      supabase
        .from("pto_requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("status", "pending"),

      // Pending shift swaps count
      supabase
        .from("shift_swaps")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("status", "pending"),

      // Unread messages count
      supabase.rpc("count_unread_messages", {
        user_id: user.id,
      }),

      // Locations for time clock
      supabase
        .from("locations")
        .select("id, name, address")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .order("name"),

      // Today's time entries for current user
      supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("timestamp", `${today}T00:00:00`)
        .lte("timestamp", `${today}T23:59:59`)
        .order("timestamp", { ascending: true }),
    ]);

    // Build response
    const summary = {
      todayShiftsCount: shiftsResult.count || 0,
      clockedInCount: clockedInResult.data || 0,
      pendingPtoCount: isAdmin ? (pendingPtoResult.count || 0) : 0,
      pendingSwapCount: isAdmin ? (pendingSwapsResult.count || 0) : 0,
      unreadMessagesCount: unreadMessagesResult.data || 0,
      locations: locationsResult.data || [],
      userTodayEntries: todayEntriesResult.data || [],
      isAdmin,
    };

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error("Error in GET /api/dashboard/summary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
