"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiDelete } from "@/lib/api-client";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Layers, Plus, Clock, MoreVertical, Edit, Trash2, Copy } from "lucide-react";
import { TemplateDialog } from "./template-dialog";

type ShiftTemplate = Database["public"]["Tables"]["shift_templates"]["Row"];

interface TemplatesManagerProps {
  organizationId: string;
  onApplyTemplate?: (template: ShiftTemplate) => void;
}

export function TemplatesManager({
  organizationId,
  onApplyTemplate,
}: TemplatesManagerProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ShiftTemplate | null>(
    null
  );

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await apiGet<ShiftTemplate[]>("/api/shift-templates?is_active=true");

      if (!response.success) {
        throw new Error(response.error || "Failed to load templates");
      }
      setTemplates(response.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sheetOpen) {
      fetchTemplates();
    }
  }, [sheetOpen, organizationId]);

  const handleEdit = (template: ShiftTemplate) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setDialogOpen(true);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const response = await apiDelete(`/api/shift-templates/${templateId}`);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete template");
      }

      toast.success("Template deleted");
      fetchTemplates();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete template");
    }
  };

  const handleApply = (template: ShiftTemplate) => {
    onApplyTemplate?.(template);
    setSheetOpen(false);
    toast.success(`Applied template: ${template.name}`);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const calculateDuration = (start: string, end: string, breakMins: number) => {
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM) - breakMins;
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            <Layers className="h-4 w-4 mr-2" />
            Templates
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Shift Templates</SheetTitle>
            <SheetDescription>
              Create and manage reusable shift templates. Click on a template to
              apply it when creating a new shift.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <Button onClick={handleCreate} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-2/3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : templates.length > 0 ? (
              <div className="space-y-3">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => onApplyTemplate && handleApply(template)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: template.color || "blue",
                              }}
                            />
                            <span className="font-medium">{template.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTime(template.start_time)} -{" "}
                            {formatTime(template.end_time)}
                            <Badge variant="secondary" className="text-xs">
                              {calculateDuration(
                                template.start_time,
                                template.end_time,
                                template.break_minutes || 0
                              )}
                            </Badge>
                          </div>
                          {template.position && (
                            <div className="text-sm text-muted-foreground">
                              {template.position}
                            </div>
                          )}
                          {template.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-[280px]">
                              {template.description}
                            </div>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(template);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {onApplyTemplate && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApply(template);
                                }}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Apply
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(template.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No templates yet</p>
                  <p className="text-sm text-muted-foreground">
                    Create your first shift template
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={selectedTemplate}
        organizationId={organizationId}
        onSaved={fetchTemplates}
      />
    </>
  );
}
