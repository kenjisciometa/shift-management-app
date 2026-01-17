"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiGet, apiPut, ApiError } from "@/lib/api-client";
import { ShiftSwapTable } from "./shift-swap-table";
import { SwapRequestDialog } from "./request-dialog";
import type { Database } from "@/types/database.types";
import type {
  ShiftSwapTableRow,
  ShiftSwapSort,
  ShiftSwapPagination,
  ShiftSwapStatus,
  EmployeeOption,
  ShiftInfo,
  PersonInfo,
} from "@/types/shift-swap-table";
import type { TeamSettings } from "@/components/settings/team-settings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Settings } from "lucide-react";
import Link from "next/link";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type RawShiftInfo = {
  id: string;
  start_time: string;
  end_time: string;
  locations: { id: string; name: string } | null;
  positions: { id: string; name: string; color: string } | null;
};

type RawPersonInfo = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
};

interface SwapRequest {
  id: string;
  requester_id: string;
  target_id: string | null;
  status: string | null;
  reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
  created_at: string | null;
  requester_shift: RawShiftInfo | null;
  target_shift: RawShiftInfo | null;
  requester?: RawPersonInfo | null;
  target?: RawPersonInfo | null;
}

interface ShiftSwapsContainerProps {
  profile: Profile;
  initialSwaps: SwapRequest[];
  myShifts: RawShiftInfo[];
  teamMembers: RawPersonInfo[];
  employees: EmployeeOption[];
  isAdmin: boolean;
  settings: TeamSettings;
}

export function ShiftSwapsContainer({
  profile,
  initialSwaps,
  myShifts,
  teamMembers,
  employees,
  isAdmin,
  settings,
}: ShiftSwapsContainerProps) {
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ShiftSwapTableRow[]>([]);
  const [swaps, setSwaps] = useState(initialSwaps);
  const [sort, setSort] = useState<ShiftSwapSort>({ field: "created_at", order: "desc" });
  const [pagination, setPagination] = useState<ShiftSwapPagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<ShiftSwapStatus | "all">("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");

  // Dialogs
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  /**
   * Convert raw shift info to display format
   */
  const convertShiftInfo = (raw: RawShiftInfo | null): ShiftInfo | null => {
    if (!raw) return null;
    return {
      id: raw.id,
      startTime: raw.start_time,
      endTime: raw.end_time,
      locationName: raw.locations?.name || null,
      positionName: raw.positions?.name || null,
      positionColor: raw.positions?.color || null,
    };
  };

  /**
   * Convert raw person info to display format
   */
  const convertPersonInfo = (raw: RawPersonInfo | null | undefined): PersonInfo => {
    if (!raw) {
      return {
        id: "",
        displayName: "Unknown",
        legalName: "Unknown",
        avatarUrl: null,
      };
    }
    const legalName = `${raw.first_name || ""} ${raw.last_name || ""}`.trim() || "Unknown";
    return {
      id: raw.id,
      displayName: raw.display_name || legalName,
      legalName,
      avatarUrl: raw.avatar_url,
    };
  };

  /**
   * Process swaps into table rows
   */
  const processSwaps = useCallback((swaps: SwapRequest[]): ShiftSwapTableRow[] => {
    return swaps.map((swap) => ({
      id: swap.id,
      requester: convertPersonInfo(swap.requester),
      target: convertPersonInfo(swap.target),
      requesterShift: convertShiftInfo(swap.requester_shift),
      targetShift: convertShiftInfo(swap.target_shift),
      status: (swap.status || "pending") as ShiftSwapStatus,
      reason: swap.reason,
      reviewedBy: swap.reviewed_by,
      reviewedAt: swap.reviewed_at,
      appliedAt: swap.applied_at,
      createdAt: swap.created_at || new Date().toISOString(),
    }));
  }, []);

  /**
   * Sort data
   */
  const sortData = useCallback((data: ShiftSwapTableRow[], sort: ShiftSwapSort): ShiftSwapTableRow[] => {
    const sorted = [...data];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case "requester_name":
          comparison = a.requester.displayName.localeCompare(b.requester.displayName);
          break;
        case "target_name":
          comparison = a.target.displayName.localeCompare(b.target.displayName);
          break;
        case "requester_shift_date":
          const aReqDate = a.requesterShift?.startTime || "";
          const bReqDate = b.requesterShift?.startTime || "";
          comparison = aReqDate.localeCompare(bReqDate);
          break;
        case "target_shift_date":
          const aTgtDate = a.targetShift?.startTime || "";
          const bTgtDate = b.targetShift?.startTime || "";
          comparison = aTgtDate.localeCompare(bTgtDate);
          break;
        case "status":
          const statusOrder: Record<string, number> = { pending: 0, target_accepted: 1, approved: 2, rejected: 3, cancelled: 4 };
          comparison = (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
          break;
        case "created_at":
          comparison = a.createdAt.localeCompare(b.createdAt);
          break;
        default:
          comparison = 0;
      }

      return sort.order === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, []);

  /**
   * Filter data
   */
  const filterData = useCallback((data: ShiftSwapTableRow[]): ShiftSwapTableRow[] => {
    return data.filter((row) => {
      // Status filter
      if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }

      // Employee filter (admin only)
      if (isAdmin && employeeFilter !== "all") {
        if (row.requester.id !== employeeFilter && row.target.id !== employeeFilter) {
          return false;
        }
      }

      // Date range filter (based on shift dates)
      const shiftDate = row.requesterShift?.startTime || row.targetShift?.startTime;
      if (shiftDate) {
        const dateOnly = shiftDate.split("T")[0];
        if (dateRangeStart && dateOnly < dateRangeStart) {
          return false;
        }
        if (dateRangeEnd && dateOnly > dateRangeEnd) {
          return false;
        }
      }

      return true;
    });
  }, [statusFilter, employeeFilter, dateRangeStart, dateRangeEnd, isAdmin]);

  /**
   * Fetch data from API
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet<SwapRequest[]>("/api/shift-swaps", {
        limit: 100,
      });

      if (response.success && response.data) {
        // Transform API response to match expected format
        const transformedData = (Array.isArray(response.data) ? response.data : []).map((swap: any) => ({
          ...swap,
          requester_shift: swap.requester_shift ? {
            ...swap.requester_shift,
            locations: swap.requester_shift.location,
            positions: swap.requester_shift.position,
          } : null,
          target_shift: swap.target_shift ? {
            ...swap.target_shift,
            locations: swap.target_shift.location,
            positions: swap.target_shift.position,
          } : null,
        }));
        setSwaps(transformedData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load shift swaps");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update table data when swaps or filters change
   */
  useEffect(() => {
    const rows = processSwaps(swaps);
    const filtered = filterData(rows);
    const sorted = sortData(filtered, sort);

    // Update pagination
    const total = sorted.length;
    const totalPages = Math.ceil(total / pagination.limit);
    setPagination((prev) => ({ ...prev, total, totalPages }));

    // Paginate data
    const start = (pagination.page - 1) * pagination.limit;
    const paginatedRows = sorted.slice(start, start + pagination.limit);

    setData(paginatedRows);
  }, [swaps, sort, pagination.page, pagination.limit, processSwaps, filterData, sortData]);

  /**
   * Handle sort change
   */
  const handleSortChange = (newSort: ShiftSwapSort) => {
    setSort(newSort);
  };

  /**
   * Handle page change
   */
  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  /**
   * Handle approve
   */
  const handleApprove = async (swapId: string) => {
    setProcessingId(swapId);
    try {
      // Approve the swap via API
      const response = await apiPut(`/api/shift-swaps/${swapId}/approve`);

      if (!response.success) {
        throw new Error("Failed to approve swap request");
      }

      // If auto-update is enabled, apply to schedule
      if (settings.shiftSwapSettings.autoUpdateSchedule) {
        const applyResponse = await apiPut(`/api/shift-swaps/${swapId}/apply`);
        if (applyResponse.success) {
          toast.success("Swap request approved and schedule updated");
        } else {
          toast.success("Swap request approved");
        }
      } else {
        toast.success("Swap request approved. Click 'Apply' to update the schedule.");
      }

      fetchData();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to approve swap request");
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Handle reject
   */
  const handleReject = async (swapId: string) => {
    setProcessingId(swapId);
    try {
      const response = await apiPut(`/api/shift-swaps/${swapId}/reject`);

      if (!response.success) {
        throw new Error("Failed to reject swap request");
      }

      toast.success("Swap request rejected");
      fetchData();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to reject swap request");
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Handle apply to schedule (for approved swaps when auto-update is disabled)
   */
  const handleApplyToSchedule = async (swapId: string) => {
    setProcessingId(swapId);
    try {
      const response = await apiPut(`/api/shift-swaps/${swapId}/apply`);

      if (!response.success) {
        throw new Error("Failed to apply swap to schedule");
      }

      toast.success("Schedule updated successfully");
      fetchData();
      router.refresh();
    } catch (error) {
      console.error(error);
      const message = error instanceof ApiError ? error.message : "Failed to apply to schedule";
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = async (swapId: string) => {
    setProcessingId(swapId);
    try {
      const response = await apiPut(`/api/shift-swaps/${swapId}/cancel`);

      if (!response.success) {
        throw new Error("Failed to cancel swap request");
      }

      toast.success("Swap request cancelled");
      fetchData();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to cancel swap request");
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Handle bulk status change
   */
  const handleBulkStatusChange = async (swapIds: string[], status: ShiftSwapStatus) => {
    try {
      for (const swapId of swapIds) {
        if (status === "approved") {
          await handleApprove(swapId);
        } else if (status === "rejected") {
          await handleReject(swapId);
        }
      }

      toast.success(`${swapIds.length} requests ${status}`);
      fetchData();
      router.refresh();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
      throw error;
    }
  };

  /**
   * Handle target accept (when the target user accepts the swap request)
   */
  const handleTargetAccept = async (swapId: string) => {
    setProcessingId(swapId);
    try {
      const requireAdminApproval = settings.shiftSwapSettings?.requireAdminApproval ?? true;

      if (requireAdminApproval) {
        // Mark as accepted by target, waiting for admin approval
        const response = await apiPut(`/api/shift-swaps/${swapId}/accept`);

        if (!response.success) {
          throw new Error("Failed to accept swap request");
        }

        toast.success("Swap request accepted. Waiting for admin approval.");
      } else {
        // Auto-approve since admin approval is not required
        await handleApprove(swapId);
        return; // handleApprove will handle the rest
      }

      fetchData();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to accept swap request");
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Handle target reject (when the target user declines the swap request)
   */
  const handleTargetReject = async (swapId: string) => {
    setProcessingId(swapId);
    try {
      const response = await apiPut(`/api/shift-swaps/${swapId}/reject`);

      if (!response.success) {
        throw new Error("Failed to decline swap request");
      }

      toast.success("Swap request declined");
      fetchData();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to decline swap request");
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Clear filters
   */
  const clearFilters = () => {
    setStatusFilter("all");
    setEmployeeFilter("all");
    setDateRangeStart("");
    setDateRangeEnd("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = statusFilter !== "all" || employeeFilter !== "all" || dateRangeStart || dateRangeEnd;
  const swapsEnabled = settings.shiftSwapSettings?.enabled ?? true;

  // If swaps are disabled, show a message
  if (!swapsEnabled) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Shift Swaps Disabled</AlertTitle>
          <AlertDescription>
            Shift swaps are currently disabled for this organization.
            {isAdmin && (
              <>
                {" "}
                <Link href="/settings" className="underline hover:no-underline inline-flex items-center gap-1">
                  <Settings className="h-3 w-3" />
                  Go to Settings
                </Link>{" "}
                to enable them.
              </>
            )}
          </AlertDescription>
        </Alert>

        {/* Still show existing swaps for reference */}
        {data.length > 0 && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Previous Swap Requests</CardTitle>
              </CardHeader>
            </Card>
            <ShiftSwapTable
              data={data}
              isAdmin={isAdmin}
              currentUserId={profile.id}
              sort={sort}
              onSortChange={handleSortChange}
              pagination={pagination}
              onPageChange={handlePageChange}
              onApplyToSchedule={handleApplyToSchedule}
              loading={loading}
              processingId={processingId}
              autoUpdateSchedule={settings.shiftSwapSettings.autoUpdateSchedule}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Filters</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button onClick={() => setRequestDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Request Shift Swap
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as ShiftSwapStatus | "all");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="target_accepted">Awaiting Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Employee Filter (Admin only) */}
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="employee-filter">Employee</Label>
                <Select
                  value={employeeFilter}
                  onValueChange={(value) => {
                    setEmployeeFilter(value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                >
                  <SelectTrigger id="employee-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Range */}
            <div className="space-y-2">
              <Label htmlFor="date-start">Shift Date From</Label>
              <Input
                id="date-start"
                type="date"
                value={dateRangeStart}
                onChange={(e) => {
                  setDateRangeStart(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-end">Shift Date To</Label>
              <Input
                id="date-end"
                type="date"
                value={dateRangeEnd}
                onChange={(e) => {
                  setDateRangeEnd(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                min={dateRangeStart}
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <ShiftSwapTable
        data={data}
        isAdmin={isAdmin}
        currentUserId={profile.id}
        sort={sort}
        onSortChange={handleSortChange}
        pagination={pagination}
        onPageChange={handlePageChange}
        onApprove={handleApprove}
        onReject={handleReject}
        onCancel={handleCancel}
        onTargetAccept={handleTargetAccept}
        onTargetReject={handleTargetReject}
        onApplyToSchedule={handleApplyToSchedule}
        onBulkStatusChange={isAdmin ? handleBulkStatusChange : undefined}
        loading={loading}
        processingId={processingId}
        autoUpdateSchedule={settings.shiftSwapSettings.autoUpdateSchedule}
      />

      {/* Request Dialog */}
      <SwapRequestDialog
        open={requestDialogOpen}
        onOpenChange={(open) => {
          setRequestDialogOpen(open);
          if (!open) {
            fetchData();
          }
        }}
        profile={profile}
        myShifts={myShifts}
        teamMembers={teamMembers}
        settings={settings}
      />
    </div>
  );
}
