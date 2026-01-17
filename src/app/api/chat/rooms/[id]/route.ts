import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chat/rooms/[id]
 * Get a specific chat room's details
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

    // Check if user is a participant
    const { data: participant, error: participantError } = await supabase
      .from("chat_participants")
      .select("role, last_read_at, is_muted")
      .eq("room_id", id)
      .eq("user_id", user.id)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: "Chat room not found or access denied" },
        { status: 404 }
      );
    }

    // Get room details
    const { data: room, error: roomError } = await supabase
      .from("chat_rooms")
      .select(`
        id,
        name,
        type,
        description,
        is_private,
        created_at,
        created_by,
        creator:profiles!chat_rooms_created_by_fkey (id, first_name, last_name, avatar_url)
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: "Chat room not found" },
        { status: 404 }
      );
    }

    // Get all participants
    const { data: participants } = await supabase
      .from("chat_participants")
      .select(`
        role,
        joined_at,
        is_muted,
        user:profiles (id, first_name, last_name, display_name, avatar_url)
      `)
      .eq("room_id", id);

    // Get unread count
    const lastReadAt = participant.last_read_at || "1970-01-01";
    const { count: unreadCount } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("room_id", id)
      .eq("is_deleted", false)
      .neq("sender_id", user.id)
      .gt("created_at", lastReadAt);

    return NextResponse.json({
      success: true,
      data: {
        ...room,
        my_role: participant.role,
        is_muted: participant.is_muted,
        last_read_at: participant.last_read_at,
        unread_count: unreadCount || 0,
        participants: participants || [],
      },
    });
  } catch (error) {
    console.error("Error in GET /api/chat/rooms/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
