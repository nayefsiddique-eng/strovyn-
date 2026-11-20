import 'server-only';
import {
  resolveAuthenticatedStaff,
  StaffAuthError,
} from './staffAuth';
import type { StaffProfile } from './roles';

export type AdminGateResolution =
  | { status: 'authenticated'; staff: StaffProfile }
  | { status: 'unauthenticated' }
  | { status: 'denied'; code: string; httpStatus: number; message: string };

/**
 * Resolves the signed-in staff member for Admin Server Components without
 * throwing on expected 401/403 states so pages render consistent sign-in or
 * access-denied UI gates.
 */
export async function resolveAdminPageGate(): Promise<AdminGateResolution> {
  try {
    const staff = await resolveAuthenticatedStaff();
    return { status: 'authenticated', staff };
  } catch (err) {
    if (err instanceof StaffAuthError) {
      if (err.code === 'UNAUTHENTICATED') {
        return { status: 'unauthenticated' };
      }
      return {
        status: 'denied',
        code: err.code,
        httpStatus: err.status,
        message: err.message,
      };
    }
    return {
      status: 'denied',
      code: 'AUTH_SERVICE_UNAVAILABLE',
      httpStatus: 503,
      message: 'Unable to verify staff authentication session.',
    };
  }
}
