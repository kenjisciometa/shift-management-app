import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

/**
 * GET /api/shifts/my
 * Get the current user's shifts
 *
 * Query params:
 * - start_date: YYYY-MM-DD (required)
 * - end_date: YYYY-MM-DD (required)
 * - limit: number (optional, default 100)
 * - offset: number (optional, default 0)
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
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    // Get user's published shifts
    const { data: shifts, error: fetchError, count } = await supabase
      .from("shifts")
      .select(`
        *,
        location:locations (id, name),
        department:departments (id, name),
        position:positions (id, name, color)
      `, { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .eq("user_id", user.id)
      .eq("is_published", true)
      .gte("start_time", `${startDate}T00:00:00`)
      .lte("start_time", `${endDate}T23:59:59`)
      .order("start_time", { ascending: true })
      .range(offset, offset + limit - 1);

    if (fetchError) {
      console.error("Error fetching shifts:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch shifts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: shifts || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/shifts/my:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
