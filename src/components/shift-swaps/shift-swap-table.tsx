"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  ChevronDown,
  ArrowRightLeft,
  Clock,
  MapPin,
  Play,
} from "lucide-react";
import type {
  ShiftSwapTableRow,
  ShiftSwapSort,
  ShiftSwapSortField,
  ShiftSwapPagination,
  ShiftSwapStatus,
  ShiftInfo,
} from "@/types/shift-swap-table";
import { cn } from "@/lib/utils";

interface ShiftSwapTableProps {
  data: ShiftSwapTableRow[];
  isAdmin: boolean;
  currentUserId: string;
  sort: ShiftSwapSort;
  onSortChange: (sort: ShiftSwapSort) => void;
  pagination: ShiftSwapPagination;
  onPageChange: (page: number) => void;
  onApprove?: (swapId: string) => void;
  onReject?: (swapId: string) => void;
  onCancel?: (swapId: string) => void;
  onTargetAccept?: (swapId: string) => void;
  onTargetReject?: (swapId: string) => void;
  onApplyToSchedule?: (swapId: string) => void;
  onBulkStatusChange?: (swapIds: string[], status: ShiftSwapStatus) => Promise<void>;
  loading?: boolean;
  processingId?: string | null;
  /** Whether auto-update schedule is enabled */
  autoUpdateSchedule?: boolean;
}

/**
 * Get status badge variant
 */
function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800">
          Pending
        </Badge>
      );
    case "target_accepted":
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
          Awaiting Approval
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
          Rejected
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800">
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/**
 * Get initials from name
 */
function getInitials(displayName: string, legalName: string): string {
  const name = displayName || legalName;
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/**
 * Format shift info for display
 */
function formatShiftInfo(shift: ShiftInfo | null): React.ReactNode {
  if (!shift) return <span className="text-muted-foreground">-</span>;

  const start = parseISO(shift.startTime);
  const end = parseISO(shift.endTime);

  return (
    <div className="space-y-0.5">
      <div className="font-medium text-sm">
        {format(start, "MMM d")}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {format(start, "h:mm a")} - {format(end, "h:mm a")}
      </div>
      {shift.locationName && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {shift.locationName}
        </div>
      )}
      {shift.positionName && (
        <div className="text-xs text-muted-foreground">
          {shift.positionName}
        </div>
      )}
    </div>
  );
}

/**
 * Sortable column header component
 */
function SortableHeader({
  field,
  label,
  currentSort,
  onSortChange,
  className,
}: {
  field: ShiftSwapSortField;
  label: string;
  currentSort: ShiftSwapSort;
  onSortChange: (sort: ShiftSwapSort) => void;
  className?: string;
}) {
  const isActive = currentSort.field === field;

  const handleClick = () => {
    if (isActive) {
      onSortChange({
        field,
        order: currentSort.order === "asc" ? "desc" : "asc",
      });
    } else {
      onSortChange({ field, order: "asc" });
    }
  };

  return (
    <TableHead className={cn("cursor-pointer select-none hover:bg-muted/50", className)} onClick={handleClick}>
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentSort.order === "asc" ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </TableHead>
  );
}

export function ShiftSwapTable({
  data,
  isAdmin,
  currentUserId,
  sort,
  onSortChange,
  pagination,
  onPageChange,
  onApprove,
  onReject,
  onCancel,
  onTargetAccept,
  onTargetReject,
  onApplyToSchedule,
  onBulkStatusChange,
  loading,
  processingId,
  autoUpdateSchedule = true,
}: ShiftSwapTableProps) {
  const canBulkEdit = isAdmin && onBulkStatusChange;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Clear selection for IDs that no longer exist in data
  useEffect(() => {
    const currentIds = new Set(data.map(entry => entry.id));
    setSelectedIds(prev => {
      const newSelected = new Set<string>();
      prev.forEach(id => {
        if (currentIds.has(id)) {
          newSelected.add(id);
        }
      });
      if (newSelected.size !== prev.size) {
        return newSelected;
      }
      return prev;
    });
  }, [data]);

  /**
   * Handle select all checkbox
   */
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select pending requests for bulk actions
      const pendingIds = data.filter(entry => entry.status === "pending").map(entry => entry.id);
      setSelectedIds(new Set(pendingIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  /**
   * Handle individual row selection
   */
  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  /**
   * Handle bulk status change
   */
  const handleBulkStatusChange = async (status: ShiftSwapStatus) => {
    if (!onBulkStatusChange || selectedIds.size === 0) return;

    setBulkLoading(true);
    try {
      await onBulkStatusChange(Array.from(selectedIds), status);
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  const pendingData = data.filter(entry => entry.status === "pending");
  const isAllSelected = pendingData.length > 0 && selectedIds.size === pendingData.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < pendingData.length;
  const headerCheckboxState = isAllSelected ? true : isIndeterminate ? "indeterminate" : false;
  const colSpan = isAdmin ? 8 : 7;

  return (
    <div className="space-y-4">
      {/* Bulk Action Bar */}
      {canBulkEdit && selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={bulkLoading}>
                Change Status
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleBulkStatusChange("approved")}>
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkStatusChange("rejected")}>
                <XCircle className="h-4 w-4 mr-2 text-red-600" />
                Reject
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {canBulkEdit && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={headerCheckboxState}
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
                    aria-label="Select all pending"
                    disabled={pendingData.length === 0}
                  />
                </TableHead>
              )}
              <TableHead className="w-[50px]"></TableHead>
              <SortableHeader
                field="requester_name"
                label="Requester"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[140px]"
              />
              <SortableHeader
                field="requester_shift_date"
                label="Requester Shift"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[150px]"
              />
              <TableHead className="w-[50px] text-center">
                <ArrowRightLeft className="h-4 w-4 mx-auto text-muted-foreground" />
              </TableHead>
              <SortableHeader
                field="target_name"
                label="Target"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[140px]"
              />
              <SortableHeader
                field="target_shift_date"
                label="Target Shift"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[150px]"
              />
              <TableHead className="min-w-[150px]">Reason</TableHead>
              <SortableHeader
                field="status"
                label="Status"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[100px]"
              />
              <SortableHeader
                field="created_at"
                label="Created"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[100px]"
              />
              <TableHead className="min-w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan + 4}
                  className="h-24 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan + 4}
                  className="h-24 text-center text-muted-foreground"
                >
                  No shift swap requests found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((entry) => {
                const isOwnRequest = entry.requester.id === currentUserId;
                const isTargetOfRequest = entry.target.id === currentUserId;
                const canCancel = isOwnRequest && entry.status === "pending";
                const canReview = isAdmin && (entry.status === "pending" || entry.status === "target_accepted");
                const canTargetRespond = isTargetOfRequest && entry.status === "pending" && !isAdmin;
                // Show Apply button for approved swaps that haven't been applied to schedule yet
                const canApplyToSchedule = isAdmin && entry.status === "approved" && !entry.appliedAt && !autoUpdateSchedule;

                return (
                  <TableRow
                    key={entry.id}
                    className={cn(selectedIds.has(entry.id) && "bg-muted/50")}
                  >
                    {canBulkEdit && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(entry.id)}
                          onCheckedChange={(checked) =>
                            handleSelectRow(entry.id, checked as boolean)
                          }
                          disabled={entry.status !== "pending"}
                          aria-label={`Select ${entry.requester.displayName}`}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={entry.requester.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(entry.requester.displayName, entry.requester.legalName)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.requester.displayName}
                    </TableCell>
                    <TableCell>{formatShiftInfo(entry.requesterShift)}</TableCell>
                    <TableCell className="text-center">
                      <ArrowRightLeft className="h-4 w-4 mx-auto text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={entry.target.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(entry.target.displayName, entry.target.legalName)}
                          </AvatarFallback>
                        </Avatar>
                        {entry.target.displayName}
                      </div>
                    </TableCell>
                    <TableCell>{formatShiftInfo(entry.targetShift)}</TableCell>
                    <TableCell>
                      <span className="truncate block max-w-[150px]" title={entry.reason || undefined}>
                        {entry.reason || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(entry.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canReview && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                              onClick={() => onApprove?.(entry.id)}
                              disabled={processingId === entry.id}
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => onReject?.(entry.id)}
                              disabled={processingId === entry.id}
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {canCancel && !isAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCancel?.(entry.id)}
                            disabled={processingId === entry.id}
                          >
                            Cancel
                          </Button>
                        )}
                        {canTargetRespond && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => onTargetAccept?.(entry.id)}
                              disabled={processingId === entry.id}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => onTargetReject?.(entry.id)}
                              disabled={processingId === entry.id}
                            >
                              Decline
                            </Button>
                          </>
                        )}
                        {canApplyToSchedule && (
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => onApplyToSchedule?.(entry.id)}
                            disabled={processingId === entry.id}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Apply
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}-
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pagination.page === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-8"
                    onClick={() => onPageChange(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
