"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, differenceInCalendarDays, addDays, isAfter, isBefore } from "date-fns";
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
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const [formData, setFormData] = useState({
    ptoType: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    reason: "",
  });

  // Calculate total days (calendar days, matching API calculation)
  const calculateDays = () => {
    try {
      const start = parseISO(formData.startDate);
      const end = parseISO(formData.endDate);
      if (isBefore(end, start)) return 0;
      // Count calendar days (inclusive of both start and end)
      const days = differenceInCalendarDays(end, start) + 1;
      return days > 0 ? days : 1;
    } catch {
      return 1;
    }
  };

  const totalDays = calculateDays();

  // Get selected policy
  const selectedPolicy = policies.find((p) => p.pto_type === formData.ptoType && p.is_active);

  // Validate minimum notice days
  const validateMinNotice = () => {
    if (!selectedPolicy?.min_notice_days) return true;
    const start = parseISO(formData.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilStart = differenceInCalendarDays(start, today);
    return daysUntilStart >= selectedPolicy.min_notice_days;
  };

  const minNoticeValid = validateMinNotice();
  const daysUntilStart = formData.startDate
    ? differenceInCalendarDays(parseISO(formData.startDate), new Date())
    : null;

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
      ...policies.filter((p) => p.is_active).map((p) => p.pto_type),
    ])
  );

  // Check for date conflicts
  const checkDateConflicts = async () => {
    if (!formData.startDate || !formData.endDate || !formData.ptoType) {
      return false;
    }

    setCheckingConflicts(true);
    try {
      // Fetch existing requests to check for conflicts
      const response = await fetch("/api/pto/requests");
      const data = await response.json();

      if (data.success && data.data) {
        const conflicts = data.data.filter(
          (req: any) =>
            req.user_id === profile.id &&
            req.status !== "rejected" &&
            req.status !== "cancelled" &&
            ((req.start_date <= formData.endDate && req.end_date >= formData.startDate) ||
              (formData.startDate <= req.end_date && formData.endDate >= req.start_date))
        );
        return conflicts.length > 0;
      }
      return false;
    } catch (error) {
      console.error("Error checking conflicts:", error);
      return false;
    } finally {
      setCheckingConflicts(false);
    }
  };

  // Validate form
  const validateForm = async () => {
    const errors: string[] = [];

    if (!formData.ptoType) {
      errors.push("Please select a PTO type");
    }

    if (!formData.startDate || !formData.endDate) {
      errors.push("Please select both start and end dates");
    }

    if (formData.startDate && formData.endDate) {
      const start = parseISO(formData.startDate);
      const end = parseISO(formData.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (isBefore(start, today)) {
        errors.push("Start date cannot be in the past");
      }

      if (isBefore(end, start)) {
        errors.push("End date must be after start date");
      }

      if (!minNoticeValid && selectedPolicy?.min_notice_days) {
        errors.push(
          `This PTO type requires at least ${selectedPolicy.min_notice_days} days notice. You have ${daysUntilStart} day(s).`
        );
      }
    }

    if (hasInsufficientBalance) {
      errors.push(
        `Insufficient balance. Available: ${availableBalance?.toFixed(1)} days, Requested: ${totalDays} days`
      );
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData({
        ptoType: "",
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: format(new Date(), "yyyy-MM-dd"),
        reason: "",
      });
      setValidationErrors([]);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const isValid = await validateForm();
    if (!isValid) {
      toast.error(validationErrors[0] || "Please fix the errors in the form");
      return;
    }

    // Check for conflicts
    const hasConflicts = await checkDateConflicts();
    if (hasConflicts) {
      toast.error("This date range conflicts with an existing PTO request");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/pto/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start_date: formData.startDate,
          end_date: formData.endDate,
          pto_type: formData.ptoType,
          reason: formData.reason || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      toast.success("Time off request submitted successfully");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
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
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {availableBalance.toFixed(1)} days available
                </p>
                {selectedPolicy && (
                  <p className="text-xs text-muted-foreground">
                    Policy: {selectedPolicy.name}
                    {selectedPolicy.min_notice_days && (
                      <> • Min. {selectedPolicy.min_notice_days} days notice</>
                    )}
                  </p>
                )}
              </div>
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
            <div>
              <span className="text-sm font-medium">Total Days</span>
              {daysUntilStart !== null && daysUntilStart >= 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {daysUntilStart === 0
                    ? "Starting today"
                    : `${daysUntilStart} day${daysUntilStart !== 1 ? "s" : ""} from now`}
                </p>
              )}
            </div>
            <span className="text-lg font-bold">{totalDays}</span>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="space-y-1 p-3 bg-destructive/10 text-destructive rounded-lg">
              {validationErrors.map((error, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          )}

          {/* Insufficient Balance Warning */}
          {hasInsufficientBalance && validationErrors.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Insufficient balance for this request</span>
            </div>
          )}

          {/* Minimum Notice Warning */}
          {!minNoticeValid && selectedPolicy?.min_notice_days && formData.startDate && (
            <div className="flex items-center gap-2 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                This PTO type requires at least {selectedPolicy.min_notice_days} days notice. You
                have {daysUntilStart} day{daysUntilStart !== 1 ? "s" : ""}.
              </span>
            </div>
          )}

          {/* Checking Conflicts Indicator */}
          {checkingConflicts && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Checking for date conflicts...</span>
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
              disabled={loading || checkingConflicts}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                checkingConflicts ||
                hasInsufficientBalance ||
                !minNoticeValid ||
                validationErrors.length > 0
              }
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
