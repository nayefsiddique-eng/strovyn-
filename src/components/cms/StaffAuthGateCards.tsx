'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, LogOut, ShieldAlert, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { sanitizeAdminRedirectPath } from '@/lib/cms/stage1Access';
import type { EditorialRole } from '@/lib/cms/roles';

export interface StaffViewerIdentity {
  id: string;
  email: string;
  full_name: string;
  role: EditorialRole;
}

export interface AccessDeniedState {
  code: string;
  status: number;
  message: string;
}

export function StaffSignInCard({
  redirectTo = '/admin/insights',
  reason = 'unauthenticated',
  onAuthorized,
  onAccessDenied,
}: {
  redirectTo?: string;
  reason?: 'unauthenticated' | 'expired';
  onAuthorized?: (staff: StaffViewerIdentity) => void;
  onAccessDenied?: (denied: AccessDeniedState) => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const safeRedirect = sanitizeAdminRedirectPath(redirectTo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Enter your registered editorial email address and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error || !data?.user) {
        setErrorMessage('Invalid credentials or inactive session. Verify your details and retry.');
        return;
      }

      const sessionRes = await fetch('/api/admin/insights/session', {
        method: 'GET',
        cache: 'no-store',
      });
      const sessionJson = (await sessionRes.json().catch(() => null)) as
        | { success: true; staff: StaffViewerIdentity }
        | { success: false; code?: string; error?: string }
        | null;

      if (sessionRes.ok && sessionJson && sessionJson.success) {
        setPassword('');
        if (onAuthorized) {
          onAuthorized(sessionJson.staff);
        }
        if (safeRedirect !== window.location.pathname + window.location.search) {
          router.push(safeRedirect);
        } else {
          router.refresh();
        }
        return;
      }

      if (sessionRes.status === 403 || sessionRes.status === 503) {
        const deniedPayload: AccessDeniedState = {
          code:
            (sessionJson && !sessionJson.success && sessionJson.code) ||
            (sessionRes.status === 503 ? 'CMS_NOT_CONFIGURED' : 'FORBIDDEN'),
          status: sessionRes.status,
          message:
            (sessionJson && !sessionJson.success && sessionJson.error) ||
            'Editorial staff authorization is unavailable for this account.',
        };
        if (onAccessDenied) {
          onAccessDenied(deniedPayload);
        }
        router.refresh();
        return;
      }

      setErrorMessage(
        (sessionJson && !sessionJson.success && sessionJson.error) ||
          'Authentication session could not be established.'
      );
    } catch {
      setErrorMessage('Unable to reach authentication service. Try again shortly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal pt-28 pb-24 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-md bg-white border border-warm-grey/60 p-8 sm:p-10 shadow-sm">
        <div className="border-b border-warm-grey/40 pb-6 mb-6">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-bronze mb-3">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Strovyn Editorial Desk</span>
          </div>
          <h1 className="type-section-title text-3xl text-charcoal">Staff Sign In</h1>
          <p className="font-sans text-sm text-charcoal/75 mt-2 leading-relaxed">
            Restricted workspace for invited Strovyn editors, publishers, and administrators.
          </p>
        </div>

        {reason === 'expired' && (
          <div
            role="status"
            aria-live="polite"
            className="mb-5 border border-bronze/50 bg-ivory-light px-4 py-3 text-xs font-sans text-charcoal flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 text-bronze flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>Your editorial session expired. Sign in again to resume viewing the queue.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label
              htmlFor="cms-staff-email"
              className="block font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/85 mb-2"
            >
              Staff Email
            </label>
            <input
              id="cms-staff-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@strovynpainting.com"
              className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2.5 text-sm font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-bronze focus:border-charcoal"
            />
          </div>

          <div>
            <label
              htmlFor="cms-staff-password"
              className="block font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/85 mb-2"
            >
              Password
            </label>
            <input
              id="cms-staff-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter staff password"
              className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2.5 text-sm font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-bronze focus:border-charcoal"
            />
          </div>

          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="border border-brand-red/30 bg-brand-red/5 px-3.5 py-2.5 text-xs font-sans text-brand-red-dark"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-5 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-[0.2em] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze"
          >
            {isSubmitting ? 'Verifying Credentials...' : 'Enter Editorial Desk'}
          </button>
        </form>

        <div className="mt-7 pt-5 border-t border-warm-grey/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-sans text-warm-grey-dark">
            Invite-only access · No public registration
          </span>
          <Link
            href="/insights"
            className="font-mono text-[11px] uppercase tracking-wider text-charcoal/80 hover:text-bronze underline underline-offset-4"
          >
            Public Journal
          </Link>
        </div>
      </div>
    </main>
  );
}

export function StaffAccessDeniedCard({
  code,
  status,
  message,
  onSignedOut,
}: {
  code: string;
  status: number;
  message: string;
  onSignedOut?: () => void;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const isServiceError = status === 503 || code === 'CMS_NOT_CONFIGURED' || code === 'AUTH_SERVICE_UNAVAILABLE';
  const isInactive = code === 'STAFF_INACTIVE';
  const isUnregistered = code === 'STAFF_NOT_REGISTERED';

  const heading = isServiceError
    ? 'Editorial Service Unavailable'
    : isInactive
      ? 'Staff Account Deactivated'
      : isUnregistered
        ? 'No Editorial Staff Access'
        : 'Editorial Access Denied';

  const detail = isServiceError
    ? message
    : isInactive
      ? 'Your staff account has been deactivated in Strovyn editorial governance. Contact an administrator to restore access.'
      : isUnregistered
        ? 'You are signed in to an authentication account that is not enrolled in staff_users. Authentication alone does not grant editorial workspace privileges.'
        : message;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut().catch(() => {});
      await fetch('/api/admin/insights/session', { method: 'DELETE' }).catch(() => {});
      if (onSignedOut) {
        onSignedOut();
      }
      router.replace('/admin/insights');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal pt-28 pb-24 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white border border-warm-grey/60 p-8 sm:p-10 shadow-sm">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-brand-red-dark mb-3">
          <ShieldAlert className="w-4 h-4" aria-hidden="true" />
          <span>{code || `HTTP ${status}`}</span>
        </div>
        <h1 className="type-section-title text-3xl text-charcoal mb-3">{heading}</h1>
        <p className="font-sans text-sm text-charcoal/80 leading-relaxed mb-7">{detail}</p>

        <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-warm-grey/40">
          {!isServiceError && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-[0.16em] cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{signingOut ? 'Signing Out...' : 'Sign Out & Switch Account'}</span>
            </button>
          )}
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2.5 border border-warm-grey text-charcoal hover:border-charcoal font-mono text-xs uppercase tracking-[0.16em] transition-colors"
          >
            Return to Site
          </Link>
        </div>
      </div>
    </main>
  );
}
