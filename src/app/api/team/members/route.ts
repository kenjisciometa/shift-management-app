import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/team/members
 * Get team members list (admin/manager only for full list)
 *
 * Query params:
 * - status: 'active' | 'inactive' | 'all' (optional, default 'active')
 * - department_id: string (optional)
 * - role: string (optional)
 * - search: string (optional, searches name/email)
 * - limit: number (optional, default 50)
 * - offset: number (optional, default 0)
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

    // Only privileged users can view full team list
    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";
    const departmentId = searchParams.get("department_id");
    const role = searchParams.get("role");
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("profiles")
      .select(`
        id,
        email,
        first_name,
        last_name,
        display_name,
        avatar_url,
        phone,
        role,
        status,
        hire_date,
        employee_code,
        employment_type,
        hourly_rate,
        department_id,
        created_at,
        department:departments!profiles_department_id_fkey (id, name),
        user_positions (
          id,
          is_primary,
          wage_rate,
          position:positions (id, name, color)
        )
      `, { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .order("first_name", { ascending: true })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status !== "all") {
      query = query.eq("status", status);
    }

    // Filter by department
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }

    // Filter by role
    if (role) {
      query = query.eq("role", role);
    }

    // Search by name or email
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: members, error: fetchError, count } = await query;

    if (fetchError) {
      console.error("Error fetching team members:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch team members" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: members || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/team/members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
