"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, differenceInBusinessDays, addDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
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
import { Loader2, AlertCircle } from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type PTOBalance = Database["public"]["Tables"]["pto_balances"]["Row"] & {
  pto_policies: {
    id: string;
    name: string;
    pto_type: string;
    annual_allowance: number | null;
  } | null;
};
type PTOPolicy = Database["public"]["Tables"]["pto_policies"]["Row"];

interface PTORequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  balances: PTOBalance[];
  policies: PTOPolicy[];
}

const ptoTypeLabels: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick Leave",
  personal: "Personal",
  bereavement: "Bereavement",
  jury_duty: "Jury Duty",
  other: "Other",
};

export function PTORequestDialog({
  open,
  onOpenChange,
  profile,
  balances,
  policies,
}: PTORequestDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    ptoType: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    reason: "",
  });

  // Calculate total days
  const calculateDays = () => {
    try {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end < start) return 0;
      // Count business days + 1 (inclusive)
      const days = differenceInBusinessDays(addDays(end, 1), start);
      return days > 0 ? days : 1;
    } catch {
      return 1;
    }
  };

  const totalDays = calculateDays();

  // Get available balance for selected PTO type
  const getAvailableBalance = () => {
    if (!formData.ptoType) return null;
    const balance = balances.find((b) => b.pto_type === formData.ptoType);
    if (!balance) return null;
    const total = Number(balance.entitled_days) + Number(balance.carryover_days) + Number(balance.adjustment_days);
    const used = Number(balance.used_days) + Number(balance.pending_days);
    return total - used;
  };

  const availableBalance = getAvailableBalance();
  const hasInsufficientBalance = availableBalance !== null && totalDays > availableBalance;

  // Get unique PTO types from balances and policies
  const ptoTypes = Array.from(
    new Set([
      ...balances.map((b) => b.pto_type),
      ...policies.map((p) => p.pto_type),
    ])
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ptoType) {
      toast.error("Please select a PTO type");
      return;
    }

    if (hasInsufficientBalance) {
      toast.error("Insufficient PTO balance");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("pto_requests").insert({
        organization_id: profile.organization_id,
        user_id: profile.id,
        pto_type: formData.ptoType,
        start_date: formData.startDate,
        end_date: formData.endDate,
        total_days: totalDays,
        reason: formData.reason || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Time off request submitted");
      onOpenChange(false);
      router.refresh();

      // Reset form
      setFormData({
        ptoType: "",
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: format(new Date(), "yyyy-MM-dd"),
        reason: "",
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Time Off</DialogTitle>
          <DialogDescription>
            Submit a request for time off. Your manager will be notified.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* PTO Type */}
          <div className="space-y-2">
            <Label htmlFor="ptoType">Type</Label>
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
                  <SelectItem key={type} value={type}>
                    {ptoTypeLabels[type] || type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableBalance !== null && (
              <p className="text-xs text-muted-foreground">
                {availableBalance.toFixed(1)} days available
              </p>
            )}
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  startDate: e.target.value,
                  endDate:
                    e.target.value > prev.endDate ? e.target.value : prev.endDate,
                }))
              }
              min={format(new Date(), "yyyy-MM-dd")}
              required
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, endDate: e.target.value }))
              }
              min={formData.startDate}
              required
            />
          </div>

          {/* Total Days */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Total Days</span>
            <span className="text-lg font-bold">{totalDays}</span>
          </div>

          {/* Insufficient Balance Warning */}
          {hasInsufficientBalance && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Insufficient balance for this request</span>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Add a reason for your request..."
              value={formData.reason}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, reason: e.target.value }))
              }
              rows={3}
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
            <Button type="submit" disabled={loading || hasInsufficientBalance}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
