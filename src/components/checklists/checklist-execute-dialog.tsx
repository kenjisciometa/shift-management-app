"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type ChecklistItem = {
  id: string;
  label: string;
  required?: boolean;
};

type ChecklistAssignment = Database["public"]["Tables"]["checklist_assignments"]["Row"] & {
  checklists: {
    id: string;
    name: string;
    description: string | null;
    items: ChecklistItem[] | unknown;
  } | null;
  shifts: {
    id: string;
    start_time: string;
    end_time: string;
  } | null;
};

interface ChecklistExecuteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: ChecklistAssignment;
  profile: Profile;
}

export function ChecklistExecuteDialog({
  open,
  onOpenChange,
  assignment,
  profile,
}: ChecklistExecuteDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  // Get items from checklist
  const items: ChecklistItem[] = Array.isArray(assignment.checklists?.items)
    ? (assignment.checklists.items as ChecklistItem[])
    : [];

  // Initialize progress state
  const [progress, setProgress] = useState<Record<string, boolean>>({});

  // Reset progress when assignment changes
  useEffect(() => {
    if (assignment.progress && typeof assignment.progress === "object") {
      setProgress(assignment.progress as Record<string, boolean>);
    } else {
      // Initialize all items as unchecked
      const initialProgress: Record<string, boolean> = {};
      items.forEach((item) => {
        initialProgress[item.id] = false;
      });
      setProgress(initialProgress);
    }
  }, [assignment, open]);

  const handleToggle = async (itemId: string) => {
    const newProgress = { ...progress, [itemId]: !progress[itemId] };
    setProgress(newProgress);

    // Save progress to database
    try {
      const { error } = await supabase
        .from("checklist_assignments")
        .update({ progress: newProgress })
        .eq("id", assignment.id);

      if (error) throw error;
    } catch (error) {
      console.error(error);
      // Revert on error
      setProgress(progress);
    }
  };

  const completedCount = Object.values(progress).filter(Boolean).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Check if all required items are completed
  const requiredItems = items.filter((item) => item.required);
  const allRequiredCompleted = requiredItems.every((item) => progress[item.id]);
  const allCompleted = completedCount === totalCount;

  const handleComplete = async () => {
    if (!allRequiredCompleted) {
      toast.error("Please complete all required items");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("checklist_assignments")
        .update({
          progress,
          completed_at: new Date().toISOString(),
        })
        .eq("id", assignment.id);

      if (error) throw error;

      toast.success("Checklist completed!");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to complete checklist");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{assignment.checklists?.name || "Checklist"}</DialogTitle>
          <DialogDescription>
            {assignment.checklists?.description ||
              "Complete all items in this checklist."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {completedCount} / {totalCount}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Warning for incomplete required items */}
          {requiredItems.length > 0 && !allRequiredCompleted && (
            <div className="flex items-center gap-2 p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                Complete all required items (marked with *) to finish
              </span>
            </div>
          )}

          {/* Checklist Items */}
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  progress[item.id]
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                    : "bg-background hover:bg-muted"
                }`}
              >
                <Checkbox
                  id={item.id}
                  checked={progress[item.id] || false}
                  onCheckedChange={() => handleToggle(item.id)}
                  className="mt-0.5"
                />
                <label
                  htmlFor={item.id}
                  className={`flex-1 text-sm cursor-pointer ${
                    progress[item.id] ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  <span className="text-muted-foreground mr-2">{index + 1}.</span>
                  {item.label}
                  {item.required && (
                    <span className="text-orange-500 ml-1">*</span>
                  )}
                </label>
                {progress[item.id] && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Close
          </Button>
          <Button
            onClick={handleComplete}
            disabled={loading || !allRequiredCompleted}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {allCompleted ? "Complete Checklist" : "Mark as Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
