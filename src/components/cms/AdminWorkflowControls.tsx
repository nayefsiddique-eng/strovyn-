'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { ArticleStatus, EditorialRole } from '@/lib/cms/roles';
import {
  formatStatusLabel,
  getAvailableWorkflowTransitionsForRole,
  type PermittedWorkflowActionSummary,
} from '@/lib/cms/stage1Access';
import type { EditorialArticleDetail } from '@/lib/cms/editorHelpers';

interface TransitionDialogMeta {
  headline: string;
  description: string;
  requiresExplicitAcknowledge: boolean;
  tone: 'primary' | 'danger' | 'neutral';
  acknowledgeText?: string;
}

function getTransitionDialogMeta(
  fromStatus: ArticleStatus,
  transition: PermittedWorkflowActionSummary
): TransitionDialogMeta {
  switch (transition.toStatus) {
    case 'published':
      return {
        headline: 'Confirm Live Publication',
        description:
          'Publishing promotes this article to live status and immediately enables public delivery for any referenced /api/editorial-media/<uuid> assets.',
        requiresExplicitAcknowledge: true,
        tone: 'primary',
        acknowledgeText:
          'I confirm this article has passed editorial review and should be made publicly available.',
      };
    case 'archived':
      return {
        headline: 'Confirm Archive & Unpublish',
        description:
          'Archiving immediately removes public visibility and revokes public access to any exclusive editorial media assets.',
        requiresExplicitAcknowledge: true,
        tone: 'danger',
        acknowledgeText:
          'I confirm this published article should be archived and withdrawn from public visibility.',
      };
    case 'scheduled':
      return {
        headline: 'Schedule Publication',
        description:
          'Schedules this approved article for automated publication at the chosen future time. It remains invisible to anonymous readers until published.',
        requiresExplicitAcknowledge: true,
        tone: 'primary',
        acknowledgeText:
          'I confirm this approved article is ready for automated publication at the scheduled time.',
      };
    case 'approved':
      return {
        headline:
          fromStatus === 'scheduled'
            ? 'Cancel Scheduled Publication'
            : 'Approve Editorial Candidate',
        description:
          fromStatus === 'scheduled'
            ? 'Cancels the scheduled publication timestamp and returns the article to Approved status.'
            : 'Approving locks the article against non-publisher edits until published or returned.',
        requiresExplicitAcknowledge: false,
        tone: 'primary',
      };
    case 'review':
      return {
        headline:
          fromStatus === 'draft' ? 'Submit Draft for Review' : 'Return Article to Review',
        description:
          fromStatus === 'draft'
            ? 'Moves this draft into editorial review. Ensure title, slug, excerpt, readable body copy, and cover alt text are complete.'
            : 'Moves this article back into active editorial review.',
        requiresExplicitAcknowledge: false,
        tone: 'primary',
      };
    case 'draft':
      return {
        headline: transition.label,
        description:
          fromStatus === 'archived'
            ? 'Restores this archived entry to Draft status without publishing it.'
            : 'Returns the article to Draft status for further editing.',
        requiresExplicitAcknowledge: false,
        tone: 'neutral',
      };
    default:
      return {
        headline: transition.label,
        description: `Transition article from ${fromStatus} to ${transition.toStatus}.`,
        requiresExplicitAcknowledge: false,
        tone: 'neutral',
      };
  }
}

function formatGovernanceTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function defaultScheduledLocalInput(): string {
  const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
  return new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function AdminWorkflowControls({
  article,
  staffRole,
  isDirty,
  hasConflict,
  onSaveBeforeTransition,
  onDiscardDirtyBeforeTransition,
  onTransitionSucceeded,
  onConflictDetected,
  onSessionExpired,
}: {
  article: EditorialArticleDetail;
  staffRole: EditorialRole;
  isDirty: boolean;
  hasConflict: boolean;
  onSaveBeforeTransition: () => Promise<void>;
  onDiscardDirtyBeforeTransition: () => void;
  onTransitionSucceeded: (updated: EditorialArticleDetail, message: string) => void;
  onConflictDetected: (message: string) => void;
  onSessionExpired: () => void;
}) {
  const permittedTransitions = getAvailableWorkflowTransitionsForRole(
    staffRole,
    article.status
  );

  const [pendingTransition, setPendingTransition] =
    useState<PermittedWorkflowActionSummary | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [scheduledInput, setScheduledInput] = useState('');
  const [explicitAck, setExplicitAck] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (!pendingTransition) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        setPendingTransition(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingTransition, isSubmitting]);

  const openTransitionDialog = (tr: PermittedWorkflowActionSummary) => {
    if (isDirty || hasConflict) return;
    setPendingTransition(tr);
    setNoteInput('');
    if (tr.toStatus === 'scheduled') {
      setScheduledInput(defaultScheduledLocalInput());
    } else {
      setScheduledInput('');
    }
    setExplicitAck(false);
    setDialogError(null);
  };

  const handleConfirmTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTransition || submitLockRef.current || isDirty || hasConflict) return;

    const meta = getTransitionDialogMeta(article.status, pendingTransition);
    if (meta.requiresExplicitAcknowledge && !explicitAck) {
      setDialogError('Please confirm the explicit publication/archival checkbox first.');
      return;
    }

    let scheduledAtUtc: string | undefined;
    if (pendingTransition.toStatus === 'scheduled') {
      const parsed = scheduledInput ? new Date(scheduledInput) : null;
      if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setDialogError('Please select a valid future date and time for scheduled publication.');
        return;
      }
      scheduledAtUtc = parsed.toISOString();
    }

    const trimmedNote = noteInput.trim();
    if (trimmedNote.length > 500) {
      setDialogError('Transition note must be at most 500 characters.');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setDialogError(null);

    try {
      const payload: Record<string, unknown> = {
        toStatus: pendingTransition.toStatus,
        expected_updated_at: article.updated_at,
      };
      if (scheduledAtUtc) {
        payload.scheduled_at = scheduledAtUtc;
      }
      if (trimmedNote.length > 0) {
        payload.note = trimmedNote;
      }

      const res = await fetch(`/api/admin/insights/${article.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        setPendingTransition(null);
        onSessionExpired();
        return;
      }

      const json = (await res.json().catch(() => null)) as
        | { success: true; article: EditorialArticleDetail }
        | { success: false; code?: string; error?: string }
        | null;

      if (res.status === 409) {
        const msg =
          (json && !json.success && json.error) ||
          'Article state changed concurrently on the server before this transition could run.';
        setPendingTransition(null);
        onConflictDetected(msg);
        return;
      }

      if (!res.ok || !json || !json.success || !json.article) {
        setDialogError(
          (json && !json.success && json.error) ||
            `Workflow transition failed (HTTP ${res.status}).`
        );
        return;
      }

      const targetLabel = formatStatusLabel(json.article.status);
      setPendingTransition(null);
      onTransitionSucceeded(
        json.article,
        `Article transitioned cleanly to ${targetLabel}.`
      );
    } catch {
      setDialogError('Network error executing workflow transition. Verify connection and retry.');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const dialogMeta = pendingTransition
    ? getTransitionDialogMeta(article.status, pendingTransition)
    : null;

  return (
    <section
      aria-label="Workflow governance controls"
      className="bg-white border border-warm-grey/60 p-5 space-y-4"
    >
      <div className="flex items-center justify-between border-b border-warm-grey/40 pb-2.5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze">
          Editorial Workflow
        </h2>
        <span className="px-2 py-0.5 border border-warm-grey bg-ivory-light font-mono text-[10px] uppercase tracking-wider text-charcoal">
          {formatStatusLabel(article.status)}
        </span>
      </div>

      {/* Authoritative Server Timestamps */}
      <dl className="grid grid-cols-1 gap-2 text-xs font-sans border-b border-warm-grey/30 pb-3">
        <div className="flex items-center justify-between gap-2">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
            Updated
          </dt>
          <dd className="font-mono text-[11px] text-charcoal">
            {formatGovernanceTimestamp(article.updated_at)}
          </dd>
        </div>
        {article.approved_at && (
          <div className="flex items-center justify-between gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
              Approved
            </dt>
            <dd className="font-mono text-[11px] text-charcoal">
              {formatGovernanceTimestamp(article.approved_at)}
            </dd>
          </div>
        )}
        {article.scheduled_at && (
          <div className="flex items-center justify-between gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
              Scheduled
            </dt>
            <dd className="font-mono text-[11px] text-bronze">
              {formatGovernanceTimestamp(article.scheduled_at)}
            </dd>
          </div>
        )}
        {(article.publish_attempts ?? 0) > 0 && (
          <div className="flex items-center justify-between gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
              Publish Attempts
            </dt>
            <dd className="font-mono text-[11px] text-charcoal">
              {article.publish_attempts}
            </dd>
          </div>
        )}
        {article.next_retry_at && (
          <div className="flex items-center justify-between gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
              Next Retry
            </dt>
            <dd className="font-mono text-[11px] text-charcoal">
              {formatGovernanceTimestamp(article.next_retry_at)}
            </dd>
          </div>
        )}
        {article.last_publish_error && (
          <div className="col-span-full border border-brand-red/40 bg-brand-red/5 px-2.5 py-1.5 text-[11px] text-brand-red-dark">
            Last publish error: {article.last_publish_error}
          </div>
        )}
        {article.published_at && (
          <div className="flex items-center justify-between gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
              Published
            </dt>
            <dd className="font-mono text-[11px] text-emerald-900">
              {formatGovernanceTimestamp(article.published_at)}
            </dd>
          </div>
        )}
        {article.archived_at && (
          <div className="flex items-center justify-between gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
              Archived
            </dt>
            <dd className="font-mono text-[11px] text-charcoal">
              {formatGovernanceTimestamp(article.archived_at)}
            </dd>
          </div>
        )}
      </dl>

      {/* Unsaved-Change Guard Warning */}
      {isDirty && (
        <div
          role="status"
          className="border border-bronze/60 bg-ivory-light p-3.5 space-y-2.5 text-xs font-sans"
        >
          <div className="flex items-start gap-2 text-charcoal">
            <AlertTriangle className="w-4 h-4 text-bronze flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <strong>Unsaved changes present.</strong> Save or discard local edits before running workflow transitions.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSaveBeforeTransition}
              disabled={hasConflict}
              className="px-2.5 py-1 bg-charcoal text-ivory hover:bg-bronze font-mono text-[10px] uppercase tracking-wider cursor-pointer disabled:opacity-40"
            >
              Save Edits Now
            </button>
            <button
              type="button"
              onClick={onDiscardDirtyBeforeTransition}
              className="px-2.5 py-1 border border-warm-grey text-charcoal hover:border-charcoal font-mono text-[10px] uppercase tracking-wider cursor-pointer"
            >
              Discard Local Edits
            </button>
          </div>
        </div>
      )}

      {/* Role-Permitted Actions */}
      {permittedTransitions.length > 0 ? (
        <div className="space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark block">
            Available Transitions ({staffRole})
          </span>
          <div className="flex flex-col gap-2">
            {permittedTransitions.map((tr) => {
              const isDanger = tr.toStatus === 'archived';
              const isPrimary = tr.toStatus === 'published' || tr.toStatus === 'approved' || tr.toStatus === 'review';
              return (
                <button
                  key={tr.toStatus}
                  type="button"
                  disabled={isDirty || hasConflict}
                  onClick={() => openTransitionDialog(tr)}
                  className={`w-full flex items-center justify-between px-3.5 py-2 border font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isDanger
                      ? 'border-brand-red/60 text-brand-red-dark bg-white hover:bg-brand-red/5'
                      : isPrimary
                        ? 'border-charcoal bg-charcoal text-ivory hover:bg-bronze hover:border-bronze'
                        : 'border-warm-grey bg-ivory-light text-charcoal hover:border-charcoal'
                  }`}
                >
                  <span>{tr.label}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="font-sans text-xs text-warm-grey-dark">
          No workflow transitions are permitted for your <strong>{staffRole}</strong> role in{' '}
          <strong>{article.status}</strong> status.
        </p>
      )}

      <p className="font-mono text-[10px] text-warm-grey-dark flex items-center gap-1.5 pt-1">
        <Clock className="w-3 h-3 text-bronze flex-shrink-0" aria-hidden="true" />
        <span>Scheduled articles publish automatically via the authenticated cron publisher.</span>
      </p>

      {/* Transition Confirmation Dialog */}
      {pendingTransition && dialogMeta && (
        <div
          className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cms-transition-dialog-title"
        >
          <div className="w-full max-w-lg bg-white border border-warm-grey p-6 sm:p-8 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-warm-grey/40 pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bronze block mb-1">
                  {formatStatusLabel(article.status)} &rarr;{' '}
                  {formatStatusLabel(pendingTransition.toStatus)}
                </span>
                <h3
                  id="cms-transition-dialog-title"
                  className="type-section-title text-2xl text-charcoal"
                >
                  {dialogMeta.headline}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingTransition(null)}
                disabled={isSubmitting}
                aria-label="Close transition confirmation dialog"
                className="p-2 border border-warm-grey/60 text-charcoal hover:border-charcoal cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm font-sans text-charcoal/85">
              <p className="font-medium text-charcoal">{article.title}</p>
              <p className="text-xs leading-relaxed text-charcoal/75">
                {dialogMeta.description}
              </p>
            </div>

            {dialogMeta.requiresExplicitAcknowledge && (
              <div
                className={`p-3.5 border text-xs font-sans flex items-start gap-2.5 ${
                  dialogMeta.tone === 'danger'
                    ? 'border-brand-red/40 bg-brand-red/5 text-brand-red-dark'
                    : 'border-bronze/50 bg-ivory-light text-charcoal'
                }`}
              >
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={explicitAck}
                    onChange={(e) => setExplicitAck(e.target.checked)}
                    className="mt-0.5 accent-bronze"
                  />
                  <span>{dialogMeta.acknowledgeText}</span>
                </label>
              </div>
            )}

            <form onSubmit={handleConfirmTransition} className="space-y-4">
              {pendingTransition.toStatus === 'scheduled' && (
                <div>
                  <label
                    htmlFor="cms-scheduled-at"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1.5"
                  >
                    Scheduled Publication Time (Local &rarr; UTC)
                  </label>
                  <input
                    id="cms-scheduled-at"
                    type="datetime-local"
                    required
                    value={scheduledInput}
                    onChange={(e) => setScheduledInput(e.target.value)}
                    className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-mono text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
                  />
                </div>
              )}
              <div>
                <label
                  htmlFor="cms-transition-note"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1.5"
                >
                  Audit Note (optional, {noteInput.trim().length}/500)
                </label>
                <textarea
                  id="cms-transition-note"
                  rows={3}
                  maxLength={500}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Optional editorial review feedback or governance note recorded in the immutable audit log."
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
                />
              </div>

              {dialogError && (
                <div
                  role="alert"
                  className="border border-brand-red/40 bg-brand-red/5 px-3.5 py-2.5 text-xs font-sans text-brand-red-dark"
                >
                  {dialogError}
                </div>
              )}

              <div className="pt-3 border-t border-warm-grey/40 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPendingTransition(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (dialogMeta.requiresExplicitAcknowledge && !explicitAck)
                  }
                  className={`inline-flex items-center gap-1.5 px-5 py-2 font-mono text-xs uppercase tracking-wider text-ivory cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    dialogMeta.tone === 'danger'
                      ? 'bg-brand-red-dark hover:bg-brand-red'
                      : 'bg-charcoal hover:bg-bronze'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {isSubmitting ? 'Executing...' : `Confirm ${pendingTransition.label}`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
