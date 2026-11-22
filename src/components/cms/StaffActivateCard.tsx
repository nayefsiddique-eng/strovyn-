'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function StaffActivateCard() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function inspectInviteSession() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const hashError = hashParams.get('error_description') || url.searchParams.get('error_description');

        if (hashError) {
          if (active) {
            setErrorMessage(
              'This invitation link is invalid or has expired. Ask an administrator to resend your invitation.'
            );
            setCheckingSession(false);
          }
          return;
        }

        if (code) {
          await supabase.auth.exchangeCodeForSession(code).catch(() => {});
        } else if (hashParams.get('access_token') && hashParams.get('refresh_token')) {
          await supabase.auth
            .setSession({
              access_token: hashParams.get('access_token')!,
              refresh_token: hashParams.get('refresh_token')!,
            })
            .catch(() => {});
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (active) {
          setUserEmail(user?.email ?? null);
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
    };
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
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
        `Account activated (${json.staff.role}). Redirecting to Strovyn Business CMS...`
      );
      router.push('/admin');
      router.refresh();
    } catch {
      setErrorMessage('Unable to complete account activation right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal pt-28 pb-24 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-md bg-white border border-warm-grey/60 p-8 sm:p-10 shadow-sm">
        <div className="border-b border-warm-grey/40 pb-6 mb-6">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-bronze mb-3">
            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Strovyn Staff Onboarding</span>
          </div>
          <h1 className="type-section-title text-3xl text-charcoal">
            Activate Your Account
          </h1>
          <p className="font-sans text-sm text-charcoal/75 mt-2 leading-relaxed">
            Set your personal administrator or editorial password from your single-use Strovyn
            invitation link.
          </p>
        </div>

        {checkingSession ? (
          <p className="font-mono text-xs uppercase tracking-widest text-warm-grey-dark py-6">
            Verifying invitation session...
          </p>
        ) : !userEmail ? (
          <div className="space-y-5">
            {errorMessage && (
              <div
                role="alert"
                className="border border-brand-red/30 bg-brand-red/5 px-3.5 py-2.5 text-xs font-sans text-brand-red-dark"
              >
                {errorMessage}
              </div>
            )}
            <div className="border border-warm-grey/50 bg-ivory-light p-4 text-xs font-sans text-charcoal/85 leading-relaxed">
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
            <div className="border border-warm-grey/50 bg-ivory-light px-3.5 py-2.5 flex items-center gap-2 text-xs font-sans text-charcoal">
              <ShieldCheck className="w-4 h-4 text-bronze shrink-0" aria-hidden="true" />
              <span className="truncate">
                Verified invitation for <strong>{userEmail}</strong>
              </span>
            </div>

            <div>
              <label
                htmlFor="activate-password"
                className="block font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/85 mb-2"
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
                className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2.5 text-sm font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
              />
            </div>

            <div>
              <label
                htmlFor="activate-confirm"
                className="block font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/85 mb-2"
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
                className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2.5 text-sm font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="border border-brand-red/30 bg-brand-red/5 px-3.5 py-2.5 text-xs font-sans text-brand-red-dark"
              >
                {errorMessage}
              </div>
            )}
            {statusMessage && (
              <div
                role="status"
                className="border border-bronze/50 bg-ivory-light px-3.5 py-2.5 text-xs font-sans text-charcoal"
              >
                {statusMessage}
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
