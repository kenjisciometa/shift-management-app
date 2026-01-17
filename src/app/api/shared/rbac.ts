import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

// RBAC Types
export type Resource =
  | 'shifts'
  | 'timesheets'
  | 'pto'
  | 'shift_swaps'
  | 'schedules'
  | 'employees'
  | 'settings'
  | 'organizations'
  | 'locations'
  | 'positions'
  | 'departments'
  | 'reports'
  | 'audit_logs'
  | 'invitations';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'approve';

export interface PermissionCheckOptions {
  resource: Resource;
  action: Action;
  targetUserId?: string; // For checking if user can access another user's data
}

export interface PermissionCheckResult {
  hasPermission: boolean;
  reason?: string;
  userRole?: string;
  organizationId?: string;
}

// Role hierarchy: owner > admin > manager > employee
const PRIVILEGED_ROLES = ['owner', 'admin', 'manager'];
const ADMIN_ROLES = ['owner', 'admin'];

/**
 * Check if user has permission to perform an action on a resource
 */
export async function checkPermission(
  supabase: SupabaseClient<Database>,
  userId: string,
  profile: Profile,
  options: PermissionCheckOptions
): Promise<PermissionCheckResult> {
  const { resource, action, targetUserId } = options;

  try {
    const userRole = profile.role || 'employee';
    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        hasPermission: false,
        reason: 'User not associated with any organization',
      };
    }

    // 1. Owner has full access to everything
    if (userRole === 'owner') {
      return {
        hasPermission: true,
        userRole,
        organizationId,
      };
    }

    // 2. Admin has full access to most things
    if (userRole === 'admin') {
      // Admin cannot manage organization-level settings like ownership transfer
      if (resource === 'organizations' && action === 'delete') {
        return {
          hasPermission: false,
          reason: 'Only owner can delete organization',
          userRole,
        };
      }
      return {
        hasPermission: true,
        userRole,
        organizationId,
      };
    }

    // 3. Check resource-specific permissions based on role
    const hasPermission = checkRolePermission(userRole, resource, action, userId, targetUserId);

    if (!hasPermission) {
      return {
        hasPermission: false,
        reason: `Role '${userRole}' does not have '${action}' permission for '${resource}'`,
        userRole,
      };
    }

    return {
      hasPermission: true,
      userRole,
      organizationId,
    };
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      hasPermission: false,
      reason: 'Permission check failed',
    };
  }
}

/**
 * Check if a role has permission for a resource/action combination
 */
function checkRolePermission(
  role: string,
  resource: Resource,
  action: Action,
  userId: string,
  targetUserId?: string
): boolean {
  // Self-access check: user can always access their own data for certain resources
  const isSelfAccess = !targetUserId || targetUserId === userId;

  // Manager permissions
  if (role === 'manager') {
    const managerPermissions: Record<Resource, Action[]> = {
      shifts: ['create', 'read', 'update', 'delete', 'manage'],
      timesheets: ['create', 'read', 'update', 'delete', 'approve'],
      pto: ['create', 'read', 'update', 'delete', 'approve'],
      shift_swaps: ['create', 'read', 'update', 'delete', 'approve'],
      schedules: ['create', 'read', 'update', 'delete', 'manage'],
      employees: ['read', 'update'],
      settings: ['read', 'update'],
      organizations: ['read'],
      locations: ['create', 'read', 'update', 'delete'],
      positions: ['create', 'read', 'update', 'delete'],
      departments: ['create', 'read', 'update', 'delete'],
      reports: ['read'],
      audit_logs: ['read'],
      invitations: ['create', 'read', 'update', 'delete'],
    };

    const allowedActions = managerPermissions[resource] || [];
    return allowedActions.includes(action);
  }

  // Employee permissions
  if (role === 'employee' || !role) {
    // Employee can only access their own data for most resources
    const employeePermissions: Record<Resource, { actions: Action[]; selfOnly: boolean }> = {
      shifts: { actions: ['read'], selfOnly: true },
      timesheets: { actions: ['create', 'read', 'update'], selfOnly: true },
      pto: { actions: ['create', 'read'], selfOnly: true },
      shift_swaps: { actions: ['create', 'read', 'update'], selfOnly: true },
      schedules: { actions: ['read'], selfOnly: false }, // Can view schedules
      employees: { actions: ['read'], selfOnly: true },
      settings: { actions: [], selfOnly: true },
      organizations: { actions: ['read'], selfOnly: false },
      locations: { actions: ['read'], selfOnly: false },
      positions: { actions: ['read'], selfOnly: false },
      departments: { actions: ['read'], selfOnly: false },
      reports: { actions: [], selfOnly: true },
      audit_logs: { actions: [], selfOnly: true },
      invitations: { actions: [], selfOnly: true },
    };

    const permission = employeePermissions[resource];
    if (!permission) return false;

    const hasAction = permission.actions.includes(action);
    if (!hasAction) return false;

    // If self-only, check if accessing own data
    if (permission.selfOnly && !isSelfAccess) {
      return false;
    }

    return true;
  }

  // Default: no permission
  return false;
}

/**
 * Helper to check if user has admin/manager privileges
 */
export function isPrivilegedUser(role: string | null): boolean {
  return PRIVILEGED_ROLES.includes(role || '');
}

/**
 * Helper to check if user has admin/owner privileges
 */
export function isAdminUser(role: string | null): boolean {
  return ADMIN_ROLES.includes(role || '');
}

/**
 * Helper to validate organization access
 */
export async function validateOrganizationAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId: string
): Promise<{ valid: boolean; reason?: string }> {
  const { data: userProfile, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (error || !userProfile) {
    return { valid: false, reason: 'User profile not found' };
  }

  if (userProfile.organization_id !== organizationId) {
    return { valid: false, reason: 'User does not belong to this organization' };
  }

  return { valid: true };
}
