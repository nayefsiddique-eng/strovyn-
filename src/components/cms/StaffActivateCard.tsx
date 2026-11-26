'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, KeyRound, ShieldCheck } from 'lucide-react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

type ActivationErrorKind = 'expired' | 'used_or_invalid' | null;

// Deduplicate token exchanges across React Strict Mode double-mounts
const inFlightUrlExchanges = new Map<string, Promise<void>>();

function classifyAuthUrlError(rawCode: string, rawDesc: string): {
  kind: ActivationErrorKind;
  message: string;
} {
  const combined = `${rawCode} ${rawDesc}`.toLowerCase();
  if (combined.includes('expired') || combined.includes('otp_expired')) {
    return {
      kind: 'expired',
      message:
        'This invitation or recovery link has expired. Ask a Strovyn administrator to resend your invitation or request a new password reset.',
    };
  }
  return {
    kind: 'used_or_invalid',
    message:
      'This invitation or recovery link is invalid or has already been used. If you already activated your account, sign in at /admin.',
  };
}

export function StaffActivateCard() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ActivationErrorKind>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (
        session?.user?.email &&
        (event === 'SIGNED_IN' ||
          event === 'PASSWORD_RECOVERY' ||
          event === 'INITIAL_SESSION' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED')
      ) {
        setUserEmail(session.user.email);
        setErrorMessage(null);
        setErrorKind(null);
        setCheckingSession(false);
      }
    });

    async function inspectInviteSession() {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

        const urlErrorCode =
          hashParams.get('error_code') ||
          url.searchParams.get('error_code') ||
          hashParams.get('error') ||
          url.searchParams.get('error') ||
          '';
        const urlErrorDesc =
          hashParams.get('error_description') ||
          url.searchParams.get('error_description') ||
          '';

        if (urlErrorCode || urlErrorDesc) {
          if (active) {
            const classified = classifyAuthUrlError(urlErrorCode, urlErrorDesc);
            setErrorKind(classified.kind);
            setErrorMessage(classified.message);
            setCheckingSession(false);
          }
          return;
        }

        const code = url.searchParams.get('code');
        const tokenHash = url.searchParams.get('token_hash');
        const otpType = (url.searchParams.get('type') || hashParams.get('type') || 'invite') as EmailOtpType;
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        const exchangeKey = code
          ? `code:${code}`
          : tokenHash
            ? `otp:${tokenHash}:${otpType}`
            : accessToken && refreshToken
              ? `hash:${accessToken.slice(0, 24)}`
              : '';

        if (exchangeKey) {
          let pending = inFlightUrlExchanges.get(exchangeKey);
          if (!pending) {
            pending = (async () => {
              // Wait briefly in case createBrowserClient auto-detection already populated the session
              const pre = await supabase.auth.getSession();
              if (pre.data.session?.user) {
                return;
              }
              if (code) {
                await supabase.auth.exchangeCodeForSession(code).catch(() => {});
              } else if (tokenHash) {
                await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType }).catch(() => {});
              } else if (accessToken && refreshToken) {
                await supabase.auth
                  .setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                  })
                  .catch(() => {});
              }
            })();
            inFlightUrlExchanges.set(exchangeKey, pending);
          }

          await pending;
        }

        // Check both getUser() and getSession() so cookie propagation never causes a false negative
        let resolvedEmail: string | null = null;
        const userRes = await supabase.auth.getUser().catch(() => null);
        resolvedEmail = userRes?.data?.user?.email ?? null;

        if (!resolvedEmail) {
          const sessRes = await supabase.auth.getSession().catch(() => null);
          resolvedEmail = sessRes?.data?.session?.user?.email ?? null;
        }

        // Scrub sensitive URL tokens only after session initialization completes
        if (resolvedEmail && (code || tokenHash || accessToken)) {
          try {
            window.history.replaceState(null, '', '/admin/activate');
          } catch {
            // Non-fatal in restricted browser contexts
          }
        }

        if (active) {
          if (resolvedEmail) {
            setUserEmail(resolvedEmail);
            setErrorMessage(null);
            setErrorKind(null);
          } else if (exchangeKey) {
            setErrorKind('used_or_invalid');
            setErrorMessage(
              'This invitation or recovery link is invalid, expired, or has already been used.'
            );
          }
          setCheckingSession(false);
        }
      } catch {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    inspectInviteSession();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setErrorMessage(null);
    setStatusMessage(null);

    if (password.length < 12) {
      setErrorMessage('Choose a strong password of at least 12 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Password confirmation does not match.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) {
        setErrorMessage(pwErr.message || 'Unable to set password for this invitation.');
        return;
      }

      const res = await fetch('/api/admin/staff/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = (await res.json().catch(() => null)) as
        | { success: true; staff: { role: string } }
        | { success: false; error?: string }
        | null;

      if (!res.ok || !json || !json.success) {
        await supabase.auth.signOut().catch(() => {});
        setErrorMessage(
          (json && !json.success && json.error) ||
            'Account activation was denied. Contact your Strovyn administrator.'
        );
        return;
      }

      setPassword('');
      setConfirmPassword('');
      setStatusMessage(
        `Activation complete (${json.staff.role}). Redirecting to Strovyn Business CMS...`
      );
      router.push('/admin');
      router.refresh();
    } catch {
      setErrorMessage('Unable to complete account activation right now.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal pt-28 pb-24 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-md bg-white border border-warm-grey/60 p-8 sm:p-10 shadow-sm">
        <div className="border-b border-warm-grey/40 pb-6 mb-6">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-bronze dark:text-[#C9B28F] mb-3">
            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Strovyn Staff Onboarding</span>
          </div>
          <h1 className="type-section-title text-3xl text-charcoal dark:text-[#F4F1EA]">
            Activate Your Account
          </h1>
          <p className="font-sans text-sm text-charcoal/85 dark:text-[#D5D1C8] mt-2 leading-relaxed">
            Set your personal administrator or editorial password from your single-use Strovyn
            invitation link.
          </p>
        </div>

        {checkingSession ? (
          <p className="font-mono text-xs uppercase tracking-widest text-charcoal/80 dark:text-[#D5D1C8] py-6">
            Verifying invitation session...
          </p>
        ) : !userEmail ? (
          <div className="space-y-5">
            {errorMessage && (
              <div
                role="alert"
                data-error-kind={errorKind || undefined}
                className="border border-brand-red/40 dark:border-[#C41E1E]/60 bg-brand-red/5 dark:bg-[#2A1818] px-3.5 py-2.5 text-xs font-sans text-brand-red-dark dark:text-[#FCA5A5] flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}
            <div className="border border-warm-grey/60 dark:border-white/20 bg-ivory-light dark:bg-[#1E1F1D] p-4 text-xs font-sans text-charcoal dark:text-[#F4F1EA] leading-relaxed">
              No active invitation session was detected. Open the single-use invitation link
              sent to your email inbox by a Strovyn administrator, or return to Staff Sign In if
              you have already activated your account.
            </div>
            <Link
              href="/admin"
              className="block w-full text-center py-3 px-5 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-[0.2em]"
            >
              Return to Staff Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleActivate} className="space-y-5" noValidate>
            <div className="border border-warm-grey/60 dark:border-white/20 bg-ivory-light dark:bg-[#1E1F1D] px-3.5 py-2.5 flex items-center gap-2 text-xs font-sans text-charcoal dark:text-[#F4F1EA]">
              <ShieldCheck className="w-4 h-4 text-bronze dark:text-[#C9B28F] shrink-0" aria-hidden="true" />
              <span className="truncate">
                Verified invitation for <strong className="font-semibold text-charcoal dark:text-white">{userEmail}</strong>
              </span>
            </div>

            <div>
              <label
                htmlFor="activate-password"
                className="block font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal dark:text-[#E8E4DC] mb-2"
              >
                Create Strong Password (Min 12 chars)
              </label>
              <input
                id="activate-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 12 characters"
                className="w-full bg-ivory-light dark:bg-[#1E1F1D] border border-warm-grey dark:border-white/25 px-3.5 py-2.5 text-sm font-sans text-charcoal dark:text-[#F4F1EA] placeholder:text-charcoal/55 dark:placeholder:text-[#A8A59E] focus-visible:outline-2 focus-visible:outline-bronze"
              />
            </div>

            <div>
              <label
                htmlFor="activate-confirm"
                className="block font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal dark:text-[#E8E4DC] mb-2"
              >
                Confirm Password
              </label>
              <input
                id="activate-confirm"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full bg-ivory-light dark:bg-[#1E1F1D] border border-warm-grey dark:border-white/25 px-3.5 py-2.5 text-sm font-sans text-charcoal dark:text-[#F4F1EA] placeholder:text-charcoal/55 dark:placeholder:text-[#A8A59E] focus-visible:outline-2 focus-visible:outline-bronze"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                data-error-kind={errorKind || undefined}
                className="border border-brand-red/40 dark:border-[#C41E1E]/60 bg-brand-red/5 dark:bg-[#2A1818] px-3.5 py-2.5 text-xs font-sans text-brand-red-dark dark:text-[#FCA5A5] flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}
            {statusMessage && (
              <div
                role="status"
                className="border border-bronze/50 dark:border-[#C9B28F]/50 bg-ivory-light dark:bg-[#1E1F1D] px-3.5 py-2.5 text-xs font-sans text-charcoal dark:text-[#F4F1EA] flex items-start gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-bronze dark:text-[#C9B28F] shrink-0 mt-0.5" aria-hidden="true" />
                <span>{statusMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-5 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-[0.2em] cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Activating Account...' : 'Complete Activation & Enter CMS'}
            </button>
          </form>
        )}

        <div className="mt-7 pt-5 border-t border-warm-grey/40 flex items-center justify-between text-xs">
          <Link
            href="/admin"
            className="font-mono text-[11px] uppercase tracking-wider text-charcoal/80 hover:text-bronze underline underline-offset-4"
          >
            Staff Sign In
          </Link>
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-wider text-charcoal/80 hover:text-bronze underline underline-offset-4"
          >
            Public Site
          </Link>
        </div>
      </div>
    </main>
  );
}
