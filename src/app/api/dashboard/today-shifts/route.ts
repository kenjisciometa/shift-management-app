import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/dashboard/today-shifts
 * Get today's shifts for the user or all shifts (admin)
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

    let query = supabase
      .from("shifts")
      .select(`
        *,
        user:profiles!shifts_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
        location:locations (id, name),
        position:positions (id, name, color)
      `)
      .eq("organization_id", profile.organization_id)
      .eq("date", today)
      .order("start_time", { ascending: true });

    // Non-admin users only see their own shifts or published shifts
    if (!isAdmin) {
      query = query.or(`user_id.eq.${user.id},status.eq.published`);
    }

    const { data: shifts, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching today's shifts:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch shifts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: shifts || [] });
  } catch (error) {
    console.error("Error in GET /api/dashboard/today-shifts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
