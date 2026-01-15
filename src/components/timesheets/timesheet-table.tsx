"use client";

import { useState, useEffect } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pencil,
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
  TimesheetTableRow,
  TimesheetSort,
  SortField,
  TimesheetPagination,
  TimesheetStatus,
} from "@/types/timesheet-table";
import type { TimesheetAccess } from "@/hooks/use-timesheet-access";
import { cn } from "@/lib/utils";

interface TimesheetTableProps {
  data: TimesheetTableRow[];
  access: TimesheetAccess;
  currentUserId: string;
  sort: TimesheetSort;
  onSortChange: (sort: TimesheetSort) => void;
  pagination: TimesheetPagination;
  onPageChange: (page: number) => void;
  onEditEntry: (entry: TimesheetTableRow) => void;
  onBulkStatusChange?: (entryIds: string[], status: TimesheetStatus) => Promise<void>;
  loading?: boolean;
}

/**
 * Format minutes to HH:mm display string
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  return `${sign}${hours}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Format difference with +/- sign
 */
function formatDifference(minutes: number): string {
  if (minutes === 0) return "0:00";
  const sign = minutes > 0 ? "+" : "";
  return `${sign}${formatDuration(minutes)}`;
}

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
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
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
  field: SortField;
  label: string;
  currentSort: TimesheetSort;
  onSortChange: (sort: TimesheetSort) => void;
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

export function TimesheetTable({
  data,
  access,
  currentUserId,
  sort,
  onSortChange,
  pagination,
  onPageChange,
  onEditEntry,
  onBulkStatusChange,
  loading,
}: TimesheetTableProps) {
  const showNameColumn = access.canViewAllTimesheets;
  const canBulkEdit = access.canEditAllTimesheets && onBulkStatusChange;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Reset selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [data]);

  /**
   * Check if user can edit this specific entry
   */
  const canEdit = (entry: TimesheetTableRow) => {
    if (access.canEditAllTimesheets) return true;
    if (access.isEmployee) {
      return entry.userId === currentUserId && entry.status === "pending";
    }
    return false;
  };

  /**
   * Handle select all checkbox
   */
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(data.map((entry) => entry.id)));
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
  const handleBulkStatusChange = async (status: TimesheetStatus) => {
    if (!onBulkStatusChange || selectedIds.size === 0) return;

    setBulkLoading(true);
    try {
      await onBulkStatusChange(Array.from(selectedIds), status);
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  const isAllSelected = data.length > 0 && selectedIds.size === data.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < data.length;
  const colSpan = showNameColumn ? 16 : 15;

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
              <DropdownMenuItem onClick={() => handleBulkStatusChange("pending")}>
                <Clock className="h-4 w-4 mr-2 text-yellow-600" />
                Set Pending
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
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) {
                        (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = isIndeterminate;
                      }
                    }}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {showNameColumn && (
                <SortableHeader
                  field="name"
                  label="Name"
                  currentSort={sort}
                  onSortChange={onSortChange}
                  className="min-w-[140px]"
                />
              )}
              <SortableHeader
                field="date"
                label="Date"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[100px]"
              />
              <TableHead className="min-w-[120px]">Locations</TableHead>
              <SortableHeader
                field="positions"
                label="Positions"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[120px]"
              />
              <SortableHeader
                field="clock_in_time"
                label="Clock In"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[80px]"
              />
              <TableHead className="min-w-[80px]">Clock Out</TableHead>
              <TableHead className="min-w-[90px]">Auto Clock-out</TableHead>
              <TableHead className="min-w-[90px]">Break Dur.</TableHead>
              <TableHead className="min-w-[80px]">Break Start</TableHead>
              <TableHead className="min-w-[80px]">Break End</TableHead>
              <SortableHeader
                field="shift_duration"
                label="Shift Dur."
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[90px]"
              />
              <TableHead className="min-w-[100px]">Schedule Dur.</TableHead>
              <TableHead className="min-w-[80px]">Diff</TableHead>
              <SortableHeader
                field="status"
                label="Status"
                currentSort={sort}
                onSortChange={onSortChange}
                className="min-w-[100px]"
              />
              <TableHead className="min-w-[60px]">Edit</TableHead>
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
                  No timesheet entries found.
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
                        aria-label={`Select ${entry.name}`}
                      />
                    </TableCell>
                  )}
                  {showNameColumn && (
                    <TableCell className="font-medium">{entry.name}</TableCell>
                  )}
                  <TableCell>
                    {new Date(entry.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>{entry.locations || "-"}</TableCell>
                  <TableCell>{entry.positions || "-"}</TableCell>
                  <TableCell>{entry.clockInTime || "-"}</TableCell>
                  <TableCell>{entry.clockOutTime || "-"}</TableCell>
                  <TableCell>
                    {entry.autoClockOut ? (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        Yes
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDuration(entry.breakDuration)}</TableCell>
                  <TableCell>{entry.breakStart || "-"}</TableCell>
                  <TableCell>{entry.breakEnd || "-"}</TableCell>
                  <TableCell>{formatDuration(entry.shiftDuration)}</TableCell>
                  <TableCell>{formatDuration(entry.scheduleShiftDuration)}</TableCell>
                  <TableCell>
                    {entry.difference !== null ? (
                      <span
                        className={cn(
                          entry.difference > 0 && "text-green-600",
                          entry.difference < 0 && "text-red-600"
                        )}
                      >
                        {formatDifference(entry.difference)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(entry.status)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditEntry(entry)}
                      disabled={!canEdit(entry)}
                      title={canEdit(entry) ? "Edit entry" : "Cannot edit this entry"}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {(pagination.page - 1) * pagination.limit + 1}-
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
