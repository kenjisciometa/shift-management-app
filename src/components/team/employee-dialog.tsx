"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Shield, AlertTriangle, X, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Position = Database["public"]["Tables"]["positions"]["Row"];

type TeamMember = Database["public"]["Tables"]["profiles"]["Row"] & {
  departments: { id: string; name: string } | null;
  user_positions?: { position_id: string; positions: Position | null }[];
};

type Department = {
  id: string;
  name: string;
};

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: TeamMember | null;
  currentUser: Profile;
  departments: Department[];
  positions: Position[];
}

const roles = [
  { value: "employee", label: "Employee", description: "Basic access to clock in/out and view schedules" },
  { value: "manager", label: "Manager", description: "Can manage team schedules and approve requests" },
  { value: "admin", label: "Admin", description: "Full access to organization settings" },
  { value: "owner", label: "Owner", description: "Complete control over the organization" },
];

const statuses = [
  { value: "active", label: "Active", color: "bg-green-100 text-green-800" },
  { value: "inactive", label: "Inactive", color: "bg-gray-100 text-gray-800" },
  { value: "suspended", label: "Suspended", color: "bg-red-100 text-red-800" },
];

export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  currentUser,
  departments,
  positions,
}: EmployeeDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    displayName: "",
    phone: "",
    role: "employee",
    departmentId: "",
    status: "active",
    positionIds: [] as string[],
  });

  useEffect(() => {
    if (open && employee) {
      const currentPositionIds = employee.user_positions?.map(up => up.position_id) || [];
      setFormData({
        firstName: employee.first_name,
        lastName: employee.last_name,
        displayName: employee.display_name || "",
        phone: employee.phone || "",
        role: employee.role || "employee",
        departmentId: employee.department_id || "",
        status: employee.status || "active",
        positionIds: currentPositionIds,
      });
    }
  }, [open, employee?.id]);

  const togglePosition = (positionId: string) => {
    setFormData((prev) => ({
      ...prev,
      positionIds: prev.positionIds.includes(positionId)
        ? prev.positionIds.filter((id) => id !== positionId)
        : [...prev.positionIds, positionId],
    }));
  };

  const canChangeRole = (targetRole: string) => {
    // Owner can change any role
    if (currentUser.role === "owner") return true;
    // Admin can assign employee, manager, admin but not owner
    if (currentUser.role === "admin") return targetRole !== "owner";
    return false;
  };

  const canEditEmployee = () => {
    if (!employee) return false;
    // Can't edit yourself through this dialog
    if (employee.id === currentUser.id) return false;
    // Owner can edit anyone
    if (currentUser.role === "owner") return true;
    // Admin can edit non-owners
    if (currentUser.role === "admin") return employee.role !== "owner";
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !canEditEmployee()) return;

    setLoading(true);
    try {
      const updateData: Record<string, unknown> = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        display_name: formData.displayName.trim() || null,
        phone: formData.phone.trim() || null,
        department_id: formData.departmentId || null,
      };

      // Only update role if allowed
      if (canChangeRole(formData.role)) {
        updateData.role = formData.role;
      }

      // Only update status if allowed
      if (currentUser.role === "owner" || currentUser.role === "admin") {
        updateData.status = formData.status;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", employee.id);

      if (error) throw error;

      // Update user positions
      // First, delete all existing positions for this user
      const { error: deleteError } = await supabase
        .from("user_positions")
        .delete()
        .eq("user_id", employee.id);

      if (deleteError) throw deleteError;

      // Then, insert new positions
      if (formData.positionIds.length > 0) {
        const { error: insertError } = await supabase
          .from("user_positions")
          .insert(
            formData.positionIds.map((positionId) => ({
              user_id: employee.id,
              position_id: positionId,
            }))
          );

        if (insertError) throw insertError;
      }

      toast.success("Employee updated successfully");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update employee");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!employee) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "inactive" })
        .eq("id", employee.id);

      if (error) throw error;

      toast.success("Employee deactivated");
      setConfirmDeactivate(false);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to deactivate employee");
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!employee) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "active" })
        .eq("id", employee.id);

      if (error) throw error;

      toast.success("Employee reactivated");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to reactivate employee");
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  const getInitials = () => {
    return `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information and permissions
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2">
          {/* Employee Info Header */}
          <div className="flex items-center gap-4 py-2">
            <Avatar className="h-16 w-16">
              <AvatarImage src={employee.avatar_url || undefined} />
              <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">
                {employee.display_name || `${employee.first_name} ${employee.last_name}`}
              </h3>
              <p className="text-sm text-muted-foreground">{employee.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{employee.role}</Badge>
                <Badge
                  className={
                    employee.status === "active"
                      ? "bg-green-100 text-green-800"
                      : employee.status === "suspended"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }
                >
                  {employee.status}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          <form id="employee-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name (optional)</Label>
              <Input
                id="displayName"
                placeholder="Preferred name"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, displayName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 234 567 8900"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.departmentId || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, departmentId: value === "none" ? "" : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Positions Selection */}
            {positions.length > 0 && (
              <div className="space-y-2">
                <Label>Positions</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.positionIds.length > 0 ? (
                    formData.positionIds.map((posId) => {
                      const pos = positions.find((p) => p.id === posId);
                      if (!pos) return null;
                      return (
                        <Badge
                          key={pos.id}
                          variant="secondary"
                          className={cn(
                            "cursor-pointer transition-colors",
                            `bg-${pos.color}-100 text-${pos.color}-800 hover:bg-${pos.color}-200`
                          )}
                          onClick={() => togglePosition(pos.id)}
                        >
                          {pos.name}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-sm text-muted-foreground">No positions assigned</span>
                  )}
                </div>
                <div className="border rounded-md p-2 space-y-1 max-h-32 overflow-y-auto">
                  {positions.filter((p) => p.is_active).map((position) => (
                    <label
                      key={position.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors",
                        formData.positionIds.includes(position.id) && "bg-muted"
                      )}
                    >
                      <Checkbox
                        checked={formData.positionIds.includes(position.id)}
                        onCheckedChange={() => togglePosition(position.id)}
                      />
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          `bg-${position.color}-500`
                        )}
                      />
                      <span className="text-sm">{position.name}</span>
                    </label>
                  ))}
                  {positions.filter((p) => p.is_active).length === 0 && (
                    <p className="text-sm text-muted-foreground p-2">
                      No active positions available
                    </p>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Role Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Label>Role & Permissions</Label>
              </div>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, role: value }))
                }
                disabled={!canChangeRole(formData.role)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem
                      key={role.value}
                      value={role.value}
                      disabled={!canChangeRole(role.value)}
                    >
                      <div>
                        <div className="font-medium">{role.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {role.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canChangeRole(formData.role) && (
                <p className="text-xs text-muted-foreground">
                  You don&apos;t have permission to change this user&apos;s role
                </p>
              )}
            </div>

            {/* Status Selection */}
            <div className="space-y-2">
              <Label>Account Status</Label>
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
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            status.value === "active"
                              ? "bg-green-500"
                              : status.value === "suspended"
                              ? "bg-red-500"
                              : "bg-gray-500"
                          }`}
                        />
                        {status.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between flex-shrink-0 pt-4 border-t">
            <div>
              {employee.status === "active" ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmDeactivate(true)}
                  disabled={loading}
                >
                  Deactivate Account
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReactivate}
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Reactivate Account
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" form="employee-form" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivation Confirmation */}
      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Deactivate Employee Account
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Are you sure you want to deactivate{" "}
                  <strong>
                    {employee.display_name || `${employee.first_name} ${employee.last_name}`}
                  </strong>
                  &apos;s account?
                </p>
                <p className="mt-2">This will:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Prevent them from logging in</li>
                  <li>Remove them from future shift schedules</li>
                  <li>Cancel any pending PTO requests</li>
                </ul>
                <p className="mt-2">You can reactivate the account later if needed.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deactivate Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
