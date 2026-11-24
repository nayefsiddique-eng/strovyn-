'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, LogOut, ShieldAlert, AlertTriangle, Eye, EyeOff } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const safeRedirect = sanitizeAdminRedirectPath(redirectTo);

  useEffect(() => {
    try {
      const remembered = window.sessionStorage.getItem('strovyn-staff-email');
      if (remembered) setEmail(remembered);
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    try {
      if (value.trim()) {
        window.sessionStorage.setItem('strovyn-staff-email', value.trim());
      } else {
        window.sessionStorage.removeItem('strovyn-staff-email');
      }
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setErrorMessage(null);
        setStatusMessage('Enter a strong new administrator password (at least 12 characters).');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSendPasswordReset = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Enter your registered staff email address first.');
      return;
    }
    setIsSendingReset(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/admin/activate`,
      });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        setErrorMessage(
          msg.includes('rate') || msg.includes('limit') || error.status === 429
            ? 'Too many attempts; retry later.'
            : 'Recovery email unavailable. Try again shortly or contact an administrator.'
        );
        return;
      }
      setStatusMessage(
        `If ${trimmedEmail} is an active or invited staff account, a recovery link has been sent.`
      );
    } catch {
      setErrorMessage('Unable to reach authentication service. Try again shortly.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 12) {
      setErrorMessage('Administrator password must be at least 12 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Password confirmation does not match.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setErrorMessage(error.message || 'Could not update administrator password.');
        return;
      }
      setNewPassword('');
      setConfirmPassword('');
      setIsRecoveryMode(false);
      setStatusMessage('Password updated. Entering Strovyn Editorial Desk...');
      router.push(safeRedirect);
      router.refresh();
    } catch {
      setErrorMessage('Unable to update password right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        const msg = (error?.message || '').toLowerCase();
        setErrorMessage(
          msg.includes('rate') || msg.includes('limit') || error?.status === 429
            ? 'Too many attempts; retry later.'
            : 'Incorrect email or password.'
        );
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

        {statusMessage && (
          <div
            role="status"
            aria-live="polite"
            className="mb-5 border border-bronze/50 bg-ivory-light px-4 py-3 text-xs font-sans text-charcoal"
          >
            {statusMessage}
          </div>
        )}

        {isRecoveryMode ? (
          <form onSubmit={handleRecoverySubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="cms-staff-new-password"
                className="block font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/85 mb-2"
              >
                New Strong Password (Min 12 chars)
              </label>
              <input
                id="cms-staff-new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter strong password"
                className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2.5 text-sm font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-bronze focus:border-charcoal"
              />
            </div>
            <div>
              <label
                htmlFor="cms-staff-confirm-password"
                className="block font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/85 mb-2"
              >
                Confirm New Password
              </label>
              <input
                id="cms-staff-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm strong password"
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
              {isSubmitting ? 'Saving Password...' : 'Set Administrator Password'}
            </button>
          </form>
        ) : (
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
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="name@strovyn.com"
              className="w-full bg-ivory-light dark:bg-[#1E1F1D] border border-warm-grey dark:border-white/25 px-3.5 py-2.5 text-sm font-sans text-charcoal dark:text-[#F4F1EA] placeholder:text-charcoal/50 dark:placeholder:text-[#A8A59E] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-bronze focus:border-charcoal"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label
                htmlFor="cms-staff-password"
                className="block font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/85 dark:text-[#E8E4DC]"
              >
                Password
              </label>
              <button
                type="button"
                onClick={handleSendPasswordReset}
                disabled={isSendingReset}
                className="font-mono text-[10px] uppercase tracking-wider text-bronze dark:text-[#C9B28F] hover:underline cursor-pointer disabled:opacity-50"
              >
                {isSendingReset ? 'Sending...' : 'Forgot Password'}
              </button>
            </div>
            <div className="relative">
              <input
                id="cms-staff-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter staff password"
                className="w-full bg-ivory-light dark:bg-[#1E1F1D] border border-warm-grey dark:border-white/25 pl-3.5 pr-11 py-2.5 text-sm font-sans text-charcoal dark:text-[#F4F1EA] placeholder:text-charcoal/50 dark:placeholder:text-[#A8A59E] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-bronze focus:border-charcoal"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 px-3 flex items-center justify-center text-charcoal/70 dark:text-[#C9B28F] hover:text-charcoal dark:hover:text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-bronze"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="border border-brand-red/40 dark:border-[#C41E1E]/60 bg-brand-red/5 dark:bg-[#2A1818] px-3.5 py-2.5 text-xs font-sans text-brand-red-dark dark:text-[#FCA5A5]"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-5 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-[0.2em] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze"
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        )}

        <div className="mt-7 pt-5 border-t border-warm-grey/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <Link
            href="/admin/activate"
            className="font-mono text-[11px] uppercase tracking-wider text-bronze dark:text-[#C9B28F] hover:underline underline-offset-4"
          >
            Activate Invitation
          </Link>
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
