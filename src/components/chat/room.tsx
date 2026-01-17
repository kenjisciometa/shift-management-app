"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { apiGet, apiPost } from "@/lib/api-client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Loader2, Users, MoreVertical, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

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

type RoomParticipant = {
  id: string;
  user_id: string;
  role: string | null;
  last_read_at: string | null;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  type: string | null;
  created_at: string | null;
  is_edited: boolean | null;
  is_deleted: boolean | null;
};

interface ChatRoomProps {
  profile: Profile;
  room: ChatRoomType;
  participants: RoomParticipant[];
}

export function ChatRoom({ profile, room, participants }: ChatRoomProps) {
  const router = useRouter();
  // Supabase client is kept only for realtime subscriptions
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [participantsState, setParticipantsState] = useState<RoomParticipant[]>(participants);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update participants state when props change
  useEffect(() => {
    setParticipantsState(participants);
  }, [participants]);

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

  const getRoomDisplayInfo = () => {
    if (room.type === "direct") {
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
    return {
      name: room.name || "Group Chat",
      avatar: null,
      initials: room.name?.[0]?.toUpperCase() || "G",
    };
  };

  const getSenderInfo = (senderId: string) => {
    const participant = participants.find((p) => p.user_id === senderId);
    return participant?.profiles || null;
  };

  const formatMessageDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = parseISO(dateStr);
    if (isToday(date)) return format(date, "h:mm a");
    if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`;
    return format(date, "MMM d, h:mm a");
  };

  // Mark messages as read via API
  const markAsRead = async () => {
    await apiPost(`/api/chat/rooms/${room.id}/read`, {});
  };

  // Fetch messages via API
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      const response = await apiGet<Message[]>(`/api/chat/rooms/${room.id}/messages`, {
        limit: 100,
      });

      if (!response.success) {
        console.error(response.error);
        toast.error("Failed to load messages");
      } else {
        // Transform API response to match expected format
        const messagesData = (response.data || []).map((msg: any) => ({
          id: msg.id,
          room_id: room.id,
          sender_id: msg.sender?.id || "",
          content: msg.content,
          type: msg.type,
          created_at: msg.created_at,
          is_edited: msg.is_edited,
          is_deleted: msg.is_deleted,
        }));
        setMessages(messagesData);
        // Mark as read when opening the room
        markAsRead();
      }
      setLoading(false);
    };

    fetchMessages();
  }, [room.id]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
          // Mark as read when receiving new messages while room is open
          if (newMessage.sender_id !== profile.id) {
            markAsRead();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, supabase]);

  // Subscribe to participant read status updates
  useEffect(() => {
    const channel = supabase
      .channel(`participants:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_participants",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const updated = payload.new as { user_id: string; last_read_at: string | null };
          setParticipantsState((prev) =>
            prev.map((p) =>
              p.user_id === updated.user_id
                ? { ...p, last_read_at: updated.last_read_at }
                : p
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, supabase]);

  // Check if message has been read by other participants
  const isMessageRead = (message: Message) => {
    if (message.sender_id !== profile.id) return false; // Only show for own messages
    if (!message.created_at) return false;

    const messageTime = new Date(message.created_at).getTime();
    return participantsState.some((p) => {
      if (p.user_id === profile.id) return false; // Skip self
      if (!p.last_read_at) return false;
      return new Date(p.last_read_at).getTime() >= messageTime;
    });
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on room change
  useEffect(() => {
    inputRef.current?.focus();
  }, [room.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const content = messageInput.trim();
    if (!content) return;

    setSending(true);
    setMessageInput("");

    try {
      const response = await apiPost(`/api/chat/rooms/${room.id}/messages`, {
        content,
        type: "text",
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to send message");
      }

      // Note: Message will be added via realtime subscription
      // Mark as read is handled by the API
    } catch (error) {
      console.error(error);
      toast.error("Failed to send message");
      setMessageInput(content); // Restore message
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const roomInfo = getRoomDisplayInfo();

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  messages.forEach((message) => {
    if (!message.created_at) return;
    const date = format(parseISO(message.created_at), "yyyy-MM-dd");
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup?.date === date) {
      lastGroup.messages.push(message);
    } else {
      groupedMessages.push({ date, messages: [message] });
    }
  });

  const formatDateHeader = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMMM d, yyyy");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={roomInfo.avatar || undefined} />
            <AvatarFallback>{roomInfo.initials}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{roomInfo.name}</h3>
            {room.type === "group" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {participants.length} members
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                    {formatDateHeader(group.date)}
                  </div>
                </div>

                {/* Messages for this date */}
                <div className="space-y-4">
                  {group.messages.map((message, index) => {
                    const isOwn = message.sender_id === profile.id;
                    const sender = getSenderInfo(message.sender_id);
                    const prevMessage = group.messages[index - 1];
                    const showAvatar =
                      !isOwn &&
                      (!prevMessage || prevMessage.sender_id !== message.sender_id);

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-2",
                          isOwn ? "justify-end" : "justify-start"
                        )}
                      >
                        {!isOwn && (
                          <div className="w-8">
                            {showAvatar && (
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={sender?.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(sender)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        )}

                        <div
                          className={cn(
                            "max-w-[70%] flex flex-col",
                            isOwn ? "items-end" : "items-start"
                          )}
                        >
                          {!isOwn && showAvatar && (
                            <span className="text-xs text-muted-foreground mb-1 ml-1">
                              {getDisplayName(sender)}
                            </span>
                          )}
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2",
                              isOwn
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 mt-1 mx-1">
                            <span className="text-xs text-muted-foreground">
                              {formatMessageDate(message.created_at)}
                            </span>
                            {isOwn && (
                              isMessageRead(message) ? (
                                <CheckCheck className="h-3 w-3 text-blue-500" />
                              ) : (
                                <Check className="h-3 w-3 text-muted-foreground" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Type a message..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !messageInput.trim()}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
