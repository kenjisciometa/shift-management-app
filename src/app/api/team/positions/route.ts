import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

/**
 * GET /api/team/positions
 * Get all positions for the organization
 *
 * Query params:
 * - active_only: boolean (optional, default true)
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

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active_only") !== "false";

    // Build query
    let query = supabase
      .from("positions")
      .select("id, name, color, description, is_active, sort_order")
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

    return NextResponse.json({ success: true, data: positions || [] });
  } catch (error) {
    console.error("Error in GET /api/team/positions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
