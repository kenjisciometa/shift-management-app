"use client";

import { useMemo } from "react";
import type { Database } from "@/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const PRIVILEGED_ROLES = ["admin", "owner", "manager"] as const;

export interface TimesheetAccess {
  /** Can view all timesheets in the organization */
  canViewAllTimesheets: boolean;
  /** Can approve or reject timesheets */
  canApproveReject: boolean;
  /** Can edit all timesheets */
  canEditAllTimesheets: boolean;
  /** Can filter by employee */
  canFilterByEmployee: boolean;
  /** Is a regular employee (non-privileged role) */
  isEmployee: boolean;
  /** Current user's role */
  role: string | null;
}

/**
 * Hook to determine timesheet access permissions based on user role.
 *
 * Access Rules:
 * - Employee: Can only view/edit their own timesheets (pending only)
 * - Manager/Admin/Owner: Can view/edit all timesheets and approve/reject
 */
export function useTimesheetAccess(profile: Profile | null): TimesheetAccess {
  return useMemo(() => {
    const role = profile?.role ?? null;
    const isPrivileged = role !== null && PRIVILEGED_ROLES.includes(role as typeof PRIVILEGED_ROLES[number]);

    return {
      canViewAllTimesheets: isPrivileged,
      canApproveReject: isPrivileged,
      canEditAllTimesheets: isPrivileged,
      canFilterByEmployee: isPrivileged,
      isEmployee: role === "employee",
      role,
    };
  }, [profile?.role]);
}

/**
 * Check if a user can edit a specific timesheet entry.
 *
 * @param access - Timesheet access permissions
 * @param entryUserId - The user ID of the timesheet entry owner
 * @param currentUserId - The current user's ID
 * @param status - The status of the timesheet entry
 * @returns Whether the user can edit this entry
 */
export function canEditTimesheetEntry(
  access: TimesheetAccess,
  entryUserId: string,
  currentUserId: string,
  status: string
): boolean {
  // Privileged users can edit all entries
  if (access.canEditAllTimesheets) {
    return true;
  }

  // Employees can only edit their own pending entries
  if (access.isEmployee) {
    return entryUserId === currentUserId && status === "pending";
  }

  return false;
}

/**
 * Check if a user can change the status of a timesheet entry.
 * Only privileged users (admin, owner, manager) can change status.
 */
export function canChangeTimesheetStatus(access: TimesheetAccess): boolean {
  return access.canApproveReject;
}
