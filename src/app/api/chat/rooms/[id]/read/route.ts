import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/chat/rooms/[id]/read
 * Mark chat room messages as read for the current user
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Check if user is a participant
    const { data: participant, error: participantError } = await supabase
      .from("chat_participants")
      .select("user_id")
      .eq("room_id", id)
      .eq("user_id", user.id)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: "Chat room not found or access denied" },
        { status: 404 }
      );
    }

    // Update last_read_at
    const { error: updateError } = await supabase
      .from("chat_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("room_id", id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error marking messages as read:", updateError);
      return NextResponse.json(
        { error: "Failed to mark messages as read" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    console.error("Error in POST /api/chat/rooms/[id]/read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
