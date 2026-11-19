import 'server-only';
import { createClient as createSessionSupabaseClient } from '@/lib/supabase/server';
import {
  createServiceRoleClient,
  isCmsSupabaseConfigured,
} from '@/lib/supabase/serviceRole';
import {
  canEditArticleInStatus,
  canTransitionArticleStatus,
  hasAnyEditorialRole,
  hasEditorialPermission,
} from './rbac';
import {
  isEditorialRole,
  type ArticleStatus,
  type EditorialAction,
  type EditorialRole,
  type StaffProfile,
} from './roles';

export type StaffAuthErrorCode =
  | 'CMS_NOT_CONFIGURED'
  | 'AUTH_SERVICE_UNAVAILABLE'
  | 'UNAUTHENTICATED'
  | 'STAFF_NOT_REGISTERED'
  | 'STAFF_INACTIVE'
  | 'INVALID_STAFF_ROLE'
  | 'FORBIDDEN'
  | 'INVALID_TRANSITION'
  | 'STAFF_LOOKUP_FAILED';

export class StaffAuthError extends Error {
  readonly status: 401 | 403 | 500 | 503;
  readonly code: StaffAuthErrorCode;

  constructor(
    status: 401 | 403 | 500 | 503,
    code: StaffAuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'StaffAuthError';
    this.status = status;
    this.code = code;
  }
}

export interface StaffAuthDependencies {
  getAuthenticatedUser: () => Promise<{ id: string; email?: string | null } | null>;
  findStaffByAuthUserId: (authUserId: string) => Promise<StaffProfile | null>;
  isConfigured?: () => boolean;
}

async function getDefaultStaffDependencies(): Promise<StaffAuthDependencies> {
  return {
    isConfigured: isCmsSupabaseConfigured,
    getAuthenticatedUser: async () => {
      try {
        const supabase = await createSessionSupabaseClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error || !user) {
          return null;
        }
        return { id: user.id, email: user.email ?? null };
      } catch {
        throw new StaffAuthError(
          503,
          'AUTH_SERVICE_UNAVAILABLE',
          'Unable to verify staff authentication session.'
        );
      }
    },
    findStaffByAuthUserId: async (authUserId: string) => {
      try {
        const serviceClient = createServiceRoleClient();
        const { data, error } = await serviceClient
          .from('staff_users')
          .select(
            'id, auth_user_id, email, full_name, role, is_active, last_login_at, created_at, updated_at'
          )
          .eq('auth_user_id', authUserId)
          .maybeSingle();

        if (error) {
          throw new StaffAuthError(
            500,
            'STAFF_LOOKUP_FAILED',
            'Unable to verify staff authorization record.'
          );
        }

        return (data as StaffProfile | null) ?? null;
      } catch (err) {
        if (err instanceof StaffAuthError) {
          throw err;
        }
        throw new StaffAuthError(
          503,
          'STAFF_LOOKUP_FAILED',
          'Unable to verify staff authorization record.'
        );
      }
    },
  };
}

/**
 * Verifies the caller's Supabase Auth JWT via `auth.getUser()` and resolves
 * their authoritative RBAC role from `staff_users`. Never trusts client
 * headers, request bodies, or raw JWT metadata for role authorization.
 */
export async function resolveAuthenticatedStaff(
  depsOverride?: StaffAuthDependencies
): Promise<StaffProfile> {
  const deps = depsOverride ?? (await getDefaultStaffDependencies());
  const configured = deps.isConfigured ? deps.isConfigured() : true;

  if (!configured) {
    throw new StaffAuthError(
      503,
      'CMS_NOT_CONFIGURED',
      'Editorial authentication service is not configured.'
    );
  }

  const authUser = await deps.getAuthenticatedUser();
  if (!authUser || !authUser.id) {
    throw new StaffAuthError(
      401,
      'UNAUTHENTICATED',
      'Active staff authentication session required.'
    );
  }

  const staffRecord = await deps.findStaffByAuthUserId(authUser.id);
  if (!staffRecord) {
    throw new StaffAuthError(
      403,
      'STAFF_NOT_REGISTERED',
      'Account is not registered in staff_users. Contact an administrator.'
    );
  }

  if (staffRecord.is_active !== true) {
    throw new StaffAuthError(
      403,
      'STAFF_INACTIVE',
      'Staff account has been deactivated.'
    );
  }

  if (!isEditorialRole(staffRecord.role)) {
    throw new StaffAuthError(
      403,
      'INVALID_STAFF_ROLE',
      'Staff record does not carry a recognized editorial role.'
    );
  }

  if (
    authUser.email &&
    authUser.email.trim().toLowerCase() !== staffRecord.email.trim().toLowerCase()
  ) {
    throw new StaffAuthError(
      403,
      'FORBIDDEN',
      'Authenticated account identity does not match registered staff profile.'
    );
  }

  return staffRecord;
}

export interface RequireStaffSessionOptions {
  roles?: readonly EditorialRole[];
  action?: EditorialAction;
  editStatus?: ArticleStatus;
  transition?: {
    from: ArticleStatus;
    to: ArticleStatus;
  };
}

/**
 * Enforces authenticated active staff session plus optional role, action,
 * edit-status, and workflow transition checks on server routes/components.
 */
export async function requireStaffSession(
  options: RequireStaffSessionOptions = {},
  depsOverride?: StaffAuthDependencies
): Promise<StaffProfile> {
  const staff = await resolveAuthenticatedStaff(depsOverride);

  if (options.roles && !hasAnyEditorialRole(staff.role, options.roles)) {
    throw new StaffAuthError(
      403,
      'FORBIDDEN',
      `Role '${staff.role}' is not permitted for this resource.`
    );
  }

  if (options.action && !hasEditorialPermission(staff.role, options.action)) {
    throw new StaffAuthError(
      403,
      'FORBIDDEN',
      `Role '${staff.role}' lacks '${options.action}' permission.`
    );
  }

  if (
    options.editStatus &&
    !canEditArticleInStatus(staff.role, options.editStatus)
  ) {
    throw new StaffAuthError(
      403,
      'FORBIDDEN',
      `Role '${staff.role}' cannot modify articles in '${options.editStatus}' status.`
    );
  }

  if (options.transition) {
    const check = canTransitionArticleStatus(
      staff.role,
      options.transition.from,
      options.transition.to
    );
    if (!check.allowed) {
      throw new StaffAuthError(
        403,
        check.requiredAction ? 'FORBIDDEN' : 'INVALID_TRANSITION',
        check.reason ?? 'Editorial workflow transition is not permitted.'
      );
    }
  }

  return staff;
}
