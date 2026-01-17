import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isAdminUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface UpdatePositionRequest {
  name?: string;
  color?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

/**
 * PUT /api/organization/positions/[id]
 * Update a position (admin only)
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
    const body: UpdatePositionRequest = await request.json();

    // Check position exists and belongs to organization
    const { data: existingPos, error: checkError } = await supabase
      .from("positions")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingPos) {
      return NextResponse.json(
        { error: "Position not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data: position, error: updateError } = await supabase
      .from("positions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating position:", updateError);
      return NextResponse.json(
        { error: "Failed to update position" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: position });
  } catch (error) {
    console.error("Error in PUT /api/organization/positions/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organization/positions/[id]
 * Delete a position (admin only)
 * Note: This deactivates the position rather than deleting it
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

    // Check position exists and belongs to organization
    const { data: existingPos, error: checkError } = await supabase
      .from("positions")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingPos) {
      return NextResponse.json(
        { error: "Position not found" },
        { status: 404 }
      );
    }

    // Deactivate position
    const { error: updateError } = await supabase
      .from("positions")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error deactivating position:", updateError);
      return NextResponse.json(
        { error: "Failed to delete position" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/organization/positions/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
