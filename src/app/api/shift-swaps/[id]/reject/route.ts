import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface RejectRequest {
  comment?: string;
}

/**
 * PUT /api/shift-swaps/[id]/reject
 * Reject a shift swap request
 * - Target user can reject
 * - Requester can cancel their own request
 * - Admin/manager can reject any request
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

    const { id } = await params;
    const body: RejectRequest = await request.json().catch(() => ({}));

    // Get the swap request
    const { data: swap, error: fetchError } = await supabase
      .from("shift_swaps")
      .select("*")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError || !swap) {
      return NextResponse.json(
        { error: "Shift swap not found" },
        { status: 404 }
      );
    }

    // Check if already processed
    if (swap.status === "approved" || swap.status === "rejected" || swap.status === "cancelled") {
      return NextResponse.json(
        { error: `Swap request already ${swap.status}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const isAdmin = isPrivilegedUser(profile.role);
    const isRequester = swap.requester_id === user.id;
    const isTarget = swap.target_id === user.id;

    // Determine if user can reject
    if (!isAdmin && !isRequester && !isTarget) {
      return NextResponse.json(
        { error: "Not authorized to reject this swap" },
        { status: 403 }
      );
    }

    // Determine status: cancelled if requester cancels, rejected otherwise
    const newStatus = isRequester && !isAdmin ? "cancelled" : "rejected";

    // Update swap status
    const { data: updatedSwap, error: updateError } = await supabase
      .from("shift_swaps")
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: now,
        review_comment: body.comment || null,
        updated_at: now,
      })
      .eq("id", id)
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
      .single();

    if (updateError) {
      console.error("Error rejecting swap:", updateError);
      return NextResponse.json(
        { error: "Failed to reject swap" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updatedSwap });
  } catch (error) {
    console.error("Error in PUT /api/shift-swaps/[id]/reject:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
