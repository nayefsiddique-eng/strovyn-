'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MailPlus, RefreshCw, ShieldCheck, UserCheck, UserX, XCircle } from 'lucide-react';
import type { EditorialRole } from '@/lib/cms/roles';
import type { StaffDirectorySnapshot } from '@/lib/cms/staffManagementService';

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Australia/Adelaide',
  });
}

export function AdminStaffWorkspace({
  initialSnapshot,
  currentAdminId,
}: {
  initialSnapshot: StaffDirectorySnapshot;
  currentAdminId: string;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<StaffDirectorySnapshot>(initialSnapshot);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<EditorialRole>('editor');
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reloadDirectory = async () => {
    const res = await fetch('/api/admin/staff', { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) {
      setSnapshot({
        staff: json.staff,
        invitations: json.invitations,
        auditLog: json.auditLog,
      });
    }
    router.refresh();
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setNotice(null);
    setSubmittingInvite(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, role }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setErrorMessage(json?.error || 'Unable to send employee invitation.');
        return;
      }
      setFullName('');
      setEmail('');
      setRole('editor');
      setNotice(`Invitation sent to ${json.invitation.email} (${json.invitation.role}).`);
      await reloadDirectory();
    } catch {
      setErrorMessage('Network error while sending invitation.');
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleStaffPatch = async (
    staffId: string,
    patch: { role?: EditorialRole; isActive?: boolean }
  ) => {
    setErrorMessage(null);
    setNotice(null);
    setBusyKey(`staff:${staffId}`);
    try {
      const res = await fetch(`/api/admin/staff/${encodeURIComponent(staffId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setErrorMessage(json?.error || 'Unable to update staff permissions.');
        return;
      }
      setNotice('Staff permissions updated.');
      await reloadDirectory();
    } catch {
      setErrorMessage('Unable to update staff record right now.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleInviteAction = async (invId: string, action: 'resend' | 'revoke') => {
    setErrorMessage(null);
    setNotice(null);
    setBusyKey(`inv:${invId}:${action}`);
    try {
      const res = await fetch(
        `/api/admin/staff/invitations/${encodeURIComponent(invId)}/${action}`,
        { method: 'POST' }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setErrorMessage(json?.error || `Unable to ${action} invitation.`);
        return;
      }
      setNotice(
        action === 'resend'
          ? `Invitation resent to ${json.invitation.email}.`
          : `Invitation revoked for ${json.invitation.email}.`
      );
      await reloadDirectory();
    } catch {
      setErrorMessage('Network error while updating invitation.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white border border-warm-grey/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-bronze block mb-1">
              [ ADMIN RBAC &amp; ONBOARDING ]
            </span>
            <h1 className="type-section-title text-2xl sm:text-3xl text-charcoal">
              Staff Directory &amp; Employee Invitations
            </h1>
            <p className="font-sans text-xs sm:text-sm text-charcoal/75 mt-1 max-w-2xl">
              Invite Strovyn employees with single-use expiring links, manage Admin / Publisher /
              Editor permissions, and review access audit history.
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 border border-warm-grey/50 bg-ivory-light text-charcoal">
            <ShieldCheck className="w-4 h-4 text-bronze" aria-hidden="true" />
            <span>{snapshot.staff.filter((s) => s.is_active).length} Active Staff</span>
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className="mt-4 border border-bronze/50 bg-ivory-light px-4 py-2.5 text-xs font-sans text-charcoal"
          >
            {notice}
          </div>
        )}
        {errorMessage && (
          <div
            role="alert"
            className="mt-4 border border-brand-red/30 bg-brand-red/5 px-4 py-2.5 text-xs font-sans text-brand-red-dark"
          >
            {errorMessage}
          </div>
        )}
      </section>

      {/* Invite Employee Form */}
      <section className="bg-white border border-warm-grey/60 p-6">
        <div className="flex items-center gap-2 mb-4">
          <MailPlus className="w-4 h-4 text-bronze" aria-hidden="true" />
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-charcoal font-semibold">
            Invite Employee
          </h2>
        </div>

        <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label htmlFor="invite-full-name" className="block font-mono text-[10px] uppercase tracking-wider text-charcoal/80 mb-1.5">
              Full Name
            </label>
            <input
              id="invite-full-name"
              type="text"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jordan Ellis"
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm text-charcoal"
            />
          </div>

          <div className="md:col-span-4">
            <label htmlFor="invite-email" className="block font-mono text-[10px] uppercase tracking-wider text-charcoal/80 mb-1.5">
              Employee Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@strovynpaints.com"
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm text-charcoal"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="invite-role" className="block font-mono text-[10px] uppercase tracking-wider text-charcoal/80 mb-1.5">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as EditorialRole)}
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm text-charcoal"
            >
              <option value="editor">Editor</option>
              <option value="publisher">Publisher</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submittingInvite}
              className="w-full py-2.5 px-4 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
            >
              {submittingInvite ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </section>

      {/* Staff Directory */}
      <section className="bg-white border border-warm-grey/60 p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-charcoal font-semibold mb-4">
          Staff Directory ({snapshot.staff.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-warm-grey/40 font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
                <th className="py-2.5 pr-4">Employee</th>
                <th className="py-2.5 pr-4">Role</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5 pr-4">Last Sign-In</th>
                <th className="py-2.5 text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-grey/25">
              {snapshot.staff.map((member) => {
                const isBusy = busyKey === `staff:${member.id}`;
                return (
                  <tr key={member.id}>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-charcoal">
                        {member.full_name}{' '}
                        {member.id === currentAdminId && (
                          <span className="font-mono text-[10px] uppercase text-bronze ml-1">
                            (You)
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[11px] text-warm-grey-dark">{member.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        aria-label={`Role for ${member.email}`}
                        disabled={isBusy}
                        value={member.role}
                        onChange={(e) =>
                          handleStaffPatch(member.id, { role: e.target.value as EditorialRole })
                        }
                        className="bg-ivory-light border border-warm-grey px-2.5 py-1 text-xs font-mono uppercase text-charcoal"
                      >
                        <option value="editor">Editor</option>
                        <option value="publisher">Publisher</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider border ${
                          member.is_active
                            ? 'border-bronze/40 bg-ivory-light text-charcoal'
                            : 'border-brand-red/30 bg-brand-red/5 text-brand-red-dark'
                        }`}
                      >
                        {member.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-[11px] text-charcoal/75">
                      {formatTimestamp(member.auth_last_sign_in_at)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleStaffPatch(member.id, { isActive: !member.is_active })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-warm-grey text-[11px] font-mono uppercase tracking-wider text-charcoal hover:border-charcoal cursor-pointer disabled:opacity-50"
                      >
                        {member.is_active ? (
                          <>
                            <UserX className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Disable</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Reactivate</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invitations */}
      <section className="bg-white border border-warm-grey/60 p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-charcoal font-semibold mb-4">
          Employee Invitations ({snapshot.invitations.length})
        </h2>
        {snapshot.invitations.length === 0 ? (
          <p className="font-sans text-xs text-warm-grey-dark">
            No employee invitations have been sent yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-warm-grey/40 font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
                  <th className="py-2 pr-4">Invitee</th>
                  <th className="py-2 pr-4">Assigned Role</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Expires</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-grey/25">
                {snapshot.invitations.map((inv) => {
                  const canManage = inv.status === 'pending' || inv.status === 'expired';
                  return (
                    <tr key={inv.id}>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-charcoal">{inv.full_name}</p>
                        <p className="font-mono text-[11px] text-warm-grey-dark">{inv.email}</p>
                      </td>
                      <td className="py-3 pr-4 font-mono text-[11px] uppercase text-charcoal">
                        {inv.role}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-warm-grey/50 bg-ivory-light">
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-[11px] text-charcoal/75">
                        {formatTimestamp(inv.expires_at)}
                      </td>
                      <td className="py-3 text-right">
                        {canManage ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyKey === `inv:${inv.id}:resend`}
                              onClick={() => handleInviteAction(inv.id, 'resend')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 border border-warm-grey text-[11px] font-mono uppercase text-charcoal hover:border-charcoal cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" aria-hidden="true" />
                              <span>Resend</span>
                            </button>
                            <button
                              type="button"
                              disabled={busyKey === `inv:${inv.id}:revoke`}
                              onClick={() => handleInviteAction(inv.id, 'revoke')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 border border-brand-red/40 text-[11px] font-mono uppercase text-brand-red-dark hover:bg-brand-red/5 cursor-pointer"
                            >
                              <XCircle className="w-3 h-3" aria-hidden="true" />
                              <span>Revoke</span>
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-[10px] uppercase text-warm-grey-dark">
                            Closed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Audit History */}
      <section className="bg-white border border-warm-grey/60 p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-charcoal font-semibold mb-4">
          Administrative Audit History ({snapshot.auditLog.length})
        </h2>
        {snapshot.auditLog.length === 0 ? (
          <p className="font-sans text-xs text-warm-grey-dark">No administrative actions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {snapshot.auditLog.map((entry) => (
              <div
                key={entry.id}
                className="border border-warm-grey/30 bg-ivory-light px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-bronze mr-2">
                    {entry.action}
                  </span>
                  <span className="font-sans text-charcoal">
                    <strong>{entry.target_email}</strong>
                    {entry.actor_name ? ` by ${entry.actor_name}` : ''}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-warm-grey-dark">
                  {formatTimestamp(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
