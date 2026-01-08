"use client";

import { formatDistanceToNow, parseISO } from "date-fns";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Users, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

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

interface ChatSidebarProps {
  profile: Profile;
  participations: Participation[];
  roomParticipants: Record<string, RoomParticipant[]>;
  latestMessages: Record<string, LatestMessage>;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onNewChat: () => void;
}

export function ChatSidebar({
  profile,
  participations,
  roomParticipants,
  latestMessages,
  selectedRoomId,
  onSelectRoom,
  onNewChat,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const getDisplayName = (
    p: { first_name: string; last_name: string; display_name: string | null } | null
  ) => {
    if (!p) return "Unknown";
    if (p.display_name) return p.display_name;
    return `${p.first_name} ${p.last_name}`;
  };

  const getInitials = (
    p: { first_name: string; last_name: string } | null
  ) => {
    if (!p) return "?";
    return `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
  };

  const getRoomDisplayInfo = (participation: Participation) => {
    const room = participation.chat_rooms;
    if (!room) return { name: "Unknown", avatar: null, initials: "?" };

    const participants = roomParticipants[room.id] || [];

    if (room.type === "direct") {
      // For direct messages, show the other person's name
      const otherParticipant = participants.find(
        (p) => p.user_id !== profile.id
      );
      if (otherParticipant?.profiles) {
        return {
          name: getDisplayName(otherParticipant.profiles),
          avatar: otherParticipant.profiles.avatar_url,
          initials: getInitials(otherParticipant.profiles),
        };
      }
    }

    // For group chats, show the room name
    return {
      name: room.name || "Group Chat",
      avatar: null,
      initials: room.name?.[0]?.toUpperCase() || "G",
    };
  };

  const filteredParticipations = participations.filter((p) => {
    if (!searchQuery) return true;
    const info = getRoomDisplayInfo(p);
    return info.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Sort by latest message
  const sortedParticipations = [...filteredParticipations].sort((a, b) => {
    const aMessage = latestMessages[a.chat_rooms?.id || ""];
    const bMessage = latestMessages[b.chat_rooms?.id || ""];
    if (!aMessage && !bMessage) return 0;
    if (!aMessage) return 1;
    if (!bMessage) return -1;
    return (
      new Date(bMessage.created_at || 0).getTime() -
      new Date(aMessage.created_at || 0).getTime()
    );
  });

  return (
    <div className="w-80 border-r flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Messages</h2>
          <Button size="icon" variant="ghost" onClick={onNewChat}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {sortedParticipations.length > 0 ? (
            sortedParticipations.map((participation) => {
              const room = participation.chat_rooms;
              if (!room) return null;

              const info = getRoomDisplayInfo(participation);
              const latestMessage = latestMessages[room.id];
              const isSelected = selectedRoomId === room.id;
              const participants = roomParticipants[room.id] || [];

              return (
                <button
                  key={participation.id}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
                    isSelected
                      ? "bg-primary/10"
                      : "hover:bg-muted"
                  )}
                  onClick={() => onSelectRoom(room.id)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={info.avatar || undefined} />
                    <AvatarFallback>{info.initials}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{info.name}</span>
                      {latestMessage?.created_at && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(parseISO(latestMessage.created_at), {
                            addSuffix: false,
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {room.type === "group" && (
                        <Users className="h-3 w-3 text-muted-foreground" />
                      )}
                      <p className="text-sm text-muted-foreground truncate">
                        {latestMessage?.content || "No messages yet"}
                      </p>
                    </div>
                    {room.type === "group" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {participants.length} members
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No conversations yet</p>
              <Button variant="link" onClick={onNewChat}>
                Start a new conversation
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
