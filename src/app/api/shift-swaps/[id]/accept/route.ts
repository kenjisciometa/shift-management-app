import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

/**
 * PUT /api/shift-swaps/:id/accept
 * Target user accepts the shift swap request
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

    // Verify the current user is the target user
    if (swap.target_id !== user.id) {
      return NextResponse.json(
        { error: "Only the target user can accept this request" },
        { status: 403 }
      );
    }

    // Verify the swap is in pending status
    if (swap.status !== "pending") {
      return NextResponse.json(
        { error: "This swap request is no longer pending" },
        { status: 400 }
      );
    }

    // Update the swap status to target_accepted
    const { data: updatedSwap, error: updateError } = await supabase
      .from("shift_swaps")
      .update({
        status: "target_accepted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error accepting shift swap:", updateError);
      return NextResponse.json(
        { error: "Failed to accept shift swap" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedSwap,
    });
  } catch (error) {
    console.error("Error in PUT /api/shift-swaps/[id]/accept:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
