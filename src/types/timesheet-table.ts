/**
 * Types for the new Timesheet table view
 */

export type TimesheetStatus = "pending" | "approved" | "rejected";

export type PeriodFilter = "day" | "week" | "month" | "quarter" | "year" | "custom";

export type SortField =
  | "personal_id"
  | "display_name"
  | "legal_name"
  | "date"
  | "positions"
  | "clock_in_time"
  | "shift_duration"
  | "status";

export type SortOrder = "asc" | "desc";

/**
 * A single row in the timesheet table view.
 * This represents a daily time entry for an employee.
 */
export interface TimesheetTableRow {
  /** Unique identifier for this entry */
  id: string;
  /** User ID of the employee */
  userId: string;
  /** Employee code / Personal ID */
  personalId: string | null;
  /** Employee display name */
  displayName: string;
  /** Employee legal name (first_name + last_name) */
  legalName: string;
  /** Work date (ISO format) */
  date: string;
  /** Work location(s) */
  locations: string;
  /** Location ID for filtering */
  locationId: string | null;
  /** Job position/role */
  positions: string;
  /** Clock in time (HH:mm format) */
  clockInTime: string | null;
  /** Clock out time (HH:mm format) */
  clockOutTime: string | null;
  /** Whether auto clock-out was triggered */
  autoClockOut: boolean;
  /** Total break duration in minutes */
  breakDuration: number;
  /** Break start time (HH:mm format) */
  breakStart: string | null;
  /** Break end time (HH:mm format) */
  breakEnd: string | null;
  /** Actual shift duration in minutes (work time - break time) */
  shiftDuration: number;
  /** Scheduled shift duration in minutes */
  scheduleShiftDuration: number;
  /** Difference between actual and scheduled (can be negative, null if no actual work) */
  difference: number | null;
  /** Entry status */
  status: TimesheetStatus;
  /** Original time entry IDs for editing */
  timeEntryIds: {
    clockIn?: string;
    clockOut?: string;
    breakStart?: string;
    breakEnd?: string;
  };
  /** Related timesheet ID if exists */
  timesheetId?: string;
}

/**
 * Filter state for the timesheet table
 */
export interface TimesheetFilters {
  /** Period filter type */
  period: PeriodFilter;
  /** Start date for the filter (ISO format) */
  startDate: string;
  /** End date for the filter (ISO format) */
  endDate: string;
  /** Filter by employee ID (privileged users only) */
  employeeId?: string;
  /** Filter by location ID */
  locationId?: string;
  /** Filter by position */
  position?: string;
  /** Filter by status */
  status?: TimesheetStatus | "all";
}

/**
 * Sort state for the timesheet table
 */
export interface TimesheetSort {
  field: SortField;
  order: SortOrder;
}

/**
 * Pagination state for the timesheet table
 */
export interface TimesheetPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Location option for filter dropdown
 */
export interface LocationOption {
  id: string;
  name: string;
}

/**
 * Employee option for filter dropdown
 */
export interface EmployeeOption {
  id: string;
  name: string;
}

/**
 * Position option for filter dropdown
 */
export interface PositionOption {
  value: string;
  label: string;
}
