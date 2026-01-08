"use client";

import { useState } from "react";
import type { Database } from "@/types/database.types";
import { ChatSidebar } from "./sidebar";
import { ChatRoom } from "./room";
import { NewChatDialog } from "./new-chat-dialog";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type ChatRoomType = {
  id: string;
  name: string | null;
  type: string;
  description: string | null;
  is_private: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Participation = Database["public"]["Tables"]["chat_participants"]["Row"] & {
  chat_rooms: ChatRoomType | null;
};

type RoomParticipant = {
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
};

type LatestMessage = {
  id: string;
  content: string;
  created_at: string | null;
  sender_id: string;
};

type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

interface ChatDashboardProps {
  profile: Profile;
  participations: Participation[];
  roomParticipants: Record<string, RoomParticipant[]>;
  latestMessages: Record<string, LatestMessage>;
  teamMembers: TeamMember[];
}

export function ChatDashboard({
  profile,
  participations,
  roomParticipants,
  latestMessages,
  teamMembers,
}: ChatDashboardProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [newChatDialogOpen, setNewChatDialogOpen] = useState(false);

  const selectedRoom = participations.find(
    (p) => p.chat_rooms?.id === selectedRoomId
  )?.chat_rooms;

  const selectedRoomParticipants = selectedRoomId
    ? roomParticipants[selectedRoomId] || []
    : [];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        profile={profile}
        participations={participations}
        roomParticipants={roomParticipants}
        latestMessages={latestMessages}
        selectedRoomId={selectedRoomId}
        onSelectRoom={setSelectedRoomId}
        onNewChat={() => setNewChatDialogOpen(true)}
      />

      {/* Chat Room */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <ChatRoom
            profile={profile}
            room={selectedRoom}
            participants={selectedRoomParticipants}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center">
              <p className="text-muted-foreground">
                Select a conversation or start a new one
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Dialog */}
      <NewChatDialog
        open={newChatDialogOpen}
        onOpenChange={setNewChatDialogOpen}
        profile={profile}
        teamMembers={teamMembers}
        onRoomCreated={(roomId) => {
          setSelectedRoomId(roomId);
          setNewChatDialogOpen(false);
        }}
      />
    </div>
  );
}
