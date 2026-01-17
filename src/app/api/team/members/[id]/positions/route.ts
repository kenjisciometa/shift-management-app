import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/team/members/[id]/positions
 * Get positions assigned to a team member
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

    // Verify member belongs to organization
    const { data: member, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (checkError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("user_positions")
      .select(`
        id,
        is_primary,
        wage_rate,
        position:positions (id, name, color)
      `)
      .eq("user_id", id);

    if (error) {
      console.error("Error fetching user positions:", error);
      return NextResponse.json(
        { error: "Failed to fetch positions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error in GET /api/team/members/[id]/positions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface AssignPositionRequest {
  position_id: string;
  is_primary?: boolean;
  wage_rate?: number;
}

/**
 * POST /api/team/members/[id]/positions
 * Assign a position to a team member
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const body: AssignPositionRequest = await request.json();

    if (!body.position_id) {
      return NextResponse.json(
        { error: "position_id is required" },
        { status: 400 }
      );
    }

    // Verify member belongs to organization
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Verify position belongs to organization
    const { data: position, error: positionError } = await supabase
      .from("positions")
      .select("id")
      .eq("id", body.position_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (positionError || !position) {
      return NextResponse.json(
        { error: "Position not found" },
        { status: 404 }
      );
    }

    // Check if assignment already exists
    const { data: existing } = await supabase
      .from("user_positions")
      .select("id")
      .eq("user_id", id)
      .eq("position_id", body.position_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Position already assigned to this member" },
        { status: 400 }
      );
    }

    // Create assignment
    const { data, error } = await supabase
      .from("user_positions")
      .insert({
        user_id: id,
        position_id: body.position_id,
        is_primary: body.is_primary || false,
        wage_rate: body.wage_rate || null,
      })
      .select(`
        id,
        is_primary,
        wage_rate,
        position:positions (id, name, color)
      `)
      .single();

    if (error) {
      console.error("Error assigning position:", error);
      return NextResponse.json(
        { error: "Failed to assign position" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/team/members/[id]/positions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface BulkUpdatePositionsRequest {
  positions: { position_id: string; wage_rate?: number | null }[];
}

/**
 * PUT /api/team/members/[id]/positions
 * Bulk update positions for a team member (replaces all existing)
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
    const body: BulkUpdatePositionsRequest = await request.json();

    // Verify member belongs to organization
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Delete all existing positions
    const { error: deleteError } = await supabase
      .from("user_positions")
      .delete()
      .eq("user_id", id);

    if (deleteError) {
      console.error("Error deleting positions:", deleteError);
      return NextResponse.json(
        { error: "Failed to update positions" },
        { status: 500 }
      );
    }

    // Insert new positions
    if (body.positions && body.positions.length > 0) {
      const { error: insertError } = await supabase
        .from("user_positions")
        .insert(
          body.positions.map((pos, index) => ({
            user_id: id,
            position_id: pos.position_id,
            wage_rate: pos.wage_rate ?? null,
            is_primary: index === 0,
          }))
        );

      if (insertError) {
        console.error("Error inserting positions:", insertError);
        return NextResponse.json(
          { error: "Failed to update positions" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PUT /api/team/members/[id]/positions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/members/[id]/positions
 * Remove a position from a team member
 * Query param: position_id
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
    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get("position_id");

    if (!positionId) {
      return NextResponse.json(
        { error: "position_id query parameter is required" },
        { status: 400 }
      );
    }

    // Verify member belongs to organization
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("user_positions")
      .delete()
      .eq("user_id", id)
      .eq("position_id", positionId);

    if (error) {
      console.error("Error removing position:", error);
      return NextResponse.json(
        { error: "Failed to remove position" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/team/members/[id]/positions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
