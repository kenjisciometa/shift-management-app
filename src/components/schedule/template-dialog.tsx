"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiPost, apiPut, apiDelete } from "@/lib/api-client";
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
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

type ShiftTemplate = Database["public"]["Tables"]["shift_templates"]["Row"];

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ShiftTemplate | null;
  organizationId: string;
  onSaved?: () => void;
}

const colorOptions = [
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "red", label: "Red" },
  { value: "purple", label: "Purple" },
  { value: "pink", label: "Pink" },
  { value: "orange", label: "Orange" },
];

export function TemplateDialog({
  open,
  onOpenChange,
  template,
  organizationId,
  onSaved,
}: TemplateDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!template;

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 60,
    position: "",
    color: "blue",
  });

  useEffect(() => {
    if (open) {
      if (template) {
        setFormData({
          name: template.name,
          description: template.description || "",
          startTime: template.start_time,
          endTime: template.end_time,
          breakMinutes: template.break_minutes || 0,
          position: template.position || "",
          color: template.color || "blue",
        });
      } else {
        setFormData({
          name: "",
          description: "",
          startTime: "09:00",
          endTime: "17:00",
          breakMinutes: 60,
          position: "",
          color: "blue",
        });
      }
    }
  }, [open, template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    setLoading(true);

    try {
      const templateData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        start_time: formData.startTime,
        end_time: formData.endTime,
        break_minutes: formData.breakMinutes,
        position: formData.position.trim() || null,
        color: formData.color,
        is_active: true,
      };

      if (isEditing && template) {
        const response = await apiPut(`/api/shift-templates/${template.id}`, templateData);
        if (!response.success) {
          throw new Error(response.error || "Failed to update template");
        }
        toast.success("Template updated successfully");
      } else {
        const response = await apiPost("/api/shift-templates", templateData);
        if (!response.success) {
          throw new Error(response.error || "Failed to create template");
        }
        toast.success("Template created successfully");
      }

      onOpenChange(false);
      onSaved?.();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(isEditing ? "Failed to update template" : "Failed to create template");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;

    if (!confirm("Are you sure you want to delete this template?")) return;

    setDeleting(true);

    try {
      const response = await apiDelete(`/api/shift-templates/${template.id}`);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete template");
      }

      toast.success("Template deleted successfully");
      onOpenChange(false);
      onSaved?.();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Template" : "Create Shift Template"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the template details below."
              : "Create a reusable shift template."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              placeholder="e.g., Morning Shift"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, startTime: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, endTime: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="breakMinutes">Break (minutes)</Label>
            <Input
              id="breakMinutes"
              type="number"
              min="0"
              value={formData.breakMinutes}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  breakMinutes: parseInt(e.target.value) || 0,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position / Role</Label>
            <Input
              id="position"
              placeholder="e.g., Cashier, Server"
              value={formData.position}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, position: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Select
              value={formData.color}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, color: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: color.value }}
                      />
                      {color.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading || deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading || deleting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || deleting}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
