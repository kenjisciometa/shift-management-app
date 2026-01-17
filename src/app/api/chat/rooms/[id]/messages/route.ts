import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import type { Json } from "@/types/database.types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chat/rooms/[id]/messages
 * Get messages for a chat room
 *
 * Query params:
 * - before: string (message ID for pagination, get messages before this)
 * - limit: number (optional, default 50)
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
    const { searchParams } = new URL(request.url);
    const before = searchParams.get("before");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

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

    // Build query - note: nested reply_to sender removed due to PostgREST limitations
    let query = supabase
      .from("chat_messages")
      .select(`
        id,
        content,
        type,
        created_at,
        edited_at,
        is_edited,
        is_deleted,
        metadata,
        reply_to_id,
        sender:profiles!chat_messages_sender_id_fkey (id, first_name, last_name, display_name, avatar_url),
        reply_to:chat_messages!chat_messages_reply_to_id_fkey (
          id,
          content,
          sender_id
        )
      `)
      .eq("room_id", id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Pagination: get messages before a specific message
    if (before) {
      const { data: beforeMessage } = await supabase
        .from("chat_messages")
        .select("created_at")
        .eq("id", before)
        .single();

      if (beforeMessage) {
        query = query.lt("created_at", beforeMessage.created_at);
      }
    }

    const { data: messages, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching messages:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    // Reverse to chronological order for display
    const orderedMessages = (messages || []).reverse();

    return NextResponse.json({
      success: true,
      data: orderedMessages,
      hasMore: messages?.length === limit,
    });
  } catch (error) {
    console.error("Error in GET /api/chat/rooms/[id]/messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface SendMessageRequest {
  content: string;
  type?: string;
  reply_to_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/chat/rooms/[id]/messages
 * Send a message to a chat room
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
    const body: SendMessageRequest = await request.json();
    const { content, type, reply_to_id, metadata } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

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

    // Verify reply_to message exists in the same room
    if (reply_to_id) {
      const { data: replyMessage } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("id", reply_to_id)
        .eq("room_id", id)
        .single();

      if (!replyMessage) {
        return NextResponse.json(
          { error: "Invalid reply_to_id" },
          { status: 400 }
        );
      }
    }

    // Create message
    const { data: message, error: insertError } = await supabase
      .from("chat_messages")
      .insert({
        room_id: id,
        sender_id: user.id,
        content: content.trim(),
        type: type || "text",
        reply_to_id: reply_to_id || null,
        metadata: (metadata as Json) ?? null,
      })
      .select(`
        id,
        content,
        type,
        created_at,
        sender:profiles!chat_messages_sender_id_fkey (id, first_name, last_name, display_name, avatar_url)
      `)
      .single();

    if (insertError) {
      console.error("Error creating message:", insertError);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    // Update room's updated_at
    await supabase
      .from("chat_rooms")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    // Update sender's last_read_at
    await supabase
      .from("chat_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("room_id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/chat/rooms/[id]/messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
