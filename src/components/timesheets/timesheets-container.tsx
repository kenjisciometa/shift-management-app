"use client";

import { useState, useEffect, useCallback } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  format,
} from "date-fns";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { TimesheetTable } from "./timesheet-table";
import { PeriodFilter } from "./period-filter";
import { DateRangePicker } from "./date-range-picker";
import { TimesheetFilters } from "./timesheet-filters";
import { EditEntryDialog, type EditEntryData } from "./edit-entry-dialog";
import { useTimesheetAccess, type TimesheetAccess } from "@/hooks/use-timesheet-access";
import type { Database } from "@/types/database.types";
import type {
  TimesheetTableRow,
  TimesheetSort,
  TimesheetPagination,
  PeriodFilter as PeriodFilterType,
  TimesheetStatus,
  LocationOption,
  EmployeeOption,
} from "@/types/timesheet-table";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface TimesheetsContainerProps {
  profile: Profile;
  initialLocations: LocationOption[];
  initialEmployees: EmployeeOption[];
}

/**
 * Get initial date range based on period type
 */
function getInitialDateRange(period: PeriodFilterType): { start: Date; end: Date } {
  const today = new Date();
  switch (period) {
    case "day":
      return { start: today, end: today };
    case "week":
      return {
        start: startOfWeek(today, { weekStartsOn: 0 }),
        end: endOfWeek(today, { weekStartsOn: 0 }),
      };
    case "month":
      return { start: startOfMonth(today), end: endOfMonth(today) };
    case "quarter":
      return { start: startOfQuarter(today), end: endOfQuarter(today) };
    case "year":
      return { start: startOfYear(today), end: endOfYear(today) };
    case "custom":
      return { start: today, end: today };
    default:
      return { start: startOfMonth(today), end: endOfMonth(today) };
  }
}

export function TimesheetsContainer({
  profile,
  initialLocations,
  initialEmployees,
}: TimesheetsContainerProps) {
  const supabase = createClient();
  const access = useTimesheetAccess(profile);

  // State
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TimesheetTableRow[]>([]);
  const [period, setPeriod] = useState<PeriodFilterType>("month");
  const [dateRange, setDateRange] = useState(() => getInitialDateRange("month"));
  const [sort, setSort] = useState<TimesheetSort>({ field: "name", order: "asc" });
  const [pagination, setPagination] = useState<TimesheetPagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<TimesheetStatus | "all">("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  // Edit modal
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimesheetTableRow | null>(null);

  /**
   * Fetch timesheet data
   */
  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const startDate = format(dateRange.start, "yyyy-MM-dd");
      const endDate = format(dateRange.end, "yyyy-MM-dd");

      // Build query for time entries grouped by date and user
      let query = supabase
        .from("time_entries")
        .select(`
          id,
          user_id,
          timestamp,
          entry_type,
          location_id,
          is_manual,
          notes,
          status,
          profiles!time_entries_user_id_fkey (
            id,
            first_name,
            last_name,
            display_name
          ),
          locations (
            id,
            name
          )
        `)
        .eq("organization_id", profile.organization_id)
        .gte("timestamp", `${startDate}T00:00:00`)
        .lte("timestamp", `${endDate}T23:59:59`);

      // Apply role-based filtering
      if (!access.canViewAllTimesheets) {
        query = query.eq("user_id", profile.id);
      } else if (employeeFilter !== "all") {
        query = query.eq("user_id", employeeFilter);
      }

      // Apply location filter
      if (locationFilter !== "all") {
        query = query.eq("location_id", locationFilter);
      }

      const { data: timeEntries, error } = await query;

      if (error) {
        console.error("Error fetching time entries:", error);
        toast.error("Failed to load timesheet data");
        return;
      }

      // Fetch shifts for the same period to calculate scheduled hours
      let shiftsQuery = supabase
        .from("shifts")
        .select(`
          id,
          user_id,
          start_time,
          end_time,
          break_minutes,
          location_id,
          profiles!shifts_user_id_fkey (
            id,
            first_name,
            last_name,
            display_name
          ),
          locations (
            id,
            name
          )
        `)
        .eq("organization_id", profile.organization_id)
        .gte("start_time", `${startDate}T00:00:00`)
        .lte("start_time", `${endDate}T23:59:59`);

      if (!access.canViewAllTimesheets) {
        shiftsQuery = shiftsQuery.eq("user_id", profile.id);
      } else if (employeeFilter !== "all") {
        shiftsQuery = shiftsQuery.eq("user_id", employeeFilter);
      }

      const { data: shifts } = await shiftsQuery;

      // Process time entries into table rows with shift data
      const rows = processTimeEntries(timeEntries || [], statusFilter, shifts || []);

      // Sort data
      const sortedRows = sortData(rows, sort);

      // Update pagination
      const total = sortedRows.length;
      const totalPages = Math.ceil(total / pagination.limit);
      setPagination((prev) => ({ ...prev, total, totalPages }));

      // Paginate data
      const start = (pagination.page - 1) * pagination.limit;
      const paginatedRows = sortedRows.slice(start, start + pagination.limit);

      setData(paginatedRows);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load timesheet data");
    } finally {
      setLoading(false);
    }
  }, [
    supabase,
    profile.organization_id,
    profile.id,
    access.canViewAllTimesheets,
    dateRange,
    statusFilter,
    employeeFilter,
    locationFilter,
    sort,
    pagination.page,
    pagination.limit,
  ]);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Handle period change
   */
  const handlePeriodChange = (newPeriod: PeriodFilterType) => {
    setPeriod(newPeriod);
    const newRange = getInitialDateRange(newPeriod);
    setDateRange(newRange);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  /**
   * Handle date range change
   */
  const handleDateChange = (start: Date, end: Date) => {
    setDateRange({ start, end });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  /**
   * Handle sort change
   */
  const handleSortChange = (newSort: TimesheetSort) => {
    setSort(newSort);
  };

  /**
   * Handle page change
   */
  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  /**
   * Handle edit entry
   */
  const handleEditEntry = (entry: TimesheetTableRow) => {
    setSelectedEntry(entry);
    setEditDialogOpen(true);
  };

  /**
   * Handle save entry
   */
  const handleSaveEntry = async (editData: EditEntryData) => {
    // TODO: Implement API call to update time entry
    // For now, just refresh the data
    console.log("Saving entry:", editData);

    // Call API to update time entries
    const response = await fetch(`/api/timesheets/entries/${editData.entryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });

    if (!response.ok) {
      throw new Error("Failed to update entry");
    }

    await fetchData();
  };

  /**
   * Handle bulk status change
   */
  const handleBulkStatusChange = async (entryIds: string[], status: TimesheetStatus) => {
    try {
      // Collect all time entry IDs to update
      const allTimeEntryIds: string[] = [];

      for (const entryId of entryIds) {
        // Find the corresponding row to get time entry IDs
        const row = data.find((r) => r.id === entryId);
        if (!row) continue;

        // Get all time entry IDs for this row
        const timeEntryIds = Object.values(row.timeEntryIds).filter(Boolean) as string[];
        allTimeEntryIds.push(...timeEntryIds);
      }

      if (allTimeEntryIds.length > 0) {
        // Batch update all time entries with new status
        const { error } = await supabase
          .from("time_entries")
          .update({
            status,
            approved_at: status === "approved" ? new Date().toISOString() : null,
            approved_by: status === "approved" ? profile.id : null,
            updated_at: new Date().toISOString(),
          })
          .in("id", allTimeEntryIds);

        if (error) throw error;
      }

      toast.success(`${entryIds.length} entries updated to ${status}`);
      await fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
      throw error;
    }
  };

  /**
   * Handle CSV export
   */
  const handleExportCSV = async () => {
    const startDate = format(dateRange.start, "yyyy-MM-dd");
    const endDate = format(dateRange.end, "yyyy-MM-dd");

    // Build export URL with current filters
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      format: "csv",
    });

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    if (employeeFilter !== "all") {
      params.set("employee_id", employeeFilter);
    }
    if (locationFilter !== "all") {
      params.set("location_id", locationFilter);
    }

    try {
      const response = await fetch(`/api/timesheets/export?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timesheets_${period}_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export CSV");
    }
  };

  // Page title based on role
  const pageTitle = access.canViewAllTimesheets ? "Timesheets" : "My Timesheets";

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Filters</CardTitle>
            <Button onClick={handleExportCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Period and Date Row */}
          <div className="flex flex-wrap items-center gap-4">
            <PeriodFilter value={period} onValueChange={handlePeriodChange} />
            <DateRangePicker
              period={period}
              startDate={dateRange.start}
              endDate={dateRange.end}
              onDateChange={handleDateChange}
            />
          </div>

          {/* Additional Filters Row */}
          <TimesheetFilters
            canFilterByEmployee={access.canFilterByEmployee}
            status={statusFilter}
            employeeId={employeeFilter}
            locationId={locationFilter}
            employees={initialEmployees}
            locations={initialLocations}
            onStatusChange={(value) => {
              setStatusFilter(value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            onEmployeeChange={(value) => {
              setEmployeeFilter(value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            onLocationChange={(value) => {
              setLocationFilter(value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          />
        </CardContent>
      </Card>

      {/* Table */}
      <TimesheetTable
        data={data}
        access={access}
        currentUserId={profile.id}
        sort={sort}
        onSortChange={handleSortChange}
        pagination={pagination}
        onPageChange={handlePageChange}
        onEditEntry={handleEditEntry}
        onBulkStatusChange={handleBulkStatusChange}
        loading={loading}
      />

      {/* Edit Dialog */}
      <EditEntryDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        entry={selectedEntry}
        access={access}
        onSave={handleSaveEntry}
      />
    </div>
  );
}

/**
 * Process raw time entries into table rows
 */
function processTimeEntries(
  timeEntries: Array<{
    id: string;
    user_id: string;
    timestamp: string;
    entry_type: string;
    location_id: string | null;
    is_manual: boolean | null;
    notes: string | null;
    status: string | null;
    profiles: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      display_name: string | null;
    } | null;
    locations: {
      id: string;
      name: string;
    } | null;
  }>,
  statusFilter: TimesheetStatus | "all",
  shifts: Array<{
    id: string;
    user_id: string;
    start_time: string;
    end_time: string;
    break_minutes: number | null;
    location_id: string | null;
    profiles: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      display_name: string | null;
    } | null;
    locations: {
      id: string;
      name: string;
    } | null;
  }>
): TimesheetTableRow[] {
  // Group entries by user and date
  const grouped = new Map<string, typeof timeEntries>();

  for (const entry of timeEntries) {
    const date = entry.timestamp.split("T")[0];
    const key = `${entry.user_id}_${date}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  }

  // Convert groups to table rows
  const rows: TimesheetTableRow[] = [];

  for (const [key, entries] of grouped) {
    const [userId, date] = key.split("_");
    const firstEntry = entries[0];

    // Find specific entry types
    const clockIn = entries.find((e) => e.entry_type === "clock_in");
    const clockOut = entries.find((e) => e.entry_type === "clock_out");
    const breakStart = entries.find((e) => e.entry_type === "break_start");
    const breakEnd = entries.find((e) => e.entry_type === "break_end");

    // Calculate times
    const clockInTime = clockIn
      ? format(new Date(clockIn.timestamp), "HH:mm")
      : null;
    const clockOutTime = clockOut
      ? format(new Date(clockOut.timestamp), "HH:mm")
      : null;
    const breakStartTime = breakStart
      ? format(new Date(breakStart.timestamp), "HH:mm")
      : null;
    const breakEndTime = breakEnd
      ? format(new Date(breakEnd.timestamp), "HH:mm")
      : null;

    // Calculate durations
    let shiftMinutes = 0;
    let breakMinutes = 0;

    if (clockIn && clockOut) {
      const inTime = new Date(clockIn.timestamp).getTime();
      const outTime = new Date(clockOut.timestamp).getTime();
      shiftMinutes = Math.round((outTime - inTime) / 60000);
    }

    if (breakStart && breakEnd) {
      const startTime = new Date(breakStart.timestamp).getTime();
      const endTime = new Date(breakEnd.timestamp).getTime();
      breakMinutes = Math.round((endTime - startTime) / 60000);
    }

    const workMinutes = shiftMinutes - breakMinutes;

    // Get employee name
    const profile = firstEntry.profiles;
    const name = profile?.display_name ||
      `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() ||
      "Unknown";

    // Get location
    const location = firstEntry.locations;
    const locationName = location?.name || "";

    // Check for auto clock-out (placeholder - would need to check device_info or notes)
    const autoClockOut = clockOut?.notes?.includes("auto") || false;

    // Determine status from clock_in entry (or first entry with status)
    const entryWithStatus = entries.find((e) => e.status) || clockIn;
    const status: TimesheetStatus = (entryWithStatus?.status as TimesheetStatus) || "pending";

    // Apply status filter
    if (statusFilter !== "all" && status !== statusFilter) {
      continue;
    }

    // Find the scheduled shift for this user and date
    const scheduledShift = shifts.find((shift) => {
      const shiftDate = shift.start_time.split("T")[0];
      return shift.user_id === userId && shiftDate === date;
    });

    // Calculate scheduled shift duration in minutes
    let scheduledMinutes = 0;
    if (scheduledShift) {
      const shiftStart = new Date(scheduledShift.start_time).getTime();
      const shiftEnd = new Date(scheduledShift.end_time).getTime();
      const shiftBreakMinutes = scheduledShift.break_minutes || 0;
      scheduledMinutes = Math.round((shiftEnd - shiftStart) / 60000) - shiftBreakMinutes;
    }

    // Calculate difference (actual - scheduled) only if there's actual work
    const difference = workMinutes > 0 ? workMinutes - scheduledMinutes : null;

    rows.push({
      id: key,
      userId,
      name,
      date,
      locations: locationName,
      locationId: location?.id || null,
      positions: "", // Would come from profile
      clockInTime,
      clockOutTime,
      autoClockOut,
      breakDuration: breakMinutes,
      breakStart: breakStartTime,
      breakEnd: breakEndTime,
      shiftDuration: workMinutes,
      scheduleShiftDuration: scheduledMinutes,
      difference,
      status,
      timeEntryIds: {
        clockIn: clockIn?.id,
        clockOut: clockOut?.id,
        breakStart: breakStart?.id,
        breakEnd: breakEnd?.id,
      },
    });
  }

  // Add scheduled shifts that don't have time entries
  for (const shift of shifts) {
    const shiftDate = shift.start_time.split("T")[0];
    const key = `${shift.user_id}_${shiftDate}`;

    // Skip if we already have time entries for this user/date
    if (grouped.has(key)) {
      continue;
    }

    // Calculate scheduled shift duration in minutes
    const shiftStart = new Date(shift.start_time).getTime();
    const shiftEnd = new Date(shift.end_time).getTime();
    const shiftBreakMinutes = shift.break_minutes || 0;
    const scheduledMinutes = Math.round((shiftEnd - shiftStart) / 60000) - shiftBreakMinutes;

    // Get employee name from shift's profile
    const shiftProfile = shift.profiles;
    const name = shiftProfile?.display_name ||
      `${shiftProfile?.first_name || ""} ${shiftProfile?.last_name || ""}`.trim() ||
      "Unknown";

    // Get location from shift
    const locationName = shift.locations?.name || "";

    // Determine status - scheduled shifts without clock in are "scheduled"
    const status: TimesheetStatus = "pending";

    // Apply status filter
    if (statusFilter !== "all" && status !== statusFilter) {
      continue;
    }

    rows.push({
      id: `shift_${shift.id}`,
      userId: shift.user_id,
      name,
      date: shiftDate,
      locations: locationName,
      locationId: shift.location_id,
      positions: "",
      clockInTime: null,
      clockOutTime: null,
      autoClockOut: false,
      breakDuration: 0,
      breakStart: null,
      breakEnd: null,
      shiftDuration: 0,
      scheduleShiftDuration: scheduledMinutes,
      difference: null, // No work done yet, so no difference to show
      status,
      timeEntryIds: {
        clockIn: undefined,
        clockOut: undefined,
        breakStart: undefined,
        breakEnd: undefined,
      },
    });
  }

  return rows;
}

/**
 * Sort table rows
 */
function sortData(data: TimesheetTableRow[], sort: TimesheetSort): TimesheetTableRow[] {
  const sorted = [...data];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sort.field) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "date":
        comparison = a.date.localeCompare(b.date);
        break;
      case "positions":
        comparison = a.positions.localeCompare(b.positions);
        break;
      case "clock_in_time":
        comparison = (a.clockInTime || "").localeCompare(b.clockInTime || "");
        break;
      case "shift_duration":
        comparison = a.shiftDuration - b.shiftDuration;
        break;
      case "status":
        const statusOrder = { pending: 0, approved: 1, rejected: 2 };
        comparison = statusOrder[a.status] - statusOrder[b.status];
        break;
      default:
        comparison = 0;
    }

    return sort.order === "asc" ? comparison : -comparison;
  });

  return sorted;
}
