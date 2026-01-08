"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";

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

type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

interface ChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklist: Checklist | null;
  profile: Profile;
  teamMembers: TeamMember[];
  isAdmin: boolean;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function ChecklistDialog({
  open,
  onOpenChange,
  checklist,
  profile,
  teamMembers,
  isAdmin,
}: ChecklistDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isTemplate: true,
    isActive: true,
    items: [] as ChecklistItem[],
  });

  const [newItemLabel, setNewItemLabel] = useState("");

  // Reset form when checklist changes
  useEffect(() => {
    if (checklist) {
      const items = Array.isArray(checklist.items)
        ? (checklist.items as ChecklistItem[])
        : [];
      setFormData({
        name: checklist.name,
        description: checklist.description || "",
        isTemplate: checklist.is_template ?? true,
        isActive: checklist.is_active ?? true,
        items,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        isTemplate: true,
        isActive: true,
        items: [],
      });
    }
    setNewItemLabel("");
  }, [checklist, open]);

  const handleAddItem = () => {
    if (!newItemLabel.trim()) return;

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { id: generateId(), label: newItemLabel.trim(), required: false },
      ],
    }));
    setNewItemLabel("");
  };

  const handleRemoveItem = (itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleToggleRequired = (itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, required: !item.required } : item
      ),
    }));
  };

  const handleUpdateItemLabel = (itemId: string, label: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, label } : item
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter a checklist name");
      return;
    }

    if (formData.items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    setLoading(true);

    try {
      if (checklist) {
        // Update existing checklist
        const { error } = await supabase
          .from("checklists")
          .update({
            name: formData.name,
            description: formData.description || null,
            is_template: formData.isTemplate,
            is_active: formData.isActive,
            items: formData.items,
          })
          .eq("id", checklist.id);

        if (error) throw error;
        toast.success("Checklist updated");
      } else {
        // Create new checklist
        const { error } = await supabase.from("checklists").insert({
          organization_id: profile.organization_id,
          name: formData.name,
          description: formData.description || null,
          is_template: formData.isTemplate,
          is_active: formData.isActive,
          items: formData.items,
          created_by: profile.id,
        });

        if (error) throw error;
        toast.success("Checklist created");
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(checklist ? "Failed to update checklist" : "Failed to create checklist");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {checklist ? "Edit Checklist" : "Create Checklist"}
          </DialogTitle>
          <DialogDescription>
            {checklist
              ? "Update the checklist details below."
              : "Create a new checklist template with items."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Enter checklist name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
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
              rows={2}
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="isTemplate"
                checked={formData.isTemplate}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isTemplate: checked }))
                }
              />
              <Label htmlFor="isTemplate" className="cursor-pointer">
                Save as template
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active
              </Label>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <Label>Checklist Items</Label>

            {/* Existing items */}
            {formData.items.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                {formData.items.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 bg-muted rounded-md"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    <span className="text-sm text-muted-foreground w-6">
                      {index + 1}.
                    </span>
                    <Input
                      value={item.label}
                      onChange={(e) =>
                        handleUpdateItemLabel(item.id, e.target.value)
                      }
                      className="flex-1 h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={`h-8 px-2 ${item.required ? "text-orange-500" : "text-muted-foreground"}`}
                      onClick={() => handleToggleRequired(item.id)}
                    >
                      {item.required ? "Required" : "Optional"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new item */}
            <div className="flex gap-2">
              <Input
                placeholder="Add a new item..."
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddItem}
                disabled={!newItemLabel.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {formData.items.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No items added yet. Add items above.
              </p>
            )}
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
              {checklist ? "Save Changes" : "Create Checklist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
