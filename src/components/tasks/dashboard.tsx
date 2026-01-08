"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isPast, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreHorizontal,
  Loader2,
  ClipboardList,
  Circle,
  PlayCircle,
  XCircle,
  Calendar,
} from "lucide-react";
import { TaskDialog } from "./task-dialog";

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

interface TasksDashboardProps {
  profile: Profile;
  tasks: Task[];
  teamMembers: TeamMember[];
  isAdmin: boolean;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: {
    label: "Pending",
    icon: Circle,
    className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  },
  in_progress: {
    label: "In Progress",
    icon: PlayCircle,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: {
    label: "Low",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
  },
  medium: {
    label: "Medium",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  high: {
    label: "High",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  urgent: {
    label: "Urgent",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
};

export function TasksDashboard({
  profile,
  tasks,
  teamMembers,
  isAdmin,
}: TasksDashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filter tasks
  const myTasks = tasks.filter((task) =>
    task.task_assignments.some((a) => a.user_id === profile.id)
  );
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const overdueTasks = tasks.filter(
    (t) =>
      t.due_date &&
      isPast(parseISO(t.due_date)) &&
      !isToday(parseISO(t.due_date)) &&
      t.status !== "completed" &&
      t.status !== "cancelled"
  );

  const handleCreateTask = () => {
    setSelectedTask(null);
    setDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setProcessingId(taskId);
    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
      };

      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = profile.id;
      } else {
        updateData.completed_at = null;
        updateData.completed_by = null;
      }

      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId);

      if (error) throw error;

      toast.success(`Task marked as ${statusConfig[newStatus].label}`);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update task");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setProcessingId(taskId);
    try {
      // First delete assignments
      await supabase.from("task_assignments").delete().eq("task_id", taskId);

      // Then delete task
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);

      if (error) throw error;

      toast.success("Task deleted");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete task");
    } finally {
      setProcessingId(null);
    }
  };

  const getDisplayName = (p: { first_name: string; last_name: string; display_name: string | null } | null) => {
    if (!p) return "Unknown";
    if (p.display_name) return p.display_name;
    return `${p.first_name} ${p.last_name}`;
  };

  const getInitials = (p: { first_name: string; last_name: string } | null) => {
    if (!p) return "?";
    return `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
  };

  const renderTaskCard = (task: Task) => {
    const status = statusConfig[task.status || "pending"];
    const priority = priorityConfig[task.priority || "medium"];
    const isOverdue =
      task.due_date &&
      isPast(parseISO(task.due_date)) &&
      !isToday(parseISO(task.due_date)) &&
      task.status !== "completed" &&
      task.status !== "cancelled";
    const isDueToday = task.due_date && isToday(parseISO(task.due_date));

    return (
      <Card key={task.id} className="group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={priority.className} variant="secondary">
                  {priority.label}
                </Badge>
                <Badge className={status.className} variant="secondary">
                  <status.icon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Overdue
                  </Badge>
                )}
              </div>

              <h3
                className="font-medium cursor-pointer hover:text-primary truncate"
                onClick={() => handleEditTask(task)}
              >
                {task.title}
              </h3>

              {task.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}

              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                {task.due_date && (
                  <div className={`flex items-center gap-1 ${isOverdue ? "text-destructive" : isDueToday ? "text-orange-500" : ""}`}>
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {isDueToday ? "Today" : format(parseISO(task.due_date), "MMM d, yyyy")}
                    </span>
                  </div>
                )}
                {task.task_assignments.length > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-2">
                      {task.task_assignments.slice(0, 3).map((assignment) => (
                        <Avatar key={assignment.id} className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={assignment.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(assignment.profiles)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {task.task_assignments.length > 3 && (
                      <span className="text-xs">+{task.task_assignments.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  disabled={processingId === task.id}
                >
                  {processingId === task.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEditTask(task)}>
                  Edit
                </DropdownMenuItem>
                {task.status !== "completed" && (
                  <>
                    {task.status === "pending" && (
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(task.id, "in_progress")}
                      >
                        Start Progress
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleStatusChange(task.id, "completed")}
                    >
                      Mark Complete
                    </DropdownMenuItem>
                  </>
                )}
                {task.status === "completed" && (
                  <DropdownMenuItem
                    onClick={() => handleStatusChange(task.id, "pending")}
                  >
                    Reopen
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDeleteTask(task.id)}
                  >
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Circle className="h-5 w-5 text-gray-500" />
              <span className="text-2xl font-bold">{pendingTasks.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{inProgressTasks.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{completedTasks.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{overdueTasks.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Button */}
      <div className="flex justify-end">
        <Button onClick={handleCreateTask}>
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </div>

      {/* Tasks Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Tasks</TabsTrigger>
          <TabsTrigger value="my-tasks">My Tasks</TabsTrigger>
          {overdueTasks.length > 0 && (
            <TabsTrigger value="overdue" className="text-destructive">
              Overdue ({overdueTasks.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks
                .filter((t) => t.status !== "completed" && t.status !== "cancelled")
                .map(renderTaskCard)}
              {completedTasks.length > 0 && (
                <>
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">
                      Completed ({completedTasks.length})
                    </h3>
                    <div className="space-y-4 opacity-60">
                      {completedTasks.slice(0, 5).map(renderTaskCard)}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tasks yet</p>
                <Button variant="link" onClick={handleCreateTask}>
                  Create your first task
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="my-tasks" className="mt-4">
          {myTasks.length > 0 ? (
            <div className="space-y-4">
              {myTasks
                .filter((t) => t.status !== "completed" && t.status !== "cancelled")
                .map(renderTaskCard)}
              {myTasks.filter((t) => t.status === "completed").length > 0 && (
                <>
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">
                      Completed
                    </h3>
                    <div className="space-y-4 opacity-60">
                      {myTasks
                        .filter((t) => t.status === "completed")
                        .slice(0, 5)
                        .map(renderTaskCard)}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tasks assigned to you</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {overdueTasks.length > 0 && (
          <TabsContent value="overdue" className="mt-4">
            <div className="space-y-4">
              {overdueTasks.map(renderTaskCard)}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Task Dialog */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={selectedTask}
        profile={profile}
        teamMembers={teamMembers}
        isAdmin={isAdmin}
      />
    </div>
  );
}
