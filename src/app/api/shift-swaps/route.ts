import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * GET /api/shift-swaps
 * Get shift swap requests
 *
 * Query params:
 * - status: 'pending' | 'target_accepted' | 'approved' | 'rejected' | 'cancelled' | 'all' (optional)
 * - start_date: YYYY-MM-DD (optional)
 * - end_date: YYYY-MM-DD (optional)
 * - user_id: string (optional, admin/manager only)
 * - limit: number (optional, default 20)
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
    const status = searchParams.get("status");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const userIdParam = searchParams.get("user_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("shift_swaps")
      .select(`
        *,
        requester:profiles!shift_swaps_requester_id_fkey (id, first_name, last_name, display_name, avatar_url),
        target:profiles!shift_swaps_target_id_fkey (id, first_name, last_name, display_name, avatar_url),
        requester_shift:shifts!shift_swaps_requester_shift_id_fkey (
          id, start_time, end_time,
          location:locations (id, name),
          position:positions (id, name, color)
        ),
        target_shift:shifts!shift_swaps_target_shift_id_fkey (
          id, start_time, end_time,
          location:locations (id, name),
          position:positions (id, name, color)
        ),
        reviewer:profiles!shift_swaps_reviewed_by_fkey (id, first_name, last_name, display_name)
      `, { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Filter by date range (based on requester shift date)
    if (startDate && endDate) {
      query = query
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`);
    }

    // Filter by user
    if (isPrivilegedUser(profile.role)) {
      // Admin/manager can filter by any user or see all
      if (userIdParam) {
        query = query.or(`requester_id.eq.${userIdParam},target_id.eq.${userIdParam}`);
      }
    } else {
      // Non-privileged users can only see their own requests
      query = query.or(`requester_id.eq.${user.id},target_id.eq.${user.id}`);
    }

    const { data: swaps, error: fetchError, count } = await query;

    if (fetchError) {
      console.error("Error fetching shift swaps:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch shift swaps" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: swaps || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/shift-swaps:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface CreateSwapRequest {
  requester_shift_id: string;
  target_id?: string;
  target_shift_id?: string;
  reason?: string;
}

/**
 * POST /api/shift-swaps
 * Create a new shift swap request
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

    const body: CreateSwapRequest = await request.json();
    const { requester_shift_id, target_id, target_shift_id, reason } = body;

    if (!requester_shift_id) {
      return NextResponse.json(
        { error: "requester_shift_id is required" },
        { status: 400 }
      );
    }

    // Verify requester's shift exists and belongs to them
    const { data: requesterShift, error: shiftError } = await supabase
      .from("shifts")
      .select("id, user_id, start_time")
      .eq("id", requester_shift_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (shiftError || !requesterShift) {
      return NextResponse.json(
        { error: "Invalid requester_shift_id" },
        { status: 400 }
      );
    }

    if (requesterShift.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only swap your own shifts" },
        { status: 403 }
      );
    }

    // Check shift is in the future
    if (new Date(requesterShift.start_time) < new Date()) {
      return NextResponse.json(
        { error: "Cannot swap past shifts" },
        { status: 400 }
      );
    }

    // Verify target shift if provided
    if (target_shift_id) {
      const { data: targetShift, error: targetShiftError } = await supabase
        .from("shifts")
        .select("id, user_id")
        .eq("id", target_shift_id)
        .eq("organization_id", profile.organization_id)
        .single();

      if (targetShiftError || !targetShift) {
        return NextResponse.json(
          { error: "Invalid target_shift_id" },
          { status: 400 }
        );
      }

      // Target must match target_id if both provided
      if (target_id && targetShift.user_id !== target_id) {
        return NextResponse.json(
          { error: "target_id does not match target_shift owner" },
          { status: 400 }
        );
      }
    }

    // Create swap request
    const { data: swap, error: insertError } = await supabase
      .from("shift_swaps")
      .insert({
        organization_id: profile.organization_id,
        requester_id: user.id,
        requester_shift_id,
        target_id: target_id || null,
        target_shift_id: target_shift_id || null,
        reason: reason || null,
        status: "pending",
      })
      .select(`
        *,
        requester:profiles!shift_swaps_requester_id_fkey (id, first_name, last_name, display_name, avatar_url),
        target:profiles!shift_swaps_target_id_fkey (id, first_name, last_name, display_name, avatar_url),
        requester_shift:shifts!shift_swaps_requester_shift_id_fkey (
          id, start_time, end_time,
          location:locations (id, name),
          position:positions (id, name, color)
        ),
        target_shift:shifts!shift_swaps_target_shift_id_fkey (
          id, start_time, end_time,
          location:locations (id, name),
          position:positions (id, name, color)
        )
      `)
      .single();

    if (insertError) {
      console.error("Error creating shift swap:", insertError);
      return NextResponse.json(
        { error: "Failed to create shift swap request" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: swap }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/shift-swaps:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
