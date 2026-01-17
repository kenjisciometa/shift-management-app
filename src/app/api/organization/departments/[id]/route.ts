import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isAdminUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface UpdateDepartmentRequest {
  name?: string;
  code?: string | null;
  description?: string | null;
  parent_id?: string | null;
  manager_id?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

/**
 * PUT /api/organization/departments/[id]
 * Update a department (admin only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const body: UpdateDepartmentRequest = await request.json();

    // Check department exists and belongs to organization
    const { data: existingDept, error: checkError } = await supabase
      .from("departments")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingDept) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.code !== undefined) updateData.code = body.code;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    // Validate and set manager_id
    if (body.manager_id !== undefined) {
      if (body.manager_id) {
        const { data: manager } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", body.manager_id)
          .eq("organization_id", profile.organization_id)
          .single();

        if (!manager) {
          return NextResponse.json(
            { error: "Invalid manager_id" },
            { status: 400 }
          );
        }
      }
      updateData.manager_id = body.manager_id;
    }

    // Validate and set parent_id
    if (body.parent_id !== undefined) {
      if (body.parent_id) {
        // Can't set parent to itself
        if (body.parent_id === id) {
          return NextResponse.json(
            { error: "Cannot set department as its own parent" },
            { status: 400 }
          );
        }

        const { data: parent } = await supabase
          .from("departments")
          .select("id")
          .eq("id", body.parent_id)
          .eq("organization_id", profile.organization_id)
          .single();

        if (!parent) {
          return NextResponse.json(
            { error: "Invalid parent_id" },
            { status: 400 }
          );
        }
      }
      updateData.parent_id = body.parent_id;
    }

    const { data: department, error: updateError } = await supabase
      .from("departments")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        manager:profiles!departments_manager_id_fkey (id, first_name, last_name, avatar_url),
        parent:departments!departments_parent_id_fkey (id, name)
      `)
      .single();

    if (updateError) {
      console.error("Error updating department:", updateError);
      return NextResponse.json(
        { error: "Failed to update department" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: department });
  } catch (error) {
    console.error("Error in PUT /api/organization/departments/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organization/departments/[id]
 * Delete a department (admin only)
 * Note: This deactivates the department rather than deleting it
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    // Check department exists and belongs to organization
    const { data: existingDept, error: checkError } = await supabase
      .from("departments")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingDept) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    // Check if department has active members
    const { count: memberCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("department_id", id)
      .eq("status", "active");

    if (memberCount && memberCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete department with active members" },
        { status: 400 }
      );
    }

    // Deactivate department
    const { error: updateError } = await supabase
      .from("departments")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error deactivating department:", updateError);
      return NextResponse.json(
        { error: "Failed to delete department" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/organization/departments/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
