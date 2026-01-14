import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { ChatDashboard } from "@/components/chat/dashboard";
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export default async function ChatPage() {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/login");
  }

  const { user, profile } = authData;
  const supabase = await getCachedSupabase();

  // First fetch: Get participations and team members in parallel
  const [participationsResult, teamMembersResult] = await Promise.all([
    supabase
      .from("chat_participants")
      .select(`
        *,
        chat_rooms (
          id,
          name,
          type,
          description,
          is_private,
          created_by,
          created_at,
          updated_at
        )
      `)
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, display_name, avatar_url, role")
      .eq("organization_id", profile.organization_id)
      .eq("status", "active")
      .neq("id", user.id)
      .order("first_name"),
  ]);

  const participations = participationsResult.data || [];
  const roomIds = participations.map((p) => p.room_id);

  // Second fetch: Get room participants and latest messages in parallel (only if there are rooms)
  let roomParticipants: Record<string, Array<{
    id: string;
    user_id: string;
    role: string | null;
    profiles: {
      id: string;
      first_name: string;
      last_name: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  }>> = {};
  let latestMessages: Record<string, {
    id: string;
    content: string;
    created_at: string | null;
    sender_id: string;
  }> = {};

  if (roomIds.length > 0) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/5c628d44-070d-4c4e-8f24-ef49dbed185b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat/page.tsx:67',message:'Starting chat queries',data:{roomIdsCount:roomIds.length,roomIds:roomIds.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const queryStartTime = Date.now();
    const [allParticipantsResult, latestMessagesResult] = await Promise.all([
      supabase
        .from("chat_participants")
        .select(`
          id,
          room_id,
          user_id,
          role,
          profiles!chat_participants_user_id_fkey (
            id,
            first_name,
            last_name,
            display_name,
            avatar_url
          )
        `)
        .in("room_id", roomIds),
      // Get latest message for all rooms at once using a single query with distinct
      supabase
        .from("chat_messages")
        .select("id, room_id, content, created_at, sender_id")
        .in("room_id", roomIds)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
    ]);
    // #region agent log
    const queryDuration = Date.now() - queryStartTime;
    fetch('http://127.0.0.1:7244/ingest/5c628d44-070d-4c4e-8f24-ef49dbed185b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat/page.tsx:92',message:'Chat queries completed',data:{queryDuration,participantsCount:allParticipantsResult.data?.length||0,messagesCount:latestMessagesResult.data?.length||0,hasError:!!latestMessagesResult.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Group participants by room
    if (allParticipantsResult.data) {
      allParticipantsResult.data.forEach((p) => {
        if (!roomParticipants[p.room_id]) {
          roomParticipants[p.room_id] = [];
        }
        roomParticipants[p.room_id].push({
          id: p.id,
          user_id: p.user_id,
          role: p.role,
          profiles: p.profiles,
        });
      });
    }

    // Get only the latest message per room
    if (latestMessagesResult.data) {
      const seenRooms = new Set<string>();
      latestMessagesResult.data.forEach((msg) => {
        if (!seenRooms.has(msg.room_id)) {
          seenRooms.add(msg.room_id);
          latestMessages[msg.room_id] = {
            id: msg.id,
            content: msg.content,
            created_at: msg.created_at,
            sender_id: msg.sender_id,
          };
        }
      });
    }
  }

  return (
    <>
      <DashboardHeader title="Chat" />
      <div className="flex-1 overflow-hidden">
        <ChatDashboard
          profile={profile}
          participations={participations}
          roomParticipants={roomParticipants}
          latestMessages={latestMessages}
          teamMembers={teamMembersResult.data || []}
        />
      </div>
    </>
  );
}
