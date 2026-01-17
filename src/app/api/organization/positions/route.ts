import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isAdminUser } from "@/app/api/shared/rbac";

/**
 * GET /api/organization/positions
 * Get all positions (admin only)
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
      .from("positions")
      .select(`
        id,
        name,
        color,
        description,
        is_active,
        sort_order,
        created_at,
        updated_at
      `)
      .eq("organization_id", profile.organization_id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: positions, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching positions:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch positions" },
        { status: 500 }
      );
    }

    // Get member count for each position
    const positionsWithCounts = await Promise.all(
      (positions || []).map(async (pos) => {
        const { count } = await supabase
          .from("user_positions")
          .select("id", { count: "exact", head: true })
          .eq("position_id", pos.id);

        return {
          ...pos,
          member_count: count || 0,
        };
      })
    );

    return NextResponse.json({ success: true, data: positionsWithCounts });
  } catch (error) {
    console.error("Error in GET /api/organization/positions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface CreatePositionRequest {
  name: string;
  color?: string;
  description?: string;
  sort_order?: number;
}

/**
 * POST /api/organization/positions
 * Create a new position (admin only)
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

    const body: CreatePositionRequest = await request.json();
    const { name, color, description, sort_order } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const { data: position, error: insertError } = await supabase
      .from("positions")
      .insert({
        organization_id: profile.organization_id,
        name,
        color: color || "#6366f1",
        description: description || null,
        sort_order: sort_order || 0,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating position:", insertError);
      return NextResponse.json(
        { error: "Failed to create position" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: position }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/organization/positions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
