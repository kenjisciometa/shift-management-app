"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type TaskAssignment = {
  id: string;
  user_id: string;
  assigned_by: string | null;
  created_at: string | null;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Task = Database["public"]["Tables"]["tasks"]["Row"] & {
  task_assignments: TaskAssignment[];
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
  } | null;
};

type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  profile: Profile;
  teamMembers: TeamMember[];
  isAdmin: boolean;
}

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function TaskDialog({
  open,
  onOpenChange,
  task,
  profile,
  teamMembers,
  isAdmin,
}: TaskDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "pending",
    dueDate: "",
    assignees: [] as string[],
  });

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || "",
        priority: task.priority || "medium",
        status: task.status || "pending",
        dueDate: task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd'T'HH:mm") : "",
        assignees: task.task_assignments.map((a) => a.user_id),
      });
    } else {
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        status: "pending",
        dueDate: "",
        assignees: [],
      });
    }
  }, [task, open]);

  const getDisplayName = (member: TeamMember) => {
    if (member.display_name) return member.display_name;
    return `${member.first_name} ${member.last_name}`;
  };

  const getInitials = (member: TeamMember) => {
    return `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
  };

  const handleAssigneeToggle = (memberId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignees: prev.assignees.includes(memberId)
        ? prev.assignees.filter((id) => id !== memberId)
        : [...prev.assignees, memberId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    setLoading(true);

    try {
      if (task) {
        // Update existing task
        const { error: taskError } = await supabase
          .from("tasks")
          .update({
            title: formData.title,
            description: formData.description || null,
            priority: formData.priority,
            status: formData.status,
            due_date: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
            completed_at: formData.status === "completed" && task.status !== "completed"
              ? new Date().toISOString()
              : formData.status !== "completed" ? null : task.completed_at,
            completed_by: formData.status === "completed" && task.status !== "completed"
              ? profile.id
              : formData.status !== "completed" ? null : task.completed_by,
          })
          .eq("id", task.id);

        if (taskError) throw taskError;

        // Update assignments
        // Get current assignment user IDs
        const currentAssignees = task.task_assignments.map((a) => a.user_id);

        // Find assignees to add
        const toAdd = formData.assignees.filter((id) => !currentAssignees.includes(id));

        // Find assignees to remove
        const toRemove = currentAssignees.filter((id) => !formData.assignees.includes(id));

        // Add new assignments
        if (toAdd.length > 0) {
          const { error: addError } = await supabase.from("task_assignments").insert(
            toAdd.map((userId) => ({
              task_id: task.id,
              user_id: userId,
              assigned_by: profile.id,
            }))
          );
          if (addError) throw addError;
        }

        // Remove old assignments
        if (toRemove.length > 0) {
          const { error: removeError } = await supabase
            .from("task_assignments")
            .delete()
            .eq("task_id", task.id)
            .in("user_id", toRemove);
          if (removeError) throw removeError;
        }

        toast.success("Task updated");
      } else {
        // Create new task
        console.log("Creating task with data:", {
          organization_id: profile.organization_id,
          title: formData.title,
          created_by: profile.id,
        });

        const { data: newTask, error: taskError } = await supabase
          .from("tasks")
          .insert({
            organization_id: profile.organization_id,
            title: formData.title,
            description: formData.description || null,
            priority: formData.priority,
            status: formData.status,
            due_date: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
            created_by: profile.id,
          })
          .select()
          .single();

        console.log("Task insert result:", { newTask, taskError });

        if (taskError) {
          console.error("Task insert error:", taskError);
          throw taskError;
        }

        // Create assignments
        if (formData.assignees.length > 0) {
          console.log("Creating assignments for task:", newTask.id);
          const { error: assignError } = await supabase.from("task_assignments").insert(
            formData.assignees.map((userId) => ({
              task_id: newTask.id,
              user_id: userId,
              assigned_by: profile.id,
            }))
          );
          console.log("Assignment insert result:", { assignError });
          if (assignError) {
            console.error("Assignment insert error:", assignError);
            throw assignError;
          }
        }

        toast.success("Task created");
      }

      onOpenChange(false);
      router.refresh();
    } catch (error: unknown) {
      // Log detailed error information
      console.error("Task error:", error);
      if (error && typeof error === "object") {
        console.error("Error details:", JSON.stringify(error, null, 2));
        console.error("Error message:", (error as { message?: string }).message);
        console.error("Error code:", (error as { code?: string }).code);
      }
      toast.error(task ? "Failed to update task" : "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Create Task"}</DialogTitle>
          <DialogDescription>
            {task
              ? "Update the task details below."
              : "Fill in the details to create a new task."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter task title"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Add a description..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
            />
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date (optional)</Label>
            <Input
              id="dueDate"
              type="datetime-local"
              value={formData.dueDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
              }
            />
          </div>

          {/* Assignees */}
          <div className="space-y-2">
            <Label>Assign to</Label>

            {/* Selected assignees */}
            {formData.assignees.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.assignees.map((userId) => {
                  const member = teamMembers.find((m) => m.id === userId);
                  if (!member) return null;
                  return (
                    <Badge
                      key={userId}
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
                        onClick={() => handleAssigneeToggle(userId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Team member list */}
            <div className="border rounded-md max-h-40 overflow-y-auto">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-muted ${
                    formData.assignees.includes(member.id) ? "bg-muted" : ""
                  }`}
                  onClick={() => handleAssigneeToggle(member.id)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(member)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {getDisplayName(member)}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {member.role}
                    </div>
                  </div>
                  {formData.assignees.includes(member.id) && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
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
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {task ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
