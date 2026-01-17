import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

/**
 * GET /api/profile/department
 * Get the current user's department information
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

    if (!profile.department_id) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "No department assigned",
      });
    }

    // Get department details
    const { data: department, error: fetchError } = await supabase
      .from("departments")
      .select(`
        id,
        name,
        description,
        is_active,
        created_at,
        manager:profiles!departments_manager_id_fkey (id, first_name, last_name, avatar_url)
      `)
      .eq("id", profile.department_id)
      .single();

    if (fetchError) {
      console.error("Error fetching department:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch department" },
        { status: 500 }
      );
    }

    // Get department member count
    const { count: memberCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("department_id", profile.department_id)
      .eq("status", "active");

    return NextResponse.json({
      success: true,
      data: {
        ...department,
        member_count: memberCount || 0,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/profile/department:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
