import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServiceRoleClient,
  isCmsSupabaseConfigured,
} from '@/lib/supabase/serviceRole';
import { EditorialHttpError } from './http';
import { StaffAuthError } from './staffAuth';
import { hasEditorialPermission } from './rbac';
import {
  isEditorialRole,
  type EditorialRole,
  type StaffProfile,
} from './roles';

export type StaffInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface StaffInvitationRecord {
  id: string;
  email: string;
  full_name: string;
  role: EditorialRole;
  auth_user_id: string | null;
  staff_user_id: string | null;
  status: StaffInvitationStatus;
  invited_by: string | null;
  invited_at: string;
  last_sent_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
}

export interface StaffAuditLogRecord {
  id: string;
  actor_staff_id: string | null;
  target_staff_id: string | null;
  target_invitation_id: string | null;
  target_email: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  actor_name?: string | null;
}

export interface StaffDirectoryEntry extends StaffProfile {
  auth_last_sign_in_at: string | null;
}

export interface StaffDirectorySnapshot {
  staff: StaffDirectoryEntry[];
  invitations: StaffInvitationRecord[];
  auditLog: StaffAuditLogRecord[];
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function assertAdmin(actor: StaffProfile) {
  if (!hasEditorialPermission(actor.role, 'staff:manage')) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      `Role "${actor.role}" is not permitted to manage staff or invitations.`
    );
  }
}

function getClient(override?: SupabaseClient): SupabaseClient {
  if (override) return override;
  if (!isCmsSupabaseConfigured()) {
    throw new StaffAuthError(503, 'CMS_NOT_CONFIGURED',
      'Staff management service is not configured.'
    );
  }
  return createServiceRoleClient();
}

async function appendStaffAudit(
  client: SupabaseClient,
  entry: {
    actorStaffId: string | null;
    targetStaffId?: string | null;
    targetInvitationId?: string | null;
    targetEmail: string;
    action:
      | 'invite_created'
      | 'invite_resent'
      | 'invite_revoked'
      | 'invite_accepted'
      | 'role_changed'
      | 'access_disabled'
      | 'access_reactivated'
      | 'password_updated';
    details?: Record<string, unknown>;
  }
) {
  await client.from('staff_audit_log').insert({
    actor_staff_id: entry.actorStaffId,
    target_staff_id: entry.targetStaffId ?? null,
    target_invitation_id: entry.targetInvitationId ?? null,
    target_email: entry.targetEmail,
    action: entry.action,
    details: entry.details ?? {},
  });
}

export async function listStaffDirectory(
  actor: StaffProfile,
  clientOverride?: SupabaseClient
): Promise<StaffDirectorySnapshot> {
  assertAdmin(actor);
  const client = getClient(clientOverride);

  const [staffRes, invRes, auditRes] = await Promise.all([
    client
      .from('staff_users')
      .select(
        'id, auth_user_id, email, full_name, role, is_active, last_login_at, created_at, updated_at'
      )
      .order('created_at', { ascending: true }),
    client
      .from('staff_invitations')
      .select(
        'id, email, full_name, role, auth_user_id, staff_user_id, status, invited_by, invited_at, last_sent_at, expires_at, accepted_at, revoked_at, revoked_by'
      )
      .order('invited_at', { ascending: false })
      .limit(100),
    client
      .from('staff_audit_log')
      .select(
        'id, actor_staff_id, target_staff_id, target_invitation_id, target_email, action, details, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (staffRes.error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', staffRes.error.message);
  }

  const staffRows = (staffRes.data || []) as StaffProfile[];
  const staffById = new Map(staffRows.map((s) => [s.id, s]));

  // Enrich with Supabase Auth last_sign_in_at when available
  const authSignInByUserId = new Map<string, string | null>();
  try {
    const { data: authUsers } = await client.auth.admin.listUsers({ perPage: 200 });
    for (const u of authUsers?.users || []) {
      authSignInByUserId.set(u.id, u.last_sign_in_at ?? null);
    }
  } catch {
    // Non-fatal in mock/unit environments
  }

  const nowMs = Date.now();
  const invitations = ((invRes.data || []) as StaffInvitationRecord[]).map((inv) => {
    if (inv.status === 'pending' && new Date(inv.expires_at).getTime() <= nowMs) {
      return { ...inv, status: 'expired' as const };
    }
    return inv;
  });

  const auditLog = ((auditRes.data || []) as StaffAuditLogRecord[]).map((row) => ({
    ...row,
    actor_name: row.actor_staff_id
      ? staffById.get(row.actor_staff_id)?.full_name ?? null
      : null,
  }));

  return {
    staff: staffRows.map((s) => ({
      ...s,
      auth_last_sign_in_at: authSignInByUserId.get(s.auth_user_id) ?? s.last_login_at,
    })),
    invitations,
    auditLog,
  };
}

export async function inviteEmployee(
  actor: StaffProfile,
  input: {
    fullName: string;
    email: string;
    role: EditorialRole;
    redirectOrigin: string;
  },
  deps?: {
    clientOverride?: SupabaseClient;
    sendInviteFn?: (email: string, fullName: string, redirectTo: string) => Promise<{ authUserId: string | null }>;
  }
): Promise<StaffInvitationRecord> {
  assertAdmin(actor);
  const client = getClient(deps?.clientOverride);

  const fullName = input.fullName.trim();
  const email = normalizeEmail(input.email);
  if (fullName.length < 2 || fullName.length > 120) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      'Employee full name must be between 2 and 120 characters.'
    );
  }
  if (!isValidEmailFormat(email)) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Provide a valid employee email address.');
  }
  if (!isEditorialRole(input.role)) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Role must be editor, publisher, or admin.');
  }

  // Check duplicate / previously registered staff
  const { data: existingStaff } = await client
    .from('staff_users')
    .select('id, is_active')
    .ilike('email', email)
    .maybeSingle();

  if (existingStaff) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      existingStaff.is_active
        ? 'An active staff member with this email already exists.'
        : 'This email belongs to a deactivated staff account. Reactivate them in the directory instead.'
    );
  }

  // Check pending invitation (expire stale ones cleanly first)
  const { data: pendingInv } = await client
    .from('staff_invitations')
    .select('id, expires_at')
    .ilike('email', email)
    .eq('status', 'pending')
    .maybeSingle();

  if (pendingInv) {
    if (new Date(pendingInv.expires_at).getTime() > Date.now()) {
      throw new EditorialHttpError(
        409,
        'CONFLICT',
        'A pending invitation already exists for this email. Use Resend or Revoke.'
      );
    }
    await client
      .from('staff_invitations')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', pendingInv.id);
  }

  const redirectTo = `${input.redirectOrigin.replace(/\/$/, '')}/admin/activate`;
  let invitedAuthUserId: string | null = null;

  if (deps?.sendInviteFn) {
    const res = await deps.sendInviteFn(email, fullName, redirectTo);
    invitedAuthUserId = res.authUserId;
  } else {
    const { data: authUsers } = await client.auth.admin.listUsers({ perPage: 200 });
    const existingAuthUser = authUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (existingAuthUser) {
      // Existing unlinked Auth user: send recovery/setup link bound to /admin/activate
      const { error: recErr } = await client.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (recErr) {
        throw new EditorialHttpError(502, 'INTERNAL_ERROR', recErr.message);
      }
      invitedAuthUserId = existingAuthUser.id;
    } else {
      const { data: invData, error: invErr } =
        await client.auth.admin.inviteUserByEmail(email, {
          data: { full_name: fullName },
          redirectTo,
        });
      if (invErr) {
        throw new EditorialHttpError(502, 'INTERNAL_ERROR', invErr.message);
      }
      invitedAuthUserId = invData.user?.id ?? null;
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: createdInv, error: insErr } = await client
    .from('staff_invitations')
    .insert({
      email,
      full_name: fullName,
      role: input.role,
      auth_user_id: invitedAuthUserId,
      status: 'pending',
      invited_by: actor.id,
      invited_at: now.toISOString(),
      last_sent_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (insErr || !createdInv) {
    throw new EditorialHttpError(
      500,
      'INTERNAL_ERROR',
      insErr?.message || 'Failed to save staff invitation.'
    );
  }

  await appendStaffAudit(client, {
    actorStaffId: actor.id,
    targetInvitationId: createdInv.id,
    targetEmail: email,
    action: 'invite_created',
    details: { role: input.role, full_name: fullName },
  });

  return createdInv as StaffInvitationRecord;
}

export async function resendStaffInvitation(
  actor: StaffProfile,
  invitationId: string,
  redirectOrigin: string,
  deps?: {
    clientOverride?: SupabaseClient;
    sendInviteFn?: (email: string, fullName: string, redirectTo: string) => Promise<void>;
  }
): Promise<StaffInvitationRecord> {
  assertAdmin(actor);
  const client = getClient(deps?.clientOverride);

  const { data: inv, error: fetchErr } = await client
    .from('staff_invitations')
    .select('*')
    .eq('id', invitationId)
    .maybeSingle();

  if (fetchErr || !inv) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Staff invitation not found.');
  }
  if (inv.status === 'accepted') {
    throw new EditorialHttpError(409, 'CONFLICT', 'Invitation has already been accepted.');
  }
  if (inv.status === 'revoked') {
    throw new EditorialHttpError(409, 'FORBIDDEN', 'Revoked invitations cannot be resent.');
  }

  const redirectTo = `${redirectOrigin.replace(/\/$/, '')}/admin/activate`;
  if (deps?.sendInviteFn) {
    await deps.sendInviteFn(inv.email, inv.full_name, redirectTo);
  } else {
    const { error: recErr } = await client.auth.resetPasswordForEmail(inv.email, {
      redirectTo,
    });
    if (recErr) {
      throw new EditorialHttpError(502, 'INTERNAL_ERROR', recErr.message);
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: updated, error: updErr } = await client
    .from('staff_invitations')
    .update({
      status: 'pending',
      last_sent_at: now.toISOString(),
      expires_at: expiresAt,
      updated_at: now.toISOString(),
    })
    .eq('id', invitationId)
    .select('*')
    .single();

  if (updErr || !updated) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', updErr?.message || 'Failed to update invitation.');
  }

  await appendStaffAudit(client, {
    actorStaffId: actor.id,
    targetInvitationId: invitationId,
    targetEmail: inv.email,
    action: 'invite_resent',
    details: { role: inv.role },
  });

  return updated as StaffInvitationRecord;
}

export async function revokeStaffInvitation(
  actor: StaffProfile,
  invitationId: string,
  clientOverride?: SupabaseClient
): Promise<StaffInvitationRecord> {
  assertAdmin(actor);
  const client = getClient(clientOverride);

  const { data: inv, error: fetchErr } = await client
    .from('staff_invitations')
    .select('*')
    .eq('id', invitationId)
    .maybeSingle();

  if (fetchErr || !inv) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Staff invitation not found.');
  }
  if (inv.status === 'accepted') {
    throw new EditorialHttpError(409, 'CONFLICT', 'Accepted invitations cannot be revoked.');
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updErr } = await client
    .from('staff_invitations')
    .update({
      status: 'revoked',
      revoked_at: nowIso,
      revoked_by: actor.id,
      updated_at: nowIso,
    })
    .eq('id', invitationId)
    .select('*')
    .single();

  if (updErr || !updated) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', updErr?.message || 'Failed to revoke invitation.');
  }

  await appendStaffAudit(client, {
    actorStaffId: actor.id,
    targetInvitationId: invitationId,
    targetEmail: inv.email,
    action: 'invite_revoked',
    details: { role: inv.role },
  });

  return updated as StaffInvitationRecord;
}

export async function updateStaffMember(
  actor: StaffProfile,
  targetStaffId: string,
  patch: { role?: EditorialRole; isActive?: boolean },
  clientOverride?: SupabaseClient
): Promise<StaffProfile> {
  assertAdmin(actor);
  const client = getClient(clientOverride);

  const { data: target, error: targetErr } = await client
    .from('staff_users')
    .select('*')
    .eq('id', targetStaffId)
    .maybeSingle();

  if (targetErr || !target) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Staff member not found.');
  }

  const nextRole = patch.role ?? (target.role as EditorialRole);
  const nextActive = typeof patch.isActive === 'boolean' ? patch.isActive : Boolean(target.is_active);

  if (!isEditorialRole(nextRole)) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid staff role specified.');
  }

  // Protect the last active administrator from role downgrade or deactivation
  const wasActiveAdmin = target.is_active && target.role === 'admin';
  const remainsActiveAdmin = nextActive && nextRole === 'admin';
  if (wasActiveAdmin && !remainsActiveAdmin) {
    const { data: activeAdmins, error: countErr } = await client
      .from('staff_users')
      .select('id')
      .eq('role', 'admin')
      .eq('is_active', true);
    if (countErr) {
      throw new EditorialHttpError(500, 'INTERNAL_ERROR', countErr.message);
    }
    if ((activeAdmins || []).length <= 1) {
      throw new EditorialHttpError(
        409,
        'CONFLICT',
        'Cannot remove or deactivate the last active administrator.'
      );
    }
  }

  const { data: updated, error: updErr } = await client
    .from('staff_users')
    .update({
      role: nextRole,
      is_active: nextActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetStaffId)
    .select('*')
    .single();

  if (updErr || !updated) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', updErr?.message || 'Failed to update staff member.');
  }

  if (nextRole !== target.role) {
    await appendStaffAudit(client, {
      actorStaffId: actor.id,
      targetStaffId,
      targetEmail: target.email,
      action: 'role_changed',
      details: { from: target.role, to: nextRole },
    });
  }
  if (nextActive !== target.is_active) {
    await appendStaffAudit(client, {
      actorStaffId: actor.id,
      targetStaffId,
      targetEmail: target.email,
      action: nextActive ? 'access_reactivated' : 'access_disabled',
      details: {},
    });
  }

  return updated as StaffProfile;
}

export async function completeEmployeeActivation(
  authUser: { id: string; email?: string | null },
  clientOverride?: SupabaseClient
): Promise<StaffProfile> {
  const client = getClient(clientOverride);
  const email = authUser.email ? normalizeEmail(authUser.email) : '';
  if (!email) {
    throw new StaffAuthError(401, 'UNAUTHENTICATED', 'Authenticated user email is required.');
  }

  // If already an active staff member, return existing record cleanly
  const { data: existingStaff } = await client
    .from('staff_users')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (existingStaff) {
    if (!existingStaff.is_active) {
      throw new StaffAuthError(403, 'STAFF_INACTIVE',
        'Your staff account has been deactivated by an administrator.'
      );
    }
    return existingStaff as StaffProfile;
  }

  // Otherwise require a valid pending, non-expired, non-revoked invitation
  const { data: inv, error: invErr } = await client
    .from('staff_invitations')
    .select('*')
    .ilike('email', email)
    .order('invited_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (invErr || !inv) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      'No valid staff invitation was found for this email address.'
    );
  }
  if (inv.status === 'revoked') {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      'This invitation has been revoked by an administrator.'
    );
  }
  if (inv.status === 'accepted') {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'This invitation has already been used. Sign in at /admin.'
    );
  }
  if (inv.status === 'expired' || new Date(inv.expires_at).getTime() <= Date.now()) {
    await client
      .from('staff_invitations')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', inv.id);
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      'This invitation has expired. Request a new invitation from an administrator.'
    );
  }

  const nowIso = new Date().toISOString();
  const { data: createdStaff, error: staffErr } = await client
    .from('staff_users')
    .insert({
      auth_user_id: authUser.id,
      email,
      full_name: inv.full_name,
      role: inv.role, // Server-stored invitation role only!
      is_active: true,
      invited_by: inv.invited_by,
      last_login_at: nowIso,
    })
    .select('*')
    .single();

  if (staffErr || !createdStaff) {
    throw new EditorialHttpError(
      500,
      'INTERNAL_ERROR',
      staffErr?.message || 'Unable to activate staff record.'
    );
  }

  await client
    .from('staff_invitations')
    .update({
      status: 'accepted',
      auth_user_id: authUser.id,
      staff_user_id: createdStaff.id,
      accepted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', inv.id);

  await appendStaffAudit(client, {
    actorStaffId: createdStaff.id,
    targetStaffId: createdStaff.id,
    targetInvitationId: inv.id,
    targetEmail: email,
    action: 'invite_accepted',
    details: { role: inv.role },
  });

  return createdStaff as StaffProfile;
}

export async function recordPasswordUpdatedAudit(
  staff: StaffProfile,
  clientOverride?: SupabaseClient
): Promise<void> {
  const client = getClient(clientOverride);
  await appendStaffAudit(client, {
    actorStaffId: staff.id,
    targetStaffId: staff.id,
    targetEmail: staff.email,
    action: 'password_updated',
    details: {},
  });
}
