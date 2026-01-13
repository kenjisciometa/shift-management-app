"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

type PTOPolicy = Database["public"]["Tables"]["pto_policies"]["Row"];

interface PTOPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy: PTOPolicy | null;
  organizationId: string;
}

const ptoTypes = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick Leave" },
  { value: "personal", label: "Personal" },
  { value: "bereavement", label: "Bereavement" },
  { value: "jury_duty", label: "Jury Duty" },
  { value: "other", label: "Other" },
];

export function PTOPolicyDialog({
  open,
  onOpenChange,
  policy,
  organizationId,
}: PTOPolicyDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    ptoType: "vacation",
    annualAllowance: "0",
    maxCarryover: "0",
    accrualRate: "0",
    requiresApproval: true,
    minNoticeDays: "0",
    isActive: true,
  });

  useEffect(() => {
    if (policy) {
      setFormData({
        name: policy.name,
        ptoType: policy.pto_type,
        annualAllowance: String(policy.annual_allowance || 0),
        maxCarryover: String(policy.max_carryover || 0),
        accrualRate: String(policy.accrual_rate || 0),
        requiresApproval: policy.requires_approval ?? true,
        minNoticeDays: String(policy.min_notice_days || 0),
        isActive: policy.is_active ?? true,
      });
    } else {
      setFormData({
        name: "",
        ptoType: "vacation",
        annualAllowance: "0",
        maxCarryover: "0",
        accrualRate: "0",
        requiresApproval: true,
        minNoticeDays: "0",
        isActive: true,
      });
    }
  }, [policy, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Policy name is required");
      return;
    }

    setLoading(true);

    try {
      const data = {
        organization_id: organizationId,
        name: formData.name.trim(),
        pto_type: formData.ptoType,
        annual_allowance: parseFloat(formData.annualAllowance) || 0,
        max_carryover: parseFloat(formData.maxCarryover) || 0,
        accrual_rate: parseFloat(formData.accrualRate) || 0,
        requires_approval: formData.requiresApproval,
        min_notice_days: parseInt(formData.minNoticeDays) || 0,
        is_active: formData.isActive,
      };

      if (policy) {
        const { error } = await supabase
          .from("pto_policies")
          .update(data)
          .eq("id", policy.id);

        if (error) throw error;
        toast.success("Policy updated");
      } else {
        const response = await fetch("/api/pto/policies", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create policy");
        }

        toast.success("Policy created");
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(policy ? "Failed to update policy" : "Failed to create policy");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {policy ? "Edit PTO Policy" : "Create PTO Policy"}
          </DialogTitle>
          <DialogDescription>
            {policy
              ? "Update the PTO policy settings."
              : "Create a new PTO policy for your organization."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Policy Name</Label>
            <Input
              id="name"
              placeholder="Annual Vacation"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ptoType">PTO Type</Label>
            <Select
              value={formData.ptoType}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, ptoType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ptoTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="annualAllowance">Annual Allowance (days)</Label>
              <Input
                id="annualAllowance"
                type="number"
                step="0.5"
                min="0"
                value={formData.annualAllowance}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, annualAllowance: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxCarryover">Max Carryover (days)</Label>
              <Input
                id="maxCarryover"
                type="number"
                step="0.5"
                min="0"
                value={formData.maxCarryover}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, maxCarryover: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accrualRate">Accrual Rate (days/month)</Label>
              <Input
                id="accrualRate"
                type="number"
                step="0.01"
                min="0"
                value={formData.accrualRate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, accrualRate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minNotice">Min Notice (days)</Label>
              <Input
                id="minNotice"
                type="number"
                min="0"
                value={formData.minNoticeDays}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, minNoticeDays: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Advance notice required
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="requiresApproval">Requires Approval</Label>
                <p className="text-xs text-muted-foreground">
                  Manager must approve requests
                </p>
              </div>
              <Switch
                id="requiresApproval"
                checked={formData.requiresApproval}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, requiresApproval: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isActive">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive policies cannot be used
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
              {policy ? "Save Changes" : "Create Policy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
