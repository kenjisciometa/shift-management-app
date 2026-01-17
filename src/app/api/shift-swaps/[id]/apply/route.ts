import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

/**
 * PUT /api/shift-swaps/:id/apply
 * Apply an approved shift swap to the schedule (admin/manager only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Get the swap request with shift details
    const { data: swap, error: fetchError } = await supabase
      .from("shift_swaps")
      .select(`
        id,
        requester_id,
        target_id,
        requester_shift_id,
        target_shift_id,
        status,
        organization_id
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

    // Verify the swap is approved
    if (swap.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved swaps can be applied to the schedule" },
        { status: 400 }
      );
    }

    // Swap the user_ids on the shifts
    const updates = [];

    // Update requester's shift to target user
    if (swap.requester_shift_id && swap.target_id) {
      updates.push(
        supabase
          .from("shifts")
          .update({ user_id: swap.target_id })
          .eq("id", swap.requester_shift_id)
      );
    }

    // Update target's shift to requester (if exists)
    if (swap.target_shift_id) {
      updates.push(
        supabase
          .from("shifts")
          .update({ user_id: swap.requester_id })
          .eq("id", swap.target_shift_id)
      );
    }

    // Execute all shift updates
    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      console.error("Error applying shift swap:", results);
      return NextResponse.json(
        { error: "Failed to apply shift swap to schedule" },
        { status: 500 }
      );
    }

    // Update the swap status to applied
    const { data: updatedSwap, error: updateError } = await supabase
      .from("shift_swaps")
      .update({
        status: "applied",
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating swap status:", updateError);
      return NextResponse.json(
        { error: "Shifts updated but failed to update swap status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedSwap,
      message: "Shift swap applied to schedule successfully",
    });
  } catch (error) {
    console.error("Error in PUT /api/shift-swaps/[id]/apply:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
