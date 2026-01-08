"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Position = Database["public"]["Tables"]["positions"]["Row"];

interface PositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position | null;
  organizationId: string;
}

const colorOptions = [
  { value: "blue", label: "Blue", bgClass: "bg-blue-500" },
  { value: "green", label: "Green", bgClass: "bg-green-500" },
  { value: "yellow", label: "Yellow", bgClass: "bg-yellow-500" },
  { value: "red", label: "Red", bgClass: "bg-red-500" },
  { value: "purple", label: "Purple", bgClass: "bg-purple-500" },
  { value: "pink", label: "Pink", bgClass: "bg-pink-500" },
  { value: "orange", label: "Orange", bgClass: "bg-orange-500" },
  { value: "cyan", label: "Cyan", bgClass: "bg-cyan-500" },
  { value: "indigo", label: "Indigo", bgClass: "bg-indigo-500" },
  { value: "teal", label: "Teal", bgClass: "bg-teal-500" },
];

export function PositionDialog({
  open,
  onOpenChange,
  position,
  organizationId,
}: PositionDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    color: "blue",
    description: "",
    sortOrder: "0",
    isActive: true,
  });

  useEffect(() => {
    if (position) {
      setFormData({
        name: position.name,
        color: position.color || "blue",
        description: position.description || "",
        sortOrder: String(position.sort_order || 0),
        isActive: position.is_active ?? true,
      });
    } else {
      setFormData({
        name: "",
        color: "blue",
        description: "",
        sortOrder: "0",
        isActive: true,
      });
    }
  }, [position, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Position name is required");
      return;
    }

    setLoading(true);

    try {
      const data = {
        organization_id: organizationId,
        name: formData.name.trim(),
        color: formData.color,
        description: formData.description.trim() || null,
        sort_order: parseInt(formData.sortOrder) || 0,
        is_active: formData.isActive,
      };

      if (position) {
        const { error } = await supabase
          .from("positions")
          .update(data)
          .eq("id", position.id);

        if (error) throw error;
        toast.success("Position updated");
      } else {
        const { error } = await supabase.from("positions").insert(data);

        if (error) throw error;
        toast.success("Position created");
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(position ? "Failed to update position" : "Failed to create position");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {position ? "Edit Position" : "Add Position"}
          </DialogTitle>
          <DialogDescription>
            {position
              ? "Update position details and color."
              : "Create a new position for shift assignments."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Position Name</Label>
            <Input
              id="name"
              placeholder="e.g., Cashier, Server, Manager"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-5 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={cn(
                    "h-10 rounded-md border-2 transition-all",
                    color.bgClass,
                    formData.color === color.value
                      ? "border-foreground ring-2 ring-foreground ring-offset-2"
                      : "border-transparent hover:border-muted-foreground/50"
                  )}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, color: color.value }))
                  }
                  title={color.label}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              This color will be used for shifts with this position
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Description of the position..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input
              id="sortOrder"
              type="number"
              min="0"
              value={formData.sortOrder}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, sortOrder: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Positions are displayed in ascending order
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="isActive">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive positions cannot be assigned to shifts
              </p>
            </div>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, isActive: checked }))
              }
            />
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
              {position ? "Save Changes" : "Add Position"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
