import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ApproveRequest {
  comment?: string;
}

/**
 * PUT /api/shift-swaps/[id]/approve
 * Approve a shift swap request
 * - Target user can accept (changes status to target_accepted)
 * - Admin/manager can fully approve (changes status to approved and swaps shifts)
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
    const body: ApproveRequest = await request.json().catch(() => ({}));

    // Get the swap request
    const { data: swap, error: fetchError } = await supabase
      .from("shift_swaps")
      .select(`
        *,
        requester_shift:shifts!shift_swaps_requester_shift_id_fkey (id, user_id),
        target_shift:shifts!shift_swaps_target_shift_id_fkey (id, user_id)
      `)
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
    const isTarget = swap.target_id === user.id;

    // Determine action based on current status and user role
    if (swap.status === "pending" && isTarget) {
      // Target user accepting the swap
      const { error: updateError } = await supabase
        .from("shift_swaps")
        .update({
          status: "target_accepted",
          updated_at: now,
        })
        .eq("id", id);

      if (updateError) {
        console.error("Error updating swap:", updateError);
        return NextResponse.json(
          { error: "Failed to accept swap" },
          { status: 500 }
        );
      }

      // Fetch the updated swap with full details
      const { data: updatedSwap } = await supabase
        .from("shift_swaps")
        .select(`
          *,
          requester:profiles!shift_swaps_requester_id_fkey (id, first_name, last_name, display_name, avatar_url),
          target:profiles!shift_swaps_target_id_fkey (id, first_name, last_name, display_name, avatar_url),
          requester_shift:shifts!shift_swaps_requester_shift_id_fkey (id, start_time, end_time, location_id, position_id),
          target_shift:shifts!shift_swaps_target_shift_id_fkey (id, start_time, end_time, location_id, position_id)
        `)
        .eq("id", id)
        .single();

      return NextResponse.json({ success: true, data: updatedSwap });
    } else if ((swap.status === "pending" || swap.status === "target_accepted") && isAdmin) {
      // Admin approving - swap the shifts
      const requesterShiftId = swap.requester_shift_id;
      const targetShiftId = swap.target_shift_id;
      const requesterId = swap.requester_id;
      const targetId = swap.target_id;

      // Swap the user_ids on the shifts
      if (requesterShiftId && targetShiftId && requesterId && targetId) {
        // Update requester's shift to target
        const { error: updateShift1Error } = await supabase
          .from("shifts")
          .update({ user_id: targetId, updated_at: now })
          .eq("id", requesterShiftId);

        if (updateShift1Error) {
          console.error("Error updating requester shift:", updateShift1Error);
          return NextResponse.json(
            { error: "Failed to swap shifts" },
            { status: 500 }
          );
        }

        // Update target's shift to requester
        const { error: updateShift2Error } = await supabase
          .from("shifts")
          .update({ user_id: requesterId, updated_at: now })
          .eq("id", targetShiftId);

        if (updateShift2Error) {
          console.error("Error updating target shift:", updateShift2Error);
          return NextResponse.json(
            { error: "Failed to swap shifts" },
            { status: 500 }
          );
        }
      }

      // Update swap status
      const { error: updateError } = await supabase
        .from("shift_swaps")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: now,
          review_comment: body.comment || null,
          applied_at: now,
          updated_at: now,
        })
        .eq("id", id);

      if (updateError) {
        console.error("Error updating swap status:", updateError);
        return NextResponse.json(
          { error: "Failed to approve swap" },
          { status: 500 }
        );
      }

      // Fetch the updated swap with full details
      const { data: updatedSwap } = await supabase
        .from("shift_swaps")
        .select(`
          *,
          requester:profiles!shift_swaps_requester_id_fkey (id, first_name, last_name, display_name, avatar_url),
          target:profiles!shift_swaps_target_id_fkey (id, first_name, last_name, display_name, avatar_url),
          requester_shift:shifts!shift_swaps_requester_shift_id_fkey (id, start_time, end_time, location_id, position_id),
          target_shift:shifts!shift_swaps_target_shift_id_fkey (id, start_time, end_time, location_id, position_id),
          reviewer:profiles!shift_swaps_reviewed_by_fkey (id, first_name, last_name)
        `)
        .eq("id", id)
        .single();

      return NextResponse.json({ success: true, data: updatedSwap });
    } else {
      return NextResponse.json(
        { error: "Not authorized to approve this swap" },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error("Error in PUT /api/shift-swaps/[id]/approve:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
