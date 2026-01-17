import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chat/rooms/[id]/participants
 * Get participants for a chat room
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
    const { data: myParticipation, error: participantError } = await supabase
      .from("chat_participants")
      .select("user_id")
      .eq("room_id", id)
      .eq("user_id", user.id)
      .single();

    if (participantError || !myParticipation) {
      return NextResponse.json(
        { error: "Chat room not found or access denied" },
        { status: 404 }
      );
    }

    // Get all participants
    const { data: participants, error: fetchError } = await supabase
      .from("chat_participants")
      .select(`
        id,
        role,
        joined_at,
        is_muted,
        user:profiles (id, first_name, last_name, display_name, avatar_url, status)
      `)
      .eq("room_id", id)
      .order("joined_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching participants:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch participants" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: participants || [] });
  } catch (error) {
    console.error("Error in GET /api/chat/rooms/[id]/participants:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface AddParticipantsRequest {
  user_ids: string[];
}

/**
 * POST /api/chat/rooms/[id]/participants
 * Add participants to a chat room (creator/admin only)
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
    const body: AddParticipantsRequest = await request.json();
    const { user_ids } = body;

    if (!user_ids || user_ids.length === 0) {
      return NextResponse.json(
        { error: "user_ids is required" },
        { status: 400 }
      );
    }

    // Check if user is an admin of the room
    const { data: myParticipation, error: participantError } = await supabase
      .from("chat_participants")
      .select("role")
      .eq("room_id", id)
      .eq("user_id", user.id)
      .single();

    if (participantError || !myParticipation) {
      return NextResponse.json(
        { error: "Chat room not found or access denied" },
        { status: 404 }
      );
    }

    if (myParticipation.role !== "admin") {
      return NextResponse.json(
        { error: "Only room admins can add participants" },
        { status: 403 }
      );
    }

    // Get room type
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("type")
      .eq("id", id)
      .single();

    if (room?.type === "direct") {
      return NextResponse.json(
        { error: "Cannot add participants to direct messages" },
        { status: 400 }
      );
    }

    // Verify all users belong to the organization
    const { data: validUsers } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .in("id", user_ids);

    if (!validUsers || validUsers.length !== user_ids.length) {
      return NextResponse.json(
        { error: "Invalid user_ids" },
        { status: 400 }
      );
    }

    // Get existing participants
    const { data: existingParticipants } = await supabase
      .from("chat_participants")
      .select("user_id")
      .eq("room_id", id)
      .in("user_id", user_ids);

    const existingIds = new Set(existingParticipants?.map((p) => p.user_id) || []);
    const newUserIds = user_ids.filter((userId) => !existingIds.has(userId));

    if (newUserIds.length === 0) {
      return NextResponse.json(
        { error: "All users are already participants" },
        { status: 400 }
      );
    }

    // Add new participants
    const participantsToInsert = newUserIds.map((userId) => ({
      room_id: id,
      user_id: userId,
      role: "member",
      joined_at: new Date().toISOString(),
    }));

    const { data: newParticipants, error: insertError } = await supabase
      .from("chat_participants")
      .insert(participantsToInsert)
      .select(`
        id,
        role,
        joined_at,
        user:profiles (id, first_name, last_name, display_name, avatar_url)
      `);

    if (insertError) {
      console.error("Error adding participants:", insertError);
      return NextResponse.json(
        { error: "Failed to add participants" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: newParticipants }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/chat/rooms/[id]/participants:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
