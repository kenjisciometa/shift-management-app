/**
 * Types for the Shift Swap table view
 */

export type ShiftSwapStatus = "pending" | "target_accepted" | "approved" | "rejected" | "cancelled";

export type ShiftSwapSortField =
  | "requester_name"
  | "target_name"
  | "requester_shift_date"
  | "target_shift_date"
  | "status"
  | "created_at";

export type SortOrder = "asc" | "desc";

/**
 * Shift info for display
 */
export interface ShiftInfo {
  id: string;
  startTime: string;
  endTime: string;
  locationName: string | null;
  positionName: string | null;
  positionColor: string | null;
}

/**
 * Person info for display
 */
export interface PersonInfo {
  id: string;
  displayName: string;
  legalName: string;
  avatarUrl: string | null;
}

/**
 * A single row in the Shift Swap table view
 */
export interface ShiftSwapTableRow {
  /** Unique identifier for this request */
  id: string;
  /** Requester info */
  requester: PersonInfo;
  /** Target info */
  target: PersonInfo;
  /** Requester's shift */
  requesterShift: ShiftInfo | null;
  /** Target's shift */
  targetShift: ShiftInfo | null;
  /** Request status */
  status: ShiftSwapStatus;
  /** Reason for request */
  reason: string | null;
  /** Reviewed by user ID */
  reviewedBy: string | null;
  /** Reviewed at timestamp */
  reviewedAt: string | null;
  /** Applied at timestamp (when shifts were updated in schedule) */
  appliedAt: string | null;
  /** Created at timestamp */
  createdAt: string;
}

/**
 * Filter state for the Shift Swap table
 */
export interface ShiftSwapFilters {
  /** Filter by employee ID (privileged users only) */
  employeeId?: string;
  /** Filter by status */
  status?: ShiftSwapStatus | "all";
  /** Start date for the filter (ISO format) */
  startDate?: string;
  /** End date for the filter (ISO format) */
  endDate?: string;
}

/**
 * Sort state for the Shift Swap table
 */
export interface ShiftSwapSort {
  field: ShiftSwapSortField;
  order: SortOrder;
}

/**
 * Pagination state for the Shift Swap table
 */
export interface ShiftSwapPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Employee option for filter dropdown
 */
export interface EmployeeOption {
  id: string;
  name: string;
}
