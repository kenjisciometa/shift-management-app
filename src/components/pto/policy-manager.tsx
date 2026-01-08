"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import {
  Palmtree,
  Plus,
  MoreHorizontal,
  Loader2,
  Calendar,
  Clock,
  Users,
  Shield,
} from "lucide-react";
import { PTOPolicyDialog } from "./policy-dialog";

type PTOPolicy = Database["public"]["Tables"]["pto_policies"]["Row"];

interface PTOPolicyManagerProps {
  policies: PTOPolicy[];
  organizationId: string;
}

const ptoTypeLabels: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick Leave",
  personal: "Personal",
  bereavement: "Bereavement",
  jury_duty: "Jury Duty",
  other: "Other",
};

const ptoTypeColors: Record<string, string> = {
  vacation: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  sick: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  personal: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  bereavement: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  jury_duty: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  other: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const accrualMethodLabels: Record<string, string> = {
  annual: "Annual",
  monthly: "Monthly",
  per_pay_period: "Per Pay Period",
  hourly: "Hourly",
};

export function PTOPolicyManager({
  policies,
  organizationId,
}: PTOPolicyManagerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<PTOPolicy | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<PTOPolicy | null>(null);

  const handleEdit = (policy: PTOPolicy) => {
    setSelectedPolicy(policy);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedPolicy(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!policyToDelete) return;

    setProcessingId(policyToDelete.id);
    try {
      const { error } = await supabase
        .from("pto_policies")
        .delete()
        .eq("id", policyToDelete.id);

      if (error) throw error;

      toast.success("Policy deleted");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete policy");
    } finally {
      setProcessingId(null);
      setDeleteDialogOpen(false);
      setPolicyToDelete(null);
    }
  };

  const handleToggleActive = async (policy: PTOPolicy) => {
    setProcessingId(policy.id);
    try {
      const { error } = await supabase
        .from("pto_policies")
        .update({ is_active: !policy.is_active })
        .eq("id", policy.id);

      if (error) throw error;

      toast.success(policy.is_active ? "Policy deactivated" : "Policy activated");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update policy");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">PTO Policies</h2>
          <p className="text-sm text-muted-foreground">
            Configure time off policies for your organization
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Policy
        </Button>
      </div>

      {policies.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {policies.map((policy) => (
            <Card key={policy.id} className="group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Palmtree className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{policy.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={ptoTypeColors[policy.pto_type]}>
                          {ptoTypeLabels[policy.pto_type]}
                        </Badge>
                        {!policy.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        disabled={processingId === policy.id}
                      >
                        {processingId === policy.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(policy)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(policy)}>
                        {policy.is_active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setPolicyToDelete(policy);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {policy.description && (
                  <CardDescription className="mt-2">
                    {policy.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-muted-foreground">Annual Allowance</div>
                      <div className="font-medium">
                        {Number(policy.annual_allowance || 0).toFixed(1)} days
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-muted-foreground">Accrual</div>
                      <div className="font-medium">
                        {accrualMethodLabels[policy.accrual_method || "annual"]}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-muted-foreground">Max Carryover</div>
                      <div className="font-medium">
                        {Number(policy.max_carryover || 0).toFixed(1)} days
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-muted-foreground">Approval</div>
                      <div className="font-medium">
                        {policy.requires_approval ? "Required" : "Not Required"}
                      </div>
                    </div>
                  </div>
                </div>

                {(Number(policy.waiting_period_days) > 0 ||
                  Number(policy.min_notice_days) > 0 ||
                  Number(policy.max_consecutive_days) > 0) && (
                  <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                    {Number(policy.waiting_period_days) > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {policy.waiting_period_days} day waiting period
                      </Badge>
                    )}
                    {Number(policy.min_notice_days) > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {policy.min_notice_days} day notice required
                      </Badge>
                    )}
                    {Number(policy.max_consecutive_days) > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Max {policy.max_consecutive_days} consecutive days
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Palmtree className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No PTO policies configured</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create policies to define time off rules for your team
            </p>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Policy
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Policy Dialog */}
      <PTOPolicyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        policy={selectedPolicy}
        organizationId={organizationId}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{policyToDelete?.name}"? This action
              cannot be undone. Existing PTO balances using this policy will remain
              but the policy will no longer be available for new configurations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
