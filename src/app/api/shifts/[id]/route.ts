import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/shifts/[id]
 * Get a specific shift
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

    let query = supabase
      .from("shifts")
      .select(`
        *,
        user:profiles!shifts_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
        location:locations (id, name),
        department:departments (id, name),
        position:positions (id, name, color),
        created_by_user:profiles!shifts_created_by_fkey (id, first_name, last_name)
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id);

    // Non-privileged users can only see published shifts or their own
    if (!isPrivilegedUser(profile.role)) {
      query = query.or(`is_published.eq.true,user_id.eq.${user.id}`);
    }

    const { data: shift, error: fetchError } = await query.single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Shift not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching shift:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch shift" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: shift });
  } catch (error) {
    console.error("Error in GET /api/shifts/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface UpdateShiftRequest {
  user_id?: string;
  start_time?: string;
  end_time?: string;
  location_id?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  break_minutes?: number;
  notes?: string | null;
  color?: string | null;
  is_published?: boolean;
}

/**
 * PUT /api/shifts/[id]
 * Update a shift (admin/manager only)
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
    const body: UpdateShiftRequest = await request.json();

    // Check shift exists and belongs to organization
    const { data: existingShift, error: checkError } = await supabase
      .from("shifts")
      .select("id, is_published")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingShift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.user_id !== undefined) {
      // Verify user belongs to organization
      const { data: targetUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", body.user_id)
        .eq("organization_id", profile.organization_id)
        .single();

      if (!targetUser) {
        return NextResponse.json(
          { error: "Invalid user_id" },
          { status: 400 }
        );
      }
      updateData.user_id = body.user_id;
    }

    if (body.start_time !== undefined) updateData.start_time = body.start_time;
    if (body.end_time !== undefined) updateData.end_time = body.end_time;
    if (body.location_id !== undefined) updateData.location_id = body.location_id;
    if (body.department_id !== undefined) updateData.department_id = body.department_id;
    if (body.position_id !== undefined) updateData.position_id = body.position_id;
    if (body.break_minutes !== undefined) updateData.break_minutes = body.break_minutes;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.color !== undefined) updateData.color = body.color;

    if (body.is_published !== undefined) {
      updateData.is_published = body.is_published;
      if (body.is_published && !existingShift.is_published) {
        updateData.published_at = new Date().toISOString();
      }
    }

    // Update shift
    const { data: shift, error: updateError } = await supabase
      .from("shifts")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        user:profiles!shifts_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
        location:locations (id, name),
        department:departments (id, name),
        position:positions (id, name, color)
      `)
      .single();

    if (updateError) {
      console.error("Error updating shift:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update shift", code: updateError.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: shift });
  } catch (error) {
    console.error("Error in PUT /api/shifts/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shifts/[id]
 * Delete a shift (admin/manager only)
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

    // Check shift exists and belongs to organization
    const { data: existingShift, error: checkError } = await supabase
      .from("shifts")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !existingShift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    // Delete shift
    const { error: deleteError } = await supabase
      .from("shifts")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting shift:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete shift" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/shifts/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
