import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/shift-swaps/[id]
 * Get a specific shift swap request
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
        reviewer:profiles!shift_swaps_reviewed_by_fkey (id, first_name, last_name)
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id);

    // Non-privileged users can only see their own swap requests
    if (!isPrivilegedUser(profile.role)) {
      query = query.or(`requester_id.eq.${user.id},target_id.eq.${user.id}`);
    }

    const { data: swap, error: fetchError } = await query.single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Shift swap not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching shift swap:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch shift swap" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: swap });
  } catch (error) {
    console.error("Error in GET /api/shift-swaps/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
