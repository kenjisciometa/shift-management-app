import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

/**
 * GET /api/chat/rooms
 * Get chat rooms for the current user
 *
 * Query params:
 * - type: 'direct' | 'group' | 'channel' | 'all' (optional, default 'all')
 * - limit: number (optional, default 50)
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
    const type = searchParams.get("type") || "all";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get rooms where user is a participant
    let query = supabase
      .from("chat_rooms")
      .select(`
        id,
        name,
        type,
        description,
        is_private,
        created_at,
        created_by,
        chat_participants!inner (
          user_id,
          role,
          last_read_at,
          is_muted
        )
      `, { count: "exact" })
      .eq("organization_id", profile.organization_id)
      .eq("chat_participants.user_id", user.id)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type !== "all") {
      query = query.eq("type", type);
    }

    const { data: rooms, error: fetchError, count } = await query;

    if (fetchError) {
      console.error("Error fetching chat rooms:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch chat rooms" },
        { status: 500 }
      );
    }

    // For each room, get the latest message and unread count
    const roomsWithDetails = await Promise.all(
      (rooms || []).map(async (room) => {
        // Get latest message
        const { data: latestMessages } = await supabase
          .from("chat_messages")
          .select(`
            id,
            content,
            type,
            created_at,
            sender:profiles!chat_messages_sender_id_fkey (id, first_name, last_name, avatar_url)
          `)
          .eq("room_id", room.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(1);

        // Get unread count
        const participant = room.chat_participants[0];
        const lastReadAt = participant?.last_read_at || "1970-01-01";

        const { count: unreadCount } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", room.id)
          .eq("is_deleted", false)
          .neq("sender_id", user.id)
          .gt("created_at", lastReadAt);

        // For direct messages, get the other participant's info
        let otherParticipant = null;
        if (room.type === "direct") {
          const { data: participants } = await supabase
            .from("chat_participants")
            .select(`
              user:profiles (id, first_name, last_name, display_name, avatar_url)
            `)
            .eq("room_id", room.id)
            .neq("user_id", user.id)
            .limit(1);

          otherParticipant = participants?.[0]?.user || null;
        }

        return {
          id: room.id,
          name: room.name,
          type: room.type,
          description: room.description,
          is_private: room.is_private,
          created_at: room.created_at,
          my_role: participant?.role,
          is_muted: participant?.is_muted,
          last_read_at: participant?.last_read_at,
          latest_message: latestMessages?.[0] || null,
          unread_count: unreadCount || 0,
          other_participant: otherParticipant,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: roomsWithDetails,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/chat/rooms:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface CreateRoomRequest {
  type: "direct" | "group" | "channel";
  name?: string;
  description?: string;
  is_private?: boolean;
  participant_ids: string[];
}

/**
 * POST /api/chat/rooms
 * Create a new chat room
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

    const body: CreateRoomRequest = await request.json();
    const { type, name, description, is_private, participant_ids } = body;

    if (!type || !participant_ids || participant_ids.length === 0) {
      return NextResponse.json(
        { error: "type and participant_ids are required" },
        { status: 400 }
      );
    }

    if (type === "direct" && participant_ids.length !== 1) {
      return NextResponse.json(
        { error: "Direct messages must have exactly one other participant" },
        { status: 400 }
      );
    }

    // For direct messages, check if a room already exists
    if (type === "direct") {
      const otherId = participant_ids[0];

      // Get all direct rooms for current user
      const { data: existingRooms } = await supabase
        .from("chat_rooms")
        .select(`
          id,
          chat_participants (user_id)
        `)
        .eq("organization_id", profile.organization_id)
        .eq("type", "direct");

      // Check if there's a room with both users
      const existingRoom = existingRooms?.find((room) => {
        const participantIds = room.chat_participants.map((p) => p.user_id);
        return participantIds.includes(user.id) && participantIds.includes(otherId);
      });

      if (existingRoom) {
        return NextResponse.json({
          success: true,
          data: { id: existingRoom.id },
          existing: true,
        });
      }
    }

    // Verify all participants belong to the organization
    const allParticipantIds = [...new Set([user.id, ...participant_ids])];
    const { data: validUsers } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .in("id", allParticipantIds);

    if (!validUsers || validUsers.length !== allParticipantIds.length) {
      return NextResponse.json(
        { error: "Invalid participant_ids" },
        { status: 400 }
      );
    }

    // Create room
    const { data: room, error: roomError } = await supabase
      .from("chat_rooms")
      .insert({
        organization_id: profile.organization_id,
        type,
        name: name || null,
        description: description || null,
        is_private: is_private ?? (type === "direct"),
        created_by: user.id,
      })
      .select()
      .single();

    if (roomError) {
      console.error("Error creating chat room:", roomError);
      return NextResponse.json(
        { error: "Failed to create chat room" },
        { status: 500 }
      );
    }

    // Add participants
    const participantsToInsert = allParticipantIds.map((userId) => ({
      room_id: room.id,
      user_id: userId,
      role: userId === user.id ? "admin" : "member",
      joined_at: new Date().toISOString(),
    }));

    const { error: participantsError } = await supabase
      .from("chat_participants")
      .insert(participantsToInsert);

    if (participantsError) {
      console.error("Error adding participants:", participantsError);
      // Clean up the room
      await supabase.from("chat_rooms").delete().eq("id", room.id);
      return NextResponse.json(
        { error: "Failed to add participants" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: room }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/chat/rooms:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
