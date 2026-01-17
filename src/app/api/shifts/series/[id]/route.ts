import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/shifts/series/[id]
 * Get all shifts in a series (including the parent and all children)
 *
 * Query params:
 * - is_published: boolean (optional) - filter by published status
 * - count_only: boolean (optional) - if true, only return count
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
    const { searchParams } = new URL(request.url);
    const isPublished = searchParams.get("is_published");
    const countOnly = searchParams.get("count_only") === "true";

    // First, find the shift to determine the series group
    const { data: shift, error: shiftError } = await supabase
      .from("shifts")
      .select("id, repeat_parent_id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    // Determine the repeat group ID
    const repeatGroupId = shift.repeat_parent_id || shift.id;

    // Build query for all shifts in the series
    let query = supabase
      .from("shifts")
      .select(countOnly ? "id" : "*", { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .or(`repeat_parent_id.eq.${repeatGroupId},id.eq.${repeatGroupId}`);

    if (isPublished !== null) {
      query = query.eq("is_published", isPublished === "true");
    }

    const { data: shifts, error, count } = await query;

    if (error) {
      console.error("Error fetching series shifts:", error);
      return NextResponse.json(
        { error: "Failed to fetch series shifts" },
        { status: 500 }
      );
    }

    if (countOnly) {
      return NextResponse.json({
        success: true,
        data: {
          count: count || 0,
          shift_ids: shifts?.map((s) => s.id) || [],
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: shifts || [],
      count: count || 0,
    });
  } catch (error) {
    console.error("Error in GET /api/shifts/series/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shifts/series/[id]
 * Delete all shifts in a series
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

    // Find the shift to determine the series group
    const { data: shift, error: shiftError } = await supabase
      .from("shifts")
      .select("id, repeat_parent_id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    const repeatGroupId = shift.repeat_parent_id || shift.id;

    // Delete all shifts in the series
    const { error: deleteError } = await supabase
      .from("shifts")
      .delete()
      .eq("organization_id", profile.organization_id)
      .or(`repeat_parent_id.eq.${repeatGroupId},id.eq.${repeatGroupId}`);

    if (deleteError) {
      console.error("Error deleting series:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete series" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Series deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/shifts/series/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface PublishSeriesRequest {
  is_published: boolean;
}

/**
 * PUT /api/shifts/series/[id]
 * Update all shifts in a series (e.g., publish all)
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
    const body: PublishSeriesRequest = await request.json();

    // Find the shift to determine the series group
    const { data: shift, error: shiftError } = await supabase
      .from("shifts")
      .select("id, repeat_parent_id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    const repeatGroupId = shift.repeat_parent_id || shift.id;

    const updateData: Record<string, unknown> = {
      is_published: body.is_published,
      status: body.is_published ? "published" : "draft",
    };

    if (body.is_published) {
      updateData.published_at = new Date().toISOString();
    }

    // Update all unpublished shifts in the series
    const { error: updateError, count } = await supabase
      .from("shifts")
      .update(updateData)
      .eq("organization_id", profile.organization_id)
      .or(`repeat_parent_id.eq.${repeatGroupId},id.eq.${repeatGroupId}`)
      .eq("is_published", false);

    if (updateError) {
      console.error("Error updating series:", updateError);
      return NextResponse.json(
        { error: "Failed to update series" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${count || 0} shifts in series`,
      updated_count: count || 0,
    });
  } catch (error) {
    console.error("Error in PUT /api/shifts/series/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
