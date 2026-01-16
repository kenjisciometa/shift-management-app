"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Sparkles,
} from "lucide-react";
import { PTOPolicyDialog } from "./policy-dialog";
import { PTOBalanceInitializeDialog } from "./balance-initialize-dialog";

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
  const [initializeDialogOpen, setInitializeDialogOpen] = useState(false);

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
        <div className="flex items-center gap-2">
          {policies.filter((p) => p.is_active).length > 0 && (
            <Button variant="outline" onClick={() => setInitializeDialogOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Initialize Balances
            </Button>
          )}
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Policy
          </Button>
        </div>
      </div>

      {policies.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Annual Allowance</TableHead>
                <TableHead>Accrual Rate</TableHead>
                <TableHead>Max Carryover</TableHead>
                <TableHead>Notice Required</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell className="font-medium">{policy.name}</TableCell>
                  <TableCell>
                    <Badge className={ptoTypeColors[policy.pto_type]}>
                      {ptoTypeLabels[policy.pto_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {Number(policy.annual_allowance || 0).toFixed(1)} days
                  </TableCell>
                  <TableCell>
                    {Number(policy.accrual_rate || 0).toFixed(2)} days/mo
                  </TableCell>
                  <TableCell>
                    {Number(policy.max_carryover || 0).toFixed(1)} days
                  </TableCell>
                  <TableCell>
                    {Number(policy.min_notice_days) > 0
                      ? `${policy.min_notice_days} days`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {policy.requires_approval ? (
                      <Badge variant="outline">Required</Badge>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {policy.is_active ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      {/* Balance Initialize Dialog */}
      <PTOBalanceInitializeDialog
        open={initializeDialogOpen}
        onOpenChange={setInitializeDialogOpen}
        organizationId={organizationId}
        policies={policies}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
