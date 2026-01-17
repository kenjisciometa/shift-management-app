import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser, isAdminUser } from "@/app/api/shared/rbac";
import type { Json } from "@/types/database.types";

/**
 * GET /api/forms/templates/:id
 * Get single form template
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from("form_templates")
      .select(`
        id,
        name,
        description,
        fields,
        is_active,
        created_by,
        created_at,
        updated_at,
        creator:profiles!form_templates_created_by_fkey (
          id,
          first_name,
          last_name
        )
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Form template not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching form template:", error);
      return NextResponse.json(
        { error: "Failed to fetch form template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Error in GET /api/forms/templates/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/forms/templates/:id
 * Update form template (admin/manager only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return (
        authError ||
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, fields, is_active } = body;

    // Verify template exists and belongs to organization
    const { data: existing, error: checkError } = await supabase
      .from("form_templates")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: "Form template not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (fields !== undefined) updateData.fields = fields as Json;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from("form_templates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating form template:", error);
      return NextResponse.json(
        { error: "Failed to update form template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Error in PUT /api/forms/templates/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/forms/templates/:id
 * Delete form template (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Check for existing submissions
    const { count: submissionCount } = await supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("template_id", id);

    if (submissionCount && submissionCount > 0) {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from("form_templates")
        .update({ is_active: false })
        .eq("id", id)
        .eq("organization_id", profile.organization_id);

      if (error) {
        console.error("Error deactivating form template:", error);
        return NextResponse.json(
          { error: "Failed to deactivate form template" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Template deactivated (has existing submissions)",
      });
    }

    const { error } = await supabase
      .from("form_templates")
      .delete()
      .eq("id", id)
      .eq("organization_id", profile.organization_id);

    if (error) {
      console.error("Error deleting form template:", error);
      return NextResponse.json(
        { error: "Failed to delete form template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/forms/templates/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
