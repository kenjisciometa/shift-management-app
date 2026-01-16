"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Download, Plus, RefreshCw } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PTOTable } from "./pto-table";
import { PTORequestDialog } from "./request-dialog";
import type { Database } from "@/types/database.types";
import type {
  PTOTableRow,
  PTOSort,
  PTOPagination,
  PTOStatus,
  PTOType,
  EmployeeOption,
} from "@/types/pto-table";

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

interface PTORequest {
  id: string;
  user_id: string;
  pto_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string | null;
  review_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    employee_code: string | null;
  } | null;
}

interface PTOContainerProps {
  profile: Profile;
  initialRequests: PTORequest[];
  initialBalances: PTOBalance[];
  policies: PTOPolicy[];
  employees: EmployeeOption[];
  isAdmin: boolean;
}

export function PTOContainer({
  profile,
  initialRequests,
  initialBalances,
  policies,
  employees,
  isAdmin,
}: PTOContainerProps) {
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PTOTableRow[]>([]);
  const [requests, setRequests] = useState(initialRequests);
  const [balances, setBalances] = useState(initialBalances);
  const [sort, setSort] = useState<PTOSort>({ field: "start_date", order: "desc" });
  const [pagination, setPagination] = useState<PTOPagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<PTOStatus | "all">("all");
  const [ptoTypeFilter, setPtoTypeFilter] = useState<PTOType | "all">("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");

  // Dialogs
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [reviewRequestId, setReviewRequestId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  /**
   * Process requests into table rows
   */
  const processRequests = useCallback((requests: PTORequest[]): PTOTableRow[] => {
    return requests.map((request) => {
      const profile = request.profiles;
      const legalName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Unknown";
      const displayName = profile?.display_name || legalName;

      return {
        id: request.id,
        userId: request.user_id,
        personalId: profile?.employee_code || null,
        displayName,
        legalName,
        avatarUrl: profile?.avatar_url || null,
        ptoType: request.pto_type as PTOType,
        startDate: request.start_date,
        endDate: request.end_date,
        totalDays: Number(request.total_days),
        reason: request.reason,
        status: (request.status || "pending") as PTOStatus,
        reviewComment: request.review_comment,
        reviewedBy: request.reviewed_by,
        reviewedAt: request.reviewed_at,
        createdAt: request.created_at || new Date().toISOString(),
      };
    });
  }, []);

  /**
   * Sort data
   */
  const sortData = useCallback((data: PTOTableRow[], sort: PTOSort): PTOTableRow[] => {
    const sorted = [...data];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case "display_name":
          comparison = a.displayName.localeCompare(b.displayName);
          break;
        case "legal_name":
          comparison = a.legalName.localeCompare(b.legalName);
          break;
        case "personal_id":
          comparison = (a.personalId || "").localeCompare(b.personalId || "");
          break;
        case "pto_type":
          comparison = a.ptoType.localeCompare(b.ptoType);
          break;
        case "start_date":
          comparison = a.startDate.localeCompare(b.startDate);
          break;
        case "end_date":
          comparison = a.endDate.localeCompare(b.endDate);
          break;
        case "total_days":
          comparison = a.totalDays - b.totalDays;
          break;
        case "status":
          const statusOrder = { pending: 0, approved: 1, rejected: 2, cancelled: 3 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
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
  const filterData = useCallback((data: PTOTableRow[]): PTOTableRow[] => {
    return data.filter((row) => {
      // Status filter
      if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }

      // PTO type filter
      if (ptoTypeFilter !== "all" && row.ptoType !== ptoTypeFilter) {
        return false;
      }

      // Employee filter (admin only)
      if (isAdmin && employeeFilter !== "all" && row.userId !== employeeFilter) {
        return false;
      }

      // Date range filter
      if (dateRangeStart && row.endDate < dateRangeStart) {
        return false;
      }
      if (dateRangeEnd && row.startDate > dateRangeEnd) {
        return false;
      }

      return true;
    });
  }, [statusFilter, ptoTypeFilter, employeeFilter, dateRangeStart, dateRangeEnd, isAdmin]);

  /**
   * Fetch data from API
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (isAdmin) {
        params.set("all", "true");
      }

      const response = await fetch(`/api/pto/requests?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setRequests(result.data || []);
      } else {
        toast.error("Failed to load PTO requests");
      }

      // Fetch balances
      const balanceResponse = await fetch("/api/pto/balance");
      const balanceResult = await balanceResponse.json();
      if (balanceResult.success) {
        setBalances(balanceResult.data || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load PTO data");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  /**
   * Update table data when requests or filters change
   */
  useEffect(() => {
    const rows = processRequests(requests);
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
  }, [requests, sort, pagination.page, pagination.limit, processRequests, filterData, sortData]);

  /**
   * Handle sort change
   */
  const handleSortChange = (newSort: PTOSort) => {
    setSort(newSort);
  };

  /**
   * Handle page change
   */
  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  /**
   * Open review dialog
   */
  const openReviewDialog = (requestId: string, action: "approve" | "reject") => {
    setReviewRequestId(requestId);
    setReviewAction(action);
    setReviewComment("");
    setReviewDialogOpen(true);
  };

  /**
   * Handle review submit
   */
  const handleReviewSubmit = async () => {
    if (!reviewRequestId || !reviewAction) return;

    setProcessingId(reviewRequestId);
    setReviewDialogOpen(false);

    try {
      const response = await fetch(`/api/pto/requests/${reviewRequestId}/${reviewAction}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ review_comment: reviewComment || null }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${reviewAction} request`);
      }

      toast.success(`Request ${reviewAction}d`);
      setReviewRequestId(null);
      setReviewAction(null);
      setReviewComment("");
      fetchData();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : `Failed to ${reviewAction} request`);
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Handle bulk status change
   */
  const handleBulkStatusChange = async (requestIds: string[], status: PTOStatus) => {
    try {
      const action = status === "approved" ? "approve" : "reject";

      // Process each request
      for (const requestId of requestIds) {
        const response = await fetch(`/api/pto/requests/${requestId}/${action}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ review_comment: null }),
        });

        if (!response.ok) {
          throw new Error(`Failed to ${action} request`);
        }
      }

      toast.success(`${requestIds.length} requests ${action}d`);
      fetchData();
      router.refresh();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
      throw error;
    }
  };

  /**
   * Clear filters
   */
  const clearFilters = () => {
    setStatusFilter("all");
    setPtoTypeFilter("all");
    setEmployeeFilter("all");
    setDateRangeStart("");
    setDateRangeEnd("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = statusFilter !== "all" || ptoTypeFilter !== "all" ||
    employeeFilter !== "all" || dateRangeStart || dateRangeEnd;

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
                Request Time Off
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as PTOStatus | "all");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* PTO Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="type-filter">Type</Label>
              <Select
                value={ptoTypeFilter}
                onValueChange={(value) => {
                  setPtoTypeFilter(value as PTOType | "all");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <SelectTrigger id="type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="bereavement">Bereavement</SelectItem>
                  <SelectItem value="jury_duty">Jury Duty</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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
              <Label htmlFor="date-start">Start Date</Label>
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
              <Label htmlFor="date-end">End Date</Label>
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
      <PTOTable
        data={data}
        isAdmin={isAdmin}
        currentUserId={profile.id}
        sort={sort}
        onSortChange={handleSortChange}
        pagination={pagination}
        onPageChange={handlePageChange}
        onApprove={(id) => openReviewDialog(id, "approve")}
        onReject={(id) => openReviewDialog(id, "reject")}
        onBulkStatusChange={handleBulkStatusChange}
        loading={loading}
        processingId={processingId}
      />

      {/* Request Dialog */}
      <PTORequestDialog
        open={requestDialogOpen}
        onOpenChange={(open) => {
          setRequestDialogOpen(open);
          if (!open) {
            fetchData();
          }
        }}
        profile={profile}
        balances={balances}
        policies={policies}
      />

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Approve" : "Reject"} PTO Request
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve"
                ? "Add an optional comment before approving this request."
                : "Please provide a reason for rejecting this request."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review-comment">
                Comment {reviewAction === "reject" && "(recommended)"}
              </Label>
              <Textarea
                id="review-comment"
                placeholder={
                  reviewAction === "approve"
                    ? "Add a comment (optional)..."
                    : "Explain why this request is being rejected..."
                }
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialogOpen(false);
                setReviewComment("");
              }}
              disabled={processingId === reviewRequestId}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReviewSubmit}
              variant={reviewAction === "reject" ? "destructive" : "default"}
              disabled={processingId === reviewRequestId}
            >
              {processingId === reviewRequestId && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {reviewAction === "approve" ? "Approve" : "Reject"} Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
