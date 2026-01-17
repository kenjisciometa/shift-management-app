import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isAdminUser } from "@/app/api/shared/rbac";

/**
 * GET /api/organization/departments
 * Get all departments (admin only)
 *
 * Query params:
 * - active_only: boolean (optional, default false)
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

    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active_only") === "true";

    let query = supabase
      .from("departments")
      .select(`
        id,
        name,
        code,
        description,
        is_active,
        sort_order,
        parent_id,
        manager_id,
        created_at,
        updated_at,
        manager:profiles!departments_manager_id_fkey (id, first_name, last_name, avatar_url),
        parent:departments!departments_parent_id_fkey (id, name)
      `)
      .eq("organization_id", profile.organization_id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: departments, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching departments:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch departments" },
        { status: 500 }
      );
    }

    // Get member count for each department
    const departmentsWithCounts = await Promise.all(
      (departments || []).map(async (dept) => {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("department_id", dept.id)
          .eq("status", "active");

        return {
          ...dept,
          member_count: count || 0,
        };
      })
    );

    return NextResponse.json({ success: true, data: departmentsWithCounts });
  } catch (error) {
    console.error("Error in GET /api/organization/departments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface CreateDepartmentRequest {
  name: string;
  code?: string;
  description?: string;
  parent_id?: string;
  manager_id?: string;
  sort_order?: number;
}

/**
 * POST /api/organization/departments
 * Create a new department (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    if (!isAdminUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: CreateDepartmentRequest = await request.json();
    const { name, code, description, parent_id, manager_id, sort_order } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    // Verify manager belongs to organization if provided
    if (manager_id) {
      const { data: manager } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", manager_id)
        .eq("organization_id", profile.organization_id)
        .single();

      if (!manager) {
        return NextResponse.json(
          { error: "Invalid manager_id" },
          { status: 400 }
        );
      }
    }

    // Verify parent department belongs to organization if provided
    if (parent_id) {
      const { data: parent } = await supabase
        .from("departments")
        .select("id")
        .eq("id", parent_id)
        .eq("organization_id", profile.organization_id)
        .single();

      if (!parent) {
        return NextResponse.json(
          { error: "Invalid parent_id" },
          { status: 400 }
        );
      }
    }

    const { data: department, error: insertError } = await supabase
      .from("departments")
      .insert({
        organization_id: profile.organization_id,
        name,
        code: code || null,
        description: description || null,
        parent_id: parent_id || null,
        manager_id: manager_id || null,
        sort_order: sort_order || 0,
        is_active: true,
      })
      .select(`
        *,
        manager:profiles!departments_manager_id_fkey (id, first_name, last_name, avatar_url)
      `)
      .single();

    if (insertError) {
      console.error("Error creating department:", insertError);
      return NextResponse.json(
        { error: "Failed to create department" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: department }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/organization/departments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
