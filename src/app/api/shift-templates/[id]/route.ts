import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/shift-templates/[id]
 * Get a specific shift template
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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
      .from("shift_templates")
      .select("*")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Shift template not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching shift template:", error);
      return NextResponse.json(
        { error: "Failed to fetch shift template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in GET /api/shift-templates/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface UpdateShiftTemplateRequest {
  name?: string;
  description?: string | null;
  start_time?: string;
  end_time?: string;
  break_minutes?: number;
  position?: string | null;
  color?: string;
  is_active?: boolean;
}

/**
 * PUT /api/shift-templates/[id]
 * Update a shift template (admin/manager only)
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

    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body: UpdateShiftTemplateRequest = await request.json();

    // Verify template exists and belongs to organization
    const { data: existing, error: checkError } = await supabase
      .from("shift_templates")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: "Shift template not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined)
      updateData.description = body.description?.trim() || null;
    if (body.start_time !== undefined) updateData.start_time = body.start_time;
    if (body.end_time !== undefined) updateData.end_time = body.end_time;
    if (body.break_minutes !== undefined)
      updateData.break_minutes = body.break_minutes;
    if (body.position !== undefined)
      updateData.position = body.position?.trim() || null;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await supabase
      .from("shift_templates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating shift template:", error);
      return NextResponse.json(
        { error: "Failed to update shift template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in PUT /api/shift-templates/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shift-templates/[id]
 * Delete a shift template (admin/manager only)
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

    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify template exists and belongs to organization
    const { data: existing, error: checkError } = await supabase
      .from("shift_templates")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: "Shift template not found" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("shift_templates")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting shift template:", error);
      return NextResponse.json(
        { error: "Failed to delete shift template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Shift template deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/shift-templates/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
