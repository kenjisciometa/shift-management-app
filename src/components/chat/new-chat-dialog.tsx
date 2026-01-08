"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, X, Search, MessageSquare, Users } from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  teamMembers: TeamMember[];
  onRoomCreated: (roomId: string) => void;
}

export function NewChatDialog({
  open,
  onOpenChange,
  profile,
  teamMembers,
  onRoomCreated,
}: NewChatDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [chatType, setChatType] = useState<"direct" | "group">("direct");

  // Direct message state
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  // Group chat state
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const getDisplayName = (member: TeamMember) => {
    if (member.display_name) return member.display_name;
    return `${member.first_name} ${member.last_name}`;
  };

  const getInitials = (member: TeamMember) => {
    return `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
  };

  const filteredMembers = teamMembers.filter((member) => {
    if (!searchQuery) return true;
    const name = getDisplayName(member).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const handleToggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCreateDirectChat = async () => {
    if (!selectedMember) {
      toast.error("Please select a team member");
      return;
    }

    setLoading(true);

    try {
      // Check if a direct chat already exists between these two users
      const { data: existingRooms } = await supabase
        .from("chat_rooms")
        .select(`
          id,
          chat_participants (user_id)
        `)
        .eq("organization_id", profile.organization_id)
        .eq("type", "direct");

      // Find existing room
      const existingRoom = existingRooms?.find((room) => {
        const participantIds = room.chat_participants?.map((p: { user_id: string }) => p.user_id) || [];
        return (
          participantIds.length === 2 &&
          participantIds.includes(profile.id) &&
          participantIds.includes(selectedMember.id)
        );
      });

      if (existingRoom) {
        // Use existing room
        onRoomCreated(existingRoom.id);
        onOpenChange(false);
        resetForm();
        router.refresh();
        return;
      }

      // Create new direct chat room
      const { data: newRoom, error: roomError } = await supabase
        .from("chat_rooms")
        .insert({
          organization_id: profile.organization_id,
          type: "direct",
          is_private: true,
          created_by: profile.id,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add participants
      const { error: participantError } = await supabase
        .from("chat_participants")
        .insert([
          { room_id: newRoom.id, user_id: profile.id, role: "member" },
          { room_id: newRoom.id, user_id: selectedMember.id, role: "member" },
        ]);

      if (participantError) throw participantError;

      toast.success("Chat created");
      onRoomCreated(newRoom.id);
      onOpenChange(false);
      resetForm();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create chat");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroupChat = async () => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    if (selectedMembers.length === 0) {
      toast.error("Please select at least one member");
      return;
    }

    setLoading(true);

    try {
      // Create group chat room
      const { data: newRoom, error: roomError } = await supabase
        .from("chat_rooms")
        .insert({
          organization_id: profile.organization_id,
          name: groupName.trim(),
          type: "group",
          is_private: false,
          created_by: profile.id,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add participants (including creator)
      const participants = [
        { room_id: newRoom.id, user_id: profile.id, role: "owner" },
        ...selectedMembers.map((memberId) => ({
          room_id: newRoom.id,
          user_id: memberId,
          role: "member",
        })),
      ];

      const { error: participantError } = await supabase
        .from("chat_participants")
        .insert(participants);

      if (participantError) throw participantError;

      toast.success("Group created");
      onRoomCreated(newRoom.id);
      onOpenChange(false);
      resetForm();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSearchQuery("");
    setSelectedMember(null);
    setGroupName("");
    setSelectedMembers([]);
    setChatType("direct");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) resetForm();
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Start a new conversation with a team member or create a group chat.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={chatType} onValueChange={(v) => setChatType(v as "direct" | "group")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Direct Message
            </TabsTrigger>
            <TabsTrigger value="group" className="gap-2">
              <Users className="h-4 w-4" />
              Group Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-4 mt-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Selected member */}
            {selectedMember && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={selectedMember.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(selectedMember)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 font-medium">
                  {getDisplayName(selectedMember)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedMember(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Team members list */}
            <ScrollArea className="h-60 border rounded-md">
              <div className="p-2">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                      selectedMember?.id === member.id
                        ? "bg-primary/10"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedMember(member)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(member)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {getDisplayName(member)}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {member.role}
                      </div>
                    </div>
                  </button>
                ))}
                {filteredMembers.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No team members found
                  </p>
                )}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateDirectChat}
                disabled={loading || !selectedMember}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Start Chat
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="group" className="space-y-4 mt-4">
            {/* Group name */}
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                placeholder="Enter group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            {/* Selected members */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map((memberId) => {
                  const member = teamMembers.find((m) => m.id === memberId);
                  if (!member) return null;
                  return (
                    <Badge
                      key={memberId}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px]">
                          {getInitials(member)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{getDisplayName(member)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => handleToggleMember(memberId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Team members list */}
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                      selectedMembers.includes(member.id)
                        ? "bg-primary/10"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => handleToggleMember(member.id)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(member)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {getDisplayName(member)}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {member.role}
                      </div>
                    </div>
                    {selectedMembers.includes(member.id) && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
                {filteredMembers.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No team members found
                  </p>
                )}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateGroupChat}
                disabled={loading || !groupName.trim() || selectedMembers.length === 0}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Group
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
