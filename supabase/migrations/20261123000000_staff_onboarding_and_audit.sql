-- Migration 017: Secure Employee Onboarding, Staff Invitations & Staff Audit Log
-- Forward-only migration. Preserves existing migrations 001-016 and existing staff_users records.

CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('editor', 'publisher', 'admin')),
  auth_user_id UUID,
  staff_user_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_pending_email_uidx
  ON public.staff_invitations (lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS staff_invitations_status_idx
  ON public.staff_invitations (status, invited_at DESC);

CREATE TABLE IF NOT EXISTS public.staff_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_staff_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  target_staff_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  target_invitation_id UUID REFERENCES public.staff_invitations(id) ON DELETE SET NULL,
  target_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (
    action IN (
      'invite_created',
      'invite_resent',
      'invite_revoked',
      'invite_accepted',
      'role_changed',
      'access_disabled',
      'access_reactivated',
      'password_updated'
    )
  ),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS staff_audit_log_created_idx
  ON public.staff_audit_log (created_at DESC);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_log ENABLE ROW LEVEL SECURITY;

-- Strict fail-closed privileges: only server-side service_role may access invitations or staff audit logs.
REVOKE ALL ON public.staff_invitations FROM anon, authenticated;
REVOKE ALL ON public.staff_audit_log FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.staff_invitations TO service_role;
-- Append-only audit log: no UPDATE or DELETE granted even to service_role.
GRANT SELECT, INSERT ON public.staff_audit_log TO service_role;
