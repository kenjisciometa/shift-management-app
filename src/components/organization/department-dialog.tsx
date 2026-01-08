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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Department = Database["public"]["Tables"]["departments"]["Row"] & {
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
  role: string | null;
};

interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
  organizationId: string;
  teamMembers: TeamMember[];
}

export function DepartmentDialog({
  open,
  onOpenChange,
  department,
  organizationId,
  teamMembers,
}: DepartmentDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    managerId: "",
    sortOrder: "0",
    isActive: true,
  });

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name,
        code: department.code || "",
        description: department.description || "",
        managerId: department.manager_id || "",
        sortOrder: String(department.sort_order || 0),
        isActive: department.is_active ?? true,
      });
    } else {
      setFormData({
        name: "",
        code: "",
        description: "",
        managerId: "",
        sortOrder: "0",
        isActive: true,
      });
    }
  }, [department, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Department name is required");
      return;
    }

    setLoading(true);

    try {
      const data = {
        organization_id: organizationId,
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        description: formData.description.trim() || null,
        manager_id: formData.managerId || null,
        sort_order: parseInt(formData.sortOrder) || 0,
        is_active: formData.isActive,
      };

      if (department) {
        const { error } = await supabase
          .from("departments")
          .update(data)
          .eq("id", department.id);

        if (error) throw error;
        toast.success("Department updated");
      } else {
        const { error } = await supabase.from("departments").insert(data);

        if (error) throw error;
        toast.success("Department created");
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(department ? "Failed to update department" : "Failed to create department");
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (member: TeamMember) => {
    if (member.display_name) return member.display_name;
    return `${member.first_name} ${member.last_name}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {department ? "Edit Department" : "Add Department"}
          </DialogTitle>
          <DialogDescription>
            {department
              ? "Update department details and settings."
              : "Create a new department for your organization."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Department Name</Label>
            <Input
              id="name"
              placeholder="Engineering"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Department Code (optional)</Label>
            <Input
              id="code"
              placeholder="ENG"
              value={formData.code}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
              }
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Short code for identification (max 10 characters)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Description of the department..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager">Department Manager</Label>
            <Select
              value={formData.managerId}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, managerId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No manager</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {getDisplayName(member)} ({member.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              Departments are displayed in ascending order
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="isActive">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive departments cannot be assigned to employees
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
              {department ? "Save Changes" : "Add Department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
