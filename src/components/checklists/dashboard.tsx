"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  CheckSquare,
  MoreHorizontal,
  Loader2,
  ListChecks,
  FileText,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { ChecklistDialog } from "./checklist-dialog";
import { ChecklistExecuteDialog } from "./checklist-execute-dialog";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type ChecklistItem = {
  id: string;
  label: string;
  required?: boolean;
};

type Checklist = Database["public"]["Tables"]["checklists"]["Row"] & {
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
  } | null;
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

type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

interface ChecklistsDashboardProps {
  profile: Profile;
  checklists: Checklist[];
  assignments: ChecklistAssignment[];
  teamMembers: TeamMember[];
  isAdmin: boolean;
}

export function ChecklistsDashboard({
  profile,
  checklists,
  assignments,
  teamMembers,
  isAdmin,
}: ChecklistsDashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<ChecklistAssignment | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filter checklists
  const templates = checklists.filter((c) => c.is_template);
  const activeChecklists = checklists.filter((c) => !c.is_template && c.is_active);

  // Filter assignments
  const pendingAssignments = assignments.filter((a) => !a.completed_at);
  const completedAssignments = assignments.filter((a) => a.completed_at);

  const handleCreateChecklist = () => {
    setSelectedChecklist(null);
    setDialogOpen(true);
  };

  const handleEditChecklist = (checklist: Checklist) => {
    setSelectedChecklist(checklist);
    setDialogOpen(true);
  };

  const handleStartChecklist = (assignment: ChecklistAssignment) => {
    setSelectedAssignment(assignment);
    setExecuteDialogOpen(true);
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    setProcessingId(checklistId);
    try {
      // First delete assignments
      await supabase
        .from("checklist_assignments")
        .delete()
        .eq("checklist_id", checklistId);

      // Then delete checklist
      const { error } = await supabase
        .from("checklists")
        .delete()
        .eq("id", checklistId);

      if (error) throw error;

      toast.success("Checklist deleted");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete checklist");
    } finally {
      setProcessingId(null);
    }
  };

  const getDisplayName = (p: { first_name: string; last_name: string; display_name: string | null } | null) => {
    if (!p) return "Unknown";
    if (p.display_name) return p.display_name;
    return `${p.first_name} ${p.last_name}`;
  };

  const getChecklistItems = (checklist: Checklist): ChecklistItem[] => {
    if (!checklist.items) return [];
    if (Array.isArray(checklist.items)) return checklist.items as ChecklistItem[];
    return [];
  };

  const getAssignmentProgress = (assignment: ChecklistAssignment): { completed: number; total: number } => {
    const items = assignment.checklists?.items;
    if (!items || !Array.isArray(items)) return { completed: 0, total: 0 };

    const progress = assignment.progress as Record<string, boolean> | null;
    if (!progress) return { completed: 0, total: items.length };

    const completed = Object.values(progress).filter(Boolean).length;
    return { completed, total: items.length };
  };

  const renderChecklistCard = (checklist: Checklist) => {
    const items = getChecklistItems(checklist);

    return (
      <Card key={checklist.id} className="group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {checklist.is_template && (
                  <Badge variant="secondary">Template</Badge>
                )}
              </div>

              <h3
                className="font-medium cursor-pointer hover:text-primary truncate"
                onClick={() => handleEditChecklist(checklist)}
              >
                {checklist.name}
              </h3>

              {checklist.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {checklist.description}
                </p>
              )}

              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <ListChecks className="h-3.5 w-3.5" />
                  <span>{items.length} items</span>
                </div>
                <span>
                  Created by {getDisplayName(checklist.profiles)}
                </span>
              </div>
            </div>

            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    disabled={processingId === checklist.id}
                  >
                    {processingId === checklist.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEditChecklist(checklist)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDeleteChecklist(checklist.id)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderAssignmentCard = (assignment: ChecklistAssignment) => {
    const { completed, total } = getAssignmentProgress(assignment);
    const progressPercent = total > 0 ? (completed / total) * 100 : 0;
    const isComplete = assignment.completed_at !== null;

    return (
      <Card
        key={assignment.id}
        className={`group cursor-pointer ${isComplete ? "opacity-60" : ""}`}
        onClick={() => !isComplete && handleStartChecklist(assignment)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <h3 className="font-medium truncate">
                  {assignment.checklists?.name || "Unknown Checklist"}
                </h3>
              </div>

              {assignment.checklists?.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                  {assignment.checklists.description}
                </p>
              )}

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {completed} / {total}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {assignment.shifts && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Shift: {format(parseISO(assignment.shifts.start_time), "MMM d, h:mm a")}
                </div>
              )}

              {isComplete && assignment.completed_at && (
                <div className="mt-2 text-xs text-green-600">
                  Completed {format(parseISO(assignment.completed_at), "MMM d, h:mm a")}
                </div>
              )}
            </div>
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
              Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{templates.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Checklists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{activeChecklists.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Circle className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold">{pendingAssignments.length}</span>
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
              <span className="text-2xl font-bold">{completedAssignments.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Button */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={handleCreateChecklist}>
            <Plus className="h-4 w-4 mr-2" />
            Create Checklist
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="my-checklists">
        <TabsList>
          <TabsTrigger value="my-checklists">My Checklists</TabsTrigger>
          {isAdmin && <TabsTrigger value="templates">Templates</TabsTrigger>}
          {isAdmin && <TabsTrigger value="all">All Checklists</TabsTrigger>}
        </TabsList>

        <TabsContent value="my-checklists" className="mt-4">
          {assignments.length > 0 ? (
            <div className="space-y-4">
              {pendingAssignments.length > 0 && (
                <>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Pending ({pendingAssignments.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pendingAssignments.map(renderAssignmentCard)}
                  </div>
                </>
              )}
              {completedAssignments.length > 0 && (
                <>
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">
                      Completed ({completedAssignments.length})
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {completedAssignments.slice(0, 6).map(renderAssignmentCard)}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No checklists assigned to you</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="templates" className="mt-4">
            {templates.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map(renderChecklistCard)}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No checklist templates</p>
                  <Button variant="link" onClick={handleCreateChecklist}>
                    Create your first template
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="all" className="mt-4">
            {checklists.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {checklists.map(renderChecklistCard)}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No checklists yet</p>
                  <Button variant="link" onClick={handleCreateChecklist}>
                    Create your first checklist
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Checklist Dialog */}
      <ChecklistDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        checklist={selectedChecklist}
        profile={profile}
        teamMembers={teamMembers}
        isAdmin={isAdmin}
      />

      {/* Checklist Execute Dialog */}
      {selectedAssignment && (
        <ChecklistExecuteDialog
          open={executeDialogOpen}
          onOpenChange={setExecuteDialogOpen}
          assignment={selectedAssignment}
          profile={profile}
        />
      )}
    </div>
  );
}
