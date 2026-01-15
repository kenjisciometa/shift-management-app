"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Clock, MapPin, User, ArrowRightLeft } from "lucide-react";

interface Profile {
  id: string;
  organization_id: string;
}

interface Location {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  locations: Location | null;
  positions: { id: string; name: string; color: string } | null;
}

interface TeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface SwapRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  myShifts: Shift[];
  teamMembers: TeamMember[];
}

export function SwapRequestDialog({
  open,
  onOpenChange,
  profile,
  myShifts,
  teamMembers,
}: SwapRequestDialogProps) {
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [selectedTargetShiftId, setSelectedTargetShiftId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [targetShifts, setTargetShifts] = useState<Shift[]>([]);
  const [loadingTargetShifts, setLoadingTargetShifts] = useState(false);

  const getDisplayName = (member: TeamMember) => {
    if (member.display_name) return member.display_name;
    if (member.first_name || member.last_name) {
      return `${member.last_name || ""} ${member.first_name || ""}`.trim();
    }
    return "Unknown";
  };

  const getInitials = (member: TeamMember) => {
    const name = getDisplayName(member);
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatShiftTime = (shift: Shift) => {
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    return `${format(start, "M/d (E)", { locale: ja })} ${format(start, "HH:mm")} - ${format(end, "HH:mm")}`;
  };

  // Load target user's shifts when target is selected
  const handleTargetChange = async (targetId: string) => {
    setSelectedTargetId(targetId);
    setSelectedTargetShiftId("");
    setTargetShifts([]);

    if (!targetId) return;

    setLoadingTargetShifts(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("shifts")
        .select(`
          id, start_time, end_time,
          locations (id, name),
          positions (id, name, color)
        `)
        .eq("user_id", targetId)
        .gte("start_time", now)
        .order("start_time", { ascending: true })
        .limit(20);

      if (error) throw error;
      setTargetShifts(data || []);
    } catch (error) {
      console.error("Error loading target shifts:", error);
      toast.error("相手のシフトの取得に失敗しました");
    } finally {
      setLoadingTargetShifts(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedShiftId) {
      toast.error("交換するシフトを選択してください");
      return;
    }

    if (!selectedTargetId) {
      toast.error("交換相手を選択してください");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("shift_swaps").insert({
        organization_id: profile.organization_id,
        requester_id: profile.id,
        requester_shift_id: selectedShiftId,
        target_id: selectedTargetId,
        target_shift_id: selectedTargetShiftId || null,
        reason: reason.trim() || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("シフト交換リクエストを送信しました");
      onOpenChange(false);
      resetForm();

      // Refresh the page to show new request
      window.location.reload();
    } catch (error) {
      console.error("Error creating swap request:", error);
      toast.error("リクエストの送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedShiftId("");
    setSelectedTargetId("");
    setSelectedTargetShiftId("");
    setReason("");
    setTargetShifts([]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const selectedShift = myShifts.find((s) => s.id === selectedShiftId);
  const selectedTarget = teamMembers.find((m) => m.id === selectedTargetId);
  const selectedTargetShift = targetShifts.find((s) => s.id === selectedTargetShiftId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            シフト交換リクエスト
          </DialogTitle>
          <DialogDescription>
            他のスタッフとシフトを交換するリクエストを送信します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* My Shift Selection */}
          <div className="space-y-2">
            <Label>交換するシフト *</Label>
            <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
              <SelectTrigger>
                <SelectValue placeholder="シフトを選択" />
              </SelectTrigger>
              <SelectContent>
                {myShifts.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    今後のシフトがありません
                  </div>
                ) : (
                  myShifts.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{formatShiftTime(shift)}</span>
                        {shift.locations && (
                          <span className="text-muted-foreground">
                            @ {shift.locations.name}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Shift Details */}
          {selectedShift && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatShiftTime(selectedShift)}</span>
              </div>
              {selectedShift.locations && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedShift.locations.name}</span>
                </div>
              )}
              {selectedShift.positions && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedShift.positions.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Target User Selection */}
          <div className="space-y-2">
            <Label>交換相手 *</Label>
            <Select value={selectedTargetId} onValueChange={handleTargetChange}>
              <SelectTrigger>
                <SelectValue placeholder="スタッフを選択" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    チームメンバーがいません
                  </div>
                ) : (
                  teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{getDisplayName(member)}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Target Shift Selection (Optional) */}
          {selectedTargetId && (
            <div className="space-y-2">
              <Label>
                相手のシフト（任意）
                <span className="ml-2 text-xs text-muted-foreground">
                  指定しない場合、相手が自分のシフトを選択します
                </span>
              </Label>
              <Select
                value={selectedTargetShiftId}
                onValueChange={setSelectedTargetShiftId}
                disabled={loadingTargetShifts}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingTargetShifts ? "読み込み中..." : "シフトを選択（任意）"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">指定しない</SelectItem>
                  {targetShifts.length === 0 && !loadingTargetShifts ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      {selectedTarget
                        ? `${getDisplayName(selectedTarget)}さんの今後のシフトがありません`
                        : "シフトがありません"}
                    </div>
                  ) : (
                    targetShifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{formatShiftTime(shift)}</span>
                          {shift.locations && (
                            <span className="text-muted-foreground">
                              @ {shift.locations.name}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Selected Target Shift Details */}
          {selectedTargetShift && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-3 text-sm space-y-1">
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                {selectedTarget && getDisplayName(selectedTarget)}さんのシフト
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatShiftTime(selectedTargetShift)}</span>
              </div>
              {selectedTargetShift.locations && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedTargetShift.locations.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>理由（任意）</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="交換の理由を入力してください..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedShiftId || !selectedTargetId}
            >
              {isSubmitting ? "送信中..." : "リクエストを送信"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
