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
  Clock,
  ChevronDown,
} from "lucide-react";
import type {
  PTOTableRow,
  PTOSort,
  PTOSortField,
  PTOPagination,
  PTOStatus,
  ptoTypeLabels,
} from "@/types/pto-table";
import { cn } from "@/lib/utils";

interface PTOTableProps {
  data: PTOTableRow[];
  isAdmin: boolean;
  currentUserId: string;
  sort: PTOSort;
  onSortChange: (sort: PTOSort) => void;
  pagination: PTOPagination;
  onPageChange: (page: number) => void;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  onBulkStatusChange?: (requestIds: string[], status: PTOStatus) => Promise<void>;
  loading?: boolean;
  processingId?: string | null;
}

const ptoTypeLabelsMap: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick Leave",
  personal: "Personal",
  bereavement: "Bereavement",
  jury_duty: "Jury Duty",
  other: "Other",
};

/**
 * Get status badge variant
 */
function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          Rejected
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
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
 * Sortable column header component
 */
function SortableHeader({
  field,
  label,
  currentSort,
  onSortChange,
  className,
}: {
  field: PTOSortField;
  label: string;
  currentSort: PTOSort;
  onSortChange: (sort: PTOSort) => void;
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

export function PTOTable({
  data,
  isAdmin,
  currentUserId,
  sort,
  onSortChange,
  pagination,
  onPageChange,
  onApprove,
  onReject,
  onBulkStatusChange,
  loading,
  processingId,
}: PTOTableProps) {
  const showEmployeeColumns = isAdmin;
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
      // Only update if there's a difference
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
  const handleBulkStatusChange = async (status: PTOStatus) => {
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
  const colSpan = showEmployeeColumns ? 12 : 9;

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
              {showEmployeeColumns && (
                <>
                  <TableHead className="w-[50px]"></TableHead>
                  <SortableHeader
                    field="display_name"
                    label="Display Name"
                    currentSort={sort}
                    onSortChange={onSortChange}
                    className="min-w-[140px]"
                  />
                  <SortableHeader
                    field="legal_name"
                    label="Legal Name"
                    currentSort={sort}
                    onSortChange={onSortChange}
                    className="min-w-[140px]"
                  />
                  <SortableHeader
                    field="personal_id"
                    label="Personal ID"
                    currentSort={sort}
                    onSortChange={onSortChange}
                    className="min-w-[100px]"
                  />
                </>
              )}
              <SortableHeader
                field="pto_type"
                label="Type"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[100px]"
              />
              <SortableHeader
                field="start_date"
                label="Start Date"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[110px]"
              />
              <SortableHeader
                field="end_date"
                label="End Date"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[110px]"
              />
              <SortableHeader
                field="total_days"
                label="Days"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[70px]"
              />
              <TableHead className="min-w-[200px]">Reason</TableHead>
              <SortableHeader
                field="status"
                label="Status"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[100px]"
              />
              {isAdmin && (
                <TableHead className="min-w-[100px]">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="h-24 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="h-24 text-center text-muted-foreground"
                >
                  No PTO requests found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((entry) => (
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
                        aria-label={`Select ${entry.displayName}`}
                      />
                    </TableCell>
                  )}
                  {showEmployeeColumns && (
                    <>
                      <TableCell>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={entry.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(entry.displayName, entry.legalName)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{entry.displayName}</TableCell>
                      <TableCell>{entry.legalName}</TableCell>
                      <TableCell>{entry.personalId || "-"}</TableCell>
                    </>
                  )}
                  <TableCell>
                    <Badge variant="secondary">
                      {ptoTypeLabelsMap[entry.ptoType] || entry.ptoType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(parseISO(entry.startDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {format(parseISO(entry.endDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-center">
                    {entry.totalDays.toFixed(1)}
                  </TableCell>
                  <TableCell>
                    <span className="truncate block max-w-[200px]" title={entry.reason || undefined}>
                      {entry.reason || "-"}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(entry.status)}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      {entry.status === "pending" && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => onApprove?.(entry.id)}
                            disabled={processingId === entry.id}
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => onReject?.(entry.id)}
                            disabled={processingId === entry.id}
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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
    </div>
  );
}
