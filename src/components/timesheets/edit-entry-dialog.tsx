"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { TimesheetTableRow, TimesheetStatus } from "@/types/timesheet-table";
import type { TimesheetAccess } from "@/hooks/use-timesheet-access";

interface EditEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: TimesheetTableRow | null;
  access: TimesheetAccess;
  onSave: (data: EditEntryData) => Promise<void>;
}

export interface EditEntryData {
  entryId: string;
  clockInTime: string | null;
  clockOutTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  status?: TimesheetStatus;
  comment?: string;
}

export function EditEntryDialog({
  open,
  onOpenChange,
  entry,
  access,
  onSave,
}: EditEntryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    clockInTime: "",
    clockOutTime: "",
    breakStart: "",
    breakEnd: "",
    status: "pending" as TimesheetStatus,
    comment: "",
  });

  // Reset form when entry changes
  useEffect(() => {
    if (entry) {
      setFormData({
        clockInTime: entry.clockInTime || "",
        clockOutTime: entry.clockOutTime || "",
        breakStart: entry.breakStart || "",
        breakEnd: entry.breakEnd || "",
        status: entry.status,
        comment: "",
      });
    }
  }, [entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!entry) return;

    // Validate time format (HH:mm)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (formData.clockInTime && !timeRegex.test(formData.clockInTime)) {
      toast.error("Invalid clock in time format. Use HH:mm");
      return;
    }
    if (formData.clockOutTime && !timeRegex.test(formData.clockOutTime)) {
      toast.error("Invalid clock out time format. Use HH:mm");
      return;
    }
    if (formData.breakStart && !timeRegex.test(formData.breakStart)) {
      toast.error("Invalid break start time format. Use HH:mm");
      return;
    }
    if (formData.breakEnd && !timeRegex.test(formData.breakEnd)) {
      toast.error("Invalid break end time format. Use HH:mm");
      return;
    }

    setLoading(true);

    try {
      const data: EditEntryData = {
        entryId: entry.id,
        clockInTime: formData.clockInTime || null,
        clockOutTime: formData.clockOutTime || null,
        breakStart: formData.breakStart || null,
        breakEnd: formData.breakEnd || null,
      };

      // Only include status and comment if user can change status
      if (access.canApproveReject) {
        data.status = formData.status;
        if (formData.comment.trim()) {
          data.comment = formData.comment.trim();
        }
      }

      await onSave(data);
      toast.success("Entry updated successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating entry:", error);
      toast.error("Failed to update entry");
    } finally {
      setLoading(false);
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
          <DialogDescription>
            {access.canViewAllTimesheets
              ? `Edit time entry for ${entry.displayName}`
              : "Edit your time entry"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Name (shown for privileged users) */}
          {access.canViewAllTimesheets && (
            <div className="space-y-1">
              <Label className="text-muted-foreground">Employee</Label>
              <p className="font-medium">{entry.displayName}</p>
            </div>
          )}

          {/* Date */}
          <div className="space-y-1">
            <Label className="text-muted-foreground">Date</Label>
            <p className="font-medium">
              {format(new Date(entry.date), "MMMM d, yyyy")}
            </p>
          </div>

          {/* Clock In Time */}
          <div className="space-y-2">
            <Label htmlFor="clockInTime">Clock In Time</Label>
            <Input
              id="clockInTime"
              type="time"
              value={formData.clockInTime}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, clockInTime: e.target.value }))
              }
            />
          </div>

          {/* Clock Out Time */}
          <div className="space-y-2">
            <Label htmlFor="clockOutTime">Clock Out Time</Label>
            <Input
              id="clockOutTime"
              type="time"
              value={formData.clockOutTime}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, clockOutTime: e.target.value }))
              }
            />
          </div>

          {/* Break Start */}
          <div className="space-y-2">
            <Label htmlFor="breakStart">Break Start</Label>
            <Input
              id="breakStart"
              type="time"
              value={formData.breakStart}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, breakStart: e.target.value }))
              }
            />
          </div>

          {/* Break End */}
          <div className="space-y-2">
            <Label htmlFor="breakEnd">Break End</Label>
            <Input
              id="breakEnd"
              type="time"
              value={formData.breakEnd}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, breakEnd: e.target.value }))
              }
            />
          </div>

          {/* Status (privileged users only) */}
          {access.canApproveReject && (
            <>
              <div className="border-t pt-4">
                <Label className="mb-3 block">Status</Label>
                <RadioGroup
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: value as TimesheetStatus,
                    }))
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pending" id="status-pending" />
                    <Label htmlFor="status-pending" className="cursor-pointer">
                      Pending
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="approved" id="status-approved" />
                    <Label htmlFor="status-approved" className="cursor-pointer">
                      Approved
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rejected" id="status-rejected" />
                    <Label htmlFor="status-rejected" className="cursor-pointer">
                      Rejected
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Comment */}
              <div className="space-y-2">
                <Label htmlFor="comment">Comment (optional)</Label>
                <Textarea
                  id="comment"
                  value={formData.comment}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, comment: e.target.value }))
                  }
                  placeholder="Add a comment..."
                  rows={2}
                />
              </div>
            </>
          )}

          {/* Note for employees */}
          {access.isEmployee && (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              Note: Changes require manager approval
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
