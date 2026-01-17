import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

/**
 * PUT /api/shift-swaps/:id/cancel
 * Requester cancels the shift swap request
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

    const { id } = await params;

    // Get the swap request
    const { data: swap, error: fetchError } = await supabase
      .from("shift_swaps")
      .select(`
        id,
        requester_id,
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

    // Verify the current user is the requester
    if (swap.requester_id !== user.id) {
      return NextResponse.json(
        { error: "Only the requester can cancel this request" },
        { status: 403 }
      );
    }

    // Verify the swap can be cancelled (not already approved/rejected/applied)
    if (swap.status === "approved" || swap.status === "rejected" || swap.status === "applied") {
      return NextResponse.json(
        { error: "Cannot cancel a swap that has already been processed" },
        { status: 400 }
      );
    }

    // Update the swap status to cancelled
    const { data: updatedSwap, error: updateError } = await supabase
      .from("shift_swaps")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error cancelling shift swap:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel shift swap" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedSwap,
    });
  } catch (error) {
    console.error("Error in PUT /api/shift-swaps/[id]/cancel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
