/**
 * Types for the PTO table view
 */

export type PTOStatus = "pending" | "approved" | "rejected" | "cancelled";

export type PTOType = "vacation" | "sick" | "personal" | "bereavement" | "jury_duty" | "other";

export type PTOSortField =
  | "display_name"
  | "legal_name"
  | "personal_id"
  | "pto_type"
  | "start_date"
  | "end_date"
  | "total_days"
  | "status"
  | "created_at";

export type SortOrder = "asc" | "desc";

/**
 * A single row in the PTO table view
 */
export interface PTOTableRow {
  /** Unique identifier for this request */
  id: string;
  /** User ID of the employee */
  userId: string;
  /** Employee code / Personal ID */
  personalId: string | null;
  /** Employee display name */
  displayName: string;
  /** Employee legal name (first_name + last_name) */
  legalName: string;
  /** Avatar URL */
  avatarUrl: string | null;
  /** PTO type */
  ptoType: PTOType;
  /** Start date (ISO format) */
  startDate: string;
  /** End date (ISO format) */
  endDate: string;
  /** Total days requested */
  totalDays: number;
  /** Reason for request */
  reason: string | null;
  /** Request status */
  status: PTOStatus;
  /** Review comment from approver */
  reviewComment: string | null;
  /** Reviewed by user ID */
  reviewedBy: string | null;
  /** Reviewed at timestamp */
  reviewedAt: string | null;
  /** Created at timestamp */
  createdAt: string;
}

/**
 * Filter state for the PTO table
 */
export interface PTOFilters {
  /** Filter by employee ID (privileged users only) */
  employeeId?: string;
  /** Filter by PTO type */
  ptoType?: PTOType | "all";
  /** Filter by status */
  status?: PTOStatus | "all";
  /** Start date for the filter (ISO format) */
  startDate?: string;
  /** End date for the filter (ISO format) */
  endDate?: string;
}

/**
 * Sort state for the PTO table
 */
export interface PTOSort {
  field: PTOSortField;
  order: SortOrder;
}

/**
 * Pagination state for the PTO table
 */
export interface PTOPagination {
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

/**
 * PTO type labels for display
 */
export const ptoTypeLabels: Record<PTOType, string> = {
  vacation: "Vacation",
  sick: "Sick Leave",
  personal: "Personal",
  bereavement: "Bereavement",
  jury_duty: "Jury Duty",
  other: "Other",
};
