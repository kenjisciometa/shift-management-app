import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/time-entries
 * Get time entries with optional filters
 *
 * Query params:
 * - start_date: YYYY-MM-DD (required)
 * - end_date: YYYY-MM-DD (required)
 * - user_id: string (optional, admin/manager only)
 * - location_id: string (optional)
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
    const userIdParam = searchParams.get("user_id");
    const locationId = searchParams.get("location_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    // Determine which user's entries to fetch
    let targetUserId = user.id;
    if (userIdParam && userIdParam !== user.id) {
      // Only privileged users can view other users' entries
      if (!isPrivilegedUser(profile.role)) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
      targetUserId = userIdParam;
    }

    // Build query
    let query = supabase
      .from("time_entries")
      .select(`
        *,
        location:locations (id, name),
        user:profiles (id, first_name, last_name, avatar_url)
      `, { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .gte("timestamp", `${startDate}T00:00:00`)
      .lte("timestamp", `${endDate}T23:59:59`)
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by user if not viewing all (privileged users viewing all)
    if (!userIdParam || !isPrivilegedUser(profile.role)) {
      query = query.eq("user_id", targetUserId);
    } else if (userIdParam) {
      query = query.eq("user_id", targetUserId);
    }

    // Filter by location if specified
    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data: entries, error: fetchError, count } = await query;

    if (fetchError) {
      console.error("Error fetching time entries:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch time entries" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: entries || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/time-entries:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
