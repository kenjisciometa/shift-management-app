"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isPast, isToday } from "date-fns";
import { apiPut, apiDelete } from "@/lib/api-client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertCircle,
  MoreHorizontal,
  Loader2,
  ClipboardList,
  Circle,
  PlayCircle,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

const priorityConfig: Record<string, { label: string; className: string; order: number }> = {
  low: {
    label: "Low",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
    order: 1,
  },
  medium: {
    label: "Medium",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    order: 2,
  },
  high: {
    label: "High",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    order: 3,
  },
  urgent: {
    label: "Urgent",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    order: 4,
  },
};

const statusOrder: Record<string, number> = {
  pending: 1,
  in_progress: 2,
  completed: 3,
  cancelled: 4,
};

type SortField = "priority" | "status" | "due_date";
type SortOrder = "asc" | "desc";

interface SortState {
  field: SortField;
  order: SortOrder;
}

function SortableHeader({
  field,
  label,
  currentSort,
  onSortChange,
  className,
}: {
  field: SortField;
  label: string;
  currentSort: SortState;
  onSortChange: (sort: SortState) => void;
  className?: string;
}) {
  const isActive = currentSort.field === field;

  const handleClick = () => {
    if (isActive) {
      onSortChange({
        field,
        order: currentSort.order === "asc" ? "desc" : "asc",
      });
    } else {
      onSortChange({ field, order: "asc" });
    }
  };

  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:bg-muted/50", className)}
      onClick={handleClick}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentSort.order === "asc" ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </TableHead>
  );
}

export function TasksDashboard({
  profile,
  tasks,
  teamMembers,
  isAdmin,
}: TasksDashboardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>({ field: "priority", order: "desc" });

  // Sort tasks
  const sortTasks = (taskList: Task[]) => {
    return [...taskList].sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case "priority": {
          const aPriority = priorityConfig[a.priority || "medium"]?.order || 2;
          const bPriority = priorityConfig[b.priority || "medium"]?.order || 2;
          comparison = aPriority - bPriority;
          break;
        }
        case "status": {
          const aStatus = statusOrder[a.status || "pending"] || 1;
          const bStatus = statusOrder[b.status || "pending"] || 1;
          comparison = aStatus - bStatus;
          break;
        }
        case "due_date": {
          const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          comparison = aDate - bDate;
          break;
        }
      }

      return sort.order === "asc" ? comparison : -comparison;
    });
  };

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
      const response = await apiPut(`/api/tasks/${taskId}/status`, {
        status: newStatus,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to update task");
      }

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
      const response = await apiDelete(`/api/tasks/${taskId}`);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete task");
      }

      toast.success("Task deleted");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete task");
    } finally {
      setProcessingId(null);
    }
  };

  const getInitials = (p: { first_name: string; last_name: string } | null) => {
    if (!p) return "?";
    return `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
  };

  const renderTaskTable = (taskList: Task[], showCompleted = false) => {
    const activeTasks = sortTasks(
      taskList.filter((t) => t.status !== "completed" && t.status !== "cancelled")
    );
    const completedTasksInList = sortTasks(
      taskList.filter((t) => t.status === "completed")
    );

    if (taskList.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No tasks found</p>
            <Button variant="link" onClick={handleCreateTask}>
              Create your first task
            </Button>
          </CardContent>
        </Card>
      );
    }

    const renderTableRows = (tasksToRender: Task[], isCompleted = false) => {
      return tasksToRender.map((task) => {
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
          <TableRow
            key={task.id}
            className={isCompleted ? "opacity-60" : undefined}
          >
            <TableCell>
              <Badge className={priority.className} variant="secondary">
                {priority.label}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={status.className} variant="secondary">
                <status.icon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span
                  className="font-medium cursor-pointer hover:text-primary"
                  onClick={() => handleEditTask(task)}
                >
                  {task.title}
                </span>
                {task.description && (
                  <span className="text-sm text-muted-foreground line-clamp-1">
                    {task.description}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              {task.due_date ? (
                <div
                  className={`flex items-center gap-1 ${
                    isOverdue
                      ? "text-destructive"
                      : isDueToday
                      ? "text-orange-500"
                      : ""
                  }`}
                >
                  {isOverdue && <AlertCircle className="h-3.5 w-3.5" />}
                  <span>
                    {isDueToday
                      ? "Today"
                      : format(parseISO(task.due_date), "MMM d, yyyy")}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              {task.task_assignments.length > 0 ? (
                <div className="flex items-center gap-1">
                  <div className="flex -space-x-2">
                    {task.task_assignments.slice(0, 3).map((assignment) => (
                      <Avatar
                        key={assignment.id}
                        className="h-6 w-6 border-2 border-background"
                      >
                        <AvatarImage
                          src={assignment.profiles?.avatar_url || undefined}
                        />
                        <AvatarFallback className="text-xs">
                          {getInitials(assignment.profiles)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  {task.task_assignments.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{task.task_assignments.length - 3}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
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
            </TableCell>
          </TableRow>
        );
      });
    };

    return (
      <div className="space-y-6">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader
                  field="priority"
                  label="Priority"
                  currentSort={sort}
                  onSortChange={setSort}
                  className="w-[100px]"
                />
                <SortableHeader
                  field="status"
                  label="Status"
                  currentSort={sort}
                  onSortChange={setSort}
                  className="w-[120px]"
                />
                <TableHead>Title</TableHead>
                <SortableHeader
                  field="due_date"
                  label="Due Date"
                  currentSort={sort}
                  onSortChange={setSort}
                  className="w-[120px]"
                />
                <TableHead className="w-[120px]">Assignees</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeTasks.length > 0 ? (
                renderTableRows(activeTasks)
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No active tasks
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {showCompleted && completedTasksInList.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Completed ({completedTasksInList.length})
            </h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader
                      field="priority"
                      label="Priority"
                      currentSort={sort}
                      onSortChange={setSort}
                      className="w-[100px]"
                    />
                    <SortableHeader
                      field="status"
                      label="Status"
                      currentSort={sort}
                      onSortChange={setSort}
                      className="w-[120px]"
                    />
                    <TableHead>Title</TableHead>
                    <SortableHeader
                      field="due_date"
                      label="Due Date"
                      currentSort={sort}
                      onSortChange={setSort}
                      className="w-[120px]"
                    />
                    <TableHead className="w-[120px]">Assignees</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderTableRows(completedTasksInList.slice(0, 5), true)}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Pending</span>
              <div className="flex items-center gap-1.5">
                <Circle className="h-4 w-4 text-gray-500" />
                <span className="text-lg font-bold">{pendingTasks.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">In Progress</span>
              <div className="flex items-center gap-1.5">
                <PlayCircle className="h-4 w-4 text-blue-500" />
                <span className="text-lg font-bold">{inProgressTasks.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Completed</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-lg font-bold">{completedTasks.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Overdue</span>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-lg font-bold">{overdueTasks.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks Tabs */}
      <Tabs defaultValue="all">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Tasks</TabsTrigger>
            <TabsTrigger value="my-tasks">My Tasks</TabsTrigger>
            {overdueTasks.length > 0 && (
              <TabsTrigger value="overdue" className="text-destructive">
                Overdue ({overdueTasks.length})
              </TabsTrigger>
            )}
          </TabsList>
          <Button onClick={handleCreateTask}>
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </div>

        <TabsContent value="all" className="mt-4">
          {renderTaskTable(tasks, true)}
        </TabsContent>

        <TabsContent value="my-tasks" className="mt-4">
          {renderTaskTable(myTasks, true)}
        </TabsContent>

        {overdueTasks.length > 0 && (
          <TabsContent value="overdue" className="mt-4">
            {renderTaskTable(overdueTasks, false)}
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
