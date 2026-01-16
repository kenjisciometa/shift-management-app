"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, addDays, parseISO, isBefore } from "date-fns";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Clock, MapPin, User, ArrowRightLeft, AlertCircle } from "lucide-react";
import type { TeamSettings } from "@/components/settings/team-settings";
import { createShiftSwapNotification } from "@/lib/notifications";

interface Profile {
  id: string;
  organization_id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
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
  settings?: TeamSettings;
}

export function SwapRequestDialog({
  open,
  onOpenChange,
  profile,
  myShifts,
  teamMembers,
  settings,
}: SwapRequestDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [selectedTargetShiftId, setSelectedTargetShiftId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [targetShifts, setTargetShifts] = useState<Shift[]>([]);
  const [loadingTargetShifts, setLoadingTargetShifts] = useState(false);

  // Get settings with defaults
  const maxDaysInAdvance = settings?.shiftSwapSettings?.maxDaysInAdvance ?? 0;
  const allowCrossPositionSwaps = settings?.shiftSwapSettings?.allowCrossPositionSwaps ?? true;

  // Filter myShifts based on maxDaysInAdvance
  const filteredMyShifts = useMemo(() => {
    if (maxDaysInAdvance === 0) return myShifts; // 0 means unlimited

    const maxDate = addDays(new Date(), maxDaysInAdvance);
    return myShifts.filter((shift) => {
      const shiftDate = parseISO(shift.start_time);
      return isBefore(shiftDate, maxDate);
    });
  }, [myShifts, maxDaysInAdvance]);

  // Get selected shift for cross-position validation
  const selectedShift = filteredMyShifts.find((s) => s.id === selectedShiftId);

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
    return `${format(start, "M/d (EEE)")} ${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
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
      let query = supabase
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

      // Apply maxDaysInAdvance filter
      if (maxDaysInAdvance > 0) {
        const maxDate = addDays(new Date(), maxDaysInAdvance).toISOString();
        query = query.lte("start_time", maxDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by position if cross-position swaps are not allowed
      let filteredData = data || [];
      if (!allowCrossPositionSwaps && selectedShift?.positions?.id) {
        filteredData = filteredData.filter(
          (shift) => shift.positions?.id === selectedShift.positions?.id
        );
      }

      setTargetShifts(filteredData);
    } catch (error) {
      console.error("Error loading target shifts:", error);
      toast.error("Failed to load target's shifts");
    } finally {
      setLoadingTargetShifts(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedShiftId) {
      toast.error("Please select a shift to swap");
      return;
    }

    if (!selectedTargetId) {
      toast.error("Please select a swap partner");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: newSwap, error } = await supabase
        .from("shift_swaps")
        .insert({
          organization_id: profile.organization_id,
          requester_id: profile.id,
          requester_shift_id: selectedShiftId,
          target_id: selectedTargetId,
          target_shift_id: selectedTargetShiftId || null,
          reason: reason.trim() || null,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) throw error;

      // Get requester's name
      const requesterName = profile.display_name ||
        `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
        "A team member";

      // Get target's name
      const targetMember = teamMembers.find(m => m.id === selectedTargetId);
      const targetName = targetMember
        ? (targetMember.display_name || `${targetMember.first_name || ""} ${targetMember.last_name || ""}`.trim())
        : "Unknown";

      // Send notification to target user
      await createShiftSwapNotification(supabase, {
        userId: selectedTargetId,
        organizationId: profile.organization_id,
        type: "swap_requested",
        requesterName,
        shiftDate: selectedShift?.start_time || new Date().toISOString(),
        swapId: newSwap.id,
      });

      // Notify managers if setting is enabled
      const notifyManagers = settings?.shiftSwapSettings?.notifyManagersOnRequest ?? true;
      if (notifyManagers) {
        // Fetch managers/admins in the organization
        const { data: managers } = await supabase
          .from("profiles")
          .select("id")
          .eq("organization_id", profile.organization_id)
          .in("role", ["admin", "owner", "manager"])
          .neq("id", profile.id); // Don't notify the requester if they're a manager

        if (managers && managers.length > 0) {
          // Send notification to each manager
          for (const manager of managers) {
            await createShiftSwapNotification(supabase, {
              userId: manager.id,
              organizationId: profile.organization_id,
              type: "swap_manager_notification",
              requesterName,
              targetName,
              shiftDate: selectedShift?.start_time || new Date().toISOString(),
              swapId: newSwap.id,
            });
          }
        }
      }

      toast.success("Shift swap request sent");
      onOpenChange(false);
      resetForm();

      // Refresh the page to show new request
      router.refresh();
    } catch (error: any) {
      console.error("Error creating swap request:", error?.message || error?.code || error);
      toast.error(error?.message || "Failed to send request");
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

  const selectedTarget = teamMembers.find((m) => m.id === selectedTargetId);
  const selectedTargetShift = targetShifts.find((s) => s.id === selectedTargetShiftId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Request Shift Swap
          </DialogTitle>
          <DialogDescription>
            Send a request to swap shifts with another staff member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* My Shift Selection */}
          <div className="space-y-2">
            <Label>Shift to Swap *</Label>
            <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
              <SelectTrigger>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {filteredMyShifts.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    {myShifts.length === 0
                      ? "No upcoming shifts"
                      : `No shifts within ${maxDaysInAdvance} days`}
                  </div>
                ) : (
                  filteredMyShifts.map((shift) => (
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
            <Label>Swap Partner *</Label>
            <Select value={selectedTargetId} onValueChange={handleTargetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No team members
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
                Partner's Shift (Optional)
                <span className="ml-2 text-xs text-muted-foreground">
                  If not specified, the partner will select their shift
                </span>
              </Label>
              <Select
                value={selectedTargetShiftId || "none"}
                onValueChange={(value) => setSelectedTargetShiftId(value === "none" ? "" : value)}
                disabled={loadingTargetShifts}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingTargetShifts ? "Loading..." : "Select shift (optional)"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {targetShifts.length === 0 && !loadingTargetShifts ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      {selectedTarget
                        ? `${getDisplayName(selectedTarget)} has no upcoming shifts`
                        : "No shifts available"}
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
                {selectedTarget && getDisplayName(selectedTarget)}'s Shift
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
            <Label>Reason (Optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for swap..."
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
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedShiftId || !selectedTargetId}
            >
              {isSubmitting ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
