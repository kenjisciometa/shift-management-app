import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/shifts
 * Get shifts with optional filters
 *
 * Query params:
 * - start_date: YYYY-MM-DD (required)
 * - end_date: YYYY-MM-DD (required)
 * - user_id: string (optional)
 * - location_id: string (optional)
 * - department_id: string (optional)
 * - status: 'draft' | 'published' (optional)
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
    const userId = searchParams.get("user_id");
    const locationId = searchParams.get("location_id");
    const departmentId = searchParams.get("department_id");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from("shifts")
      .select(`
        *,
        user:profiles!shifts_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
        location:locations (id, name),
        department:departments (id, name),
        position:positions (id, name, color)
      `, { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .gte("start_time", `${startDate}T00:00:00`)
      .lte("start_time", `${endDate}T23:59:59`)
      .order("start_time", { ascending: true })
      .range(offset, offset + limit - 1);

    // Non-privileged users can only see published shifts
    if (!isPrivilegedUser(profile.role)) {
      query = query.eq("is_published", true);
    } else if (status === "draft") {
      query = query.eq("is_published", false);
    } else if (status === "published") {
      query = query.eq("is_published", true);
    }

    // Apply filters
    if (userId) {
      query = query.eq("user_id", userId);
    }
    if (locationId) {
      query = query.eq("location_id", locationId);
    }
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }

    const { data: shifts, error: fetchError, count } = await query;

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
    console.error("Error in GET /api/shifts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface CreateShiftRequest {
  user_id: string;
  start_time: string;
  end_time: string;
  location_id?: string;
  department_id?: string;
  position_id?: string;
  break_minutes?: number;
  notes?: string;
  color?: string;
  is_published?: boolean;
  repeat_parent_id?: string;
}

/**
 * POST /api/shifts
 * Create a new shift (admin/manager only)
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

    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: CreateShiftRequest = await request.json();
    const {
      user_id,
      start_time,
      end_time,
      location_id,
      department_id,
      position_id,
      break_minutes,
      notes,
      color,
      is_published,
      repeat_parent_id,
    } = body;

    if (!user_id || !start_time || !end_time) {
      return NextResponse.json(
        { error: "user_id, start_time, and end_time are required" },
        { status: 400 }
      );
    }

    // Verify user belongs to organization
    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: "Invalid user_id" },
        { status: 400 }
      );
    }

    // Create shift
    const { data: shift, error: insertError } = await supabase
      .from("shifts")
      .insert({
        organization_id: profile.organization_id,
        user_id,
        start_time,
        end_time,
        location_id: location_id || null,
        department_id: department_id || null,
        position_id: position_id || null,
        break_minutes: break_minutes || 0,
        notes: notes || null,
        color: color || null,
        is_published: is_published || false,
        published_at: is_published ? new Date().toISOString() : null,
        created_by: user.id,
        repeat_parent_id: repeat_parent_id || null,
      })
      .select(`
        *,
        user:profiles!shifts_user_id_fkey (id, first_name, last_name, display_name, avatar_url),
        location:locations (id, name),
        department:departments (id, name),
        position:positions (id, name, color)
      `)
      .single();

    if (insertError) {
      console.error("Error creating shift:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Failed to create shift", code: insertError.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: shift }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/shifts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
