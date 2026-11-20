'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';

export interface ArticleAuditLogEntry {
  id: string;
  event_seq?: number | null;
  article_id: string;
  actor_type?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  note?: string | null;
  created_at: string;
}

function formatAuditTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AdminAuditHistoryPanel({
  articleId,
  refreshTrigger = 0,
  onSessionExpired,
}: {
  articleId: string;
  refreshTrigger?: number;
  onSessionExpired?: () => void;
}) {
  const [entries, setEntries] = useState<ArticleAuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAuditHistory = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/insights/${articleId}/audit`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (res.status === 401) {
        onSessionExpired?.();
        return;
      }
      const json = (await res.json().catch(() => null)) as
        | { success: true; entries: ArticleAuditLogEntry[] }
        | { success: false; error?: string }
        | null;

      if (!res.ok || !json || !json.success) {
        setErrorMsg(
          (json && !json.success && json.error) || 'Unable to load immutable audit log.'
        );
        return;
      }

      setEntries(Array.isArray(json.entries) ? json.entries : []);
    } catch {
      setErrorMsg('Network failure loading editorial audit history.');
    } finally {
      setIsLoading(false);
    }
  }, [articleId, onSessionExpired]);

  useEffect(() => {
    loadAuditHistory();
  }, [loadAuditHistory, refreshTrigger]);

  return (
    <section
      aria-label="Immutable editorial audit history"
      className="bg-white border border-warm-grey/60 p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warm-grey/40 pb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-bronze" aria-hidden="true" />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze">
            Immutable Editorial Audit Timeline
          </h2>
        </div>

        <button
          type="button"
          onClick={loadAuditHistory}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1 border border-warm-grey bg-ivory-light text-[11px] font-mono uppercase tracking-wider text-charcoal hover:border-charcoal cursor-pointer disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2.5" aria-busy="true">
          {[1, 2].map((n) => (
            <div key={n} className="h-14 bg-ivory-light border border-warm-grey/30 animate-pulse" />
          ))}
        </div>
      ) : errorMsg ? (
        <div
          role="alert"
          className="border border-brand-red/40 bg-brand-red/5 px-4 py-3 flex items-center justify-between gap-3 text-xs font-sans text-brand-red-dark"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={loadAuditHistory}
            className="px-3 py-1 border border-charcoal text-charcoal font-mono text-[10px] uppercase cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <p className="font-sans text-xs text-warm-grey-dark py-2">
          No audit events recorded yet for this article.
        </p>
      ) : (
        <ol className="divide-y divide-warm-grey/30">
          {entries.map((entry) => (
            <li key={entry.id} className="py-3.5 first:pt-1 last:pb-1 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {typeof entry.event_seq === 'number' && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-ivory-light border border-warm-grey/60 text-warm-grey-dark">
                      #{entry.event_seq}
                    </span>
                  )}
                  <span className="font-mono text-xs font-medium uppercase tracking-wider text-charcoal">
                    {entry.action}
                  </span>
                  {(entry.from_status || entry.to_status) && (
                    <span className="font-mono text-[11px] text-bronze">
                      {entry.from_status || '—'} &rarr; {entry.to_status || '—'}
                    </span>
                  )}
                </div>

                <time
                  dateTime={entry.created_at}
                  className="font-mono text-[11px] text-warm-grey-dark"
                >
                  {formatAuditTimestamp(entry.created_at)}
                </time>
              </div>

              <div className="font-sans text-xs text-charcoal/80 flex flex-wrap items-center gap-2">
                {entry.actor_email ? (
                  <span>
                    Actor: <strong className="font-medium text-charcoal">{entry.actor_email}</strong>
                  </span>
                ) : entry.actor_type ? (
                  <span>
                    Actor Type: <strong className="font-medium text-charcoal">{entry.actor_type}</strong>
                  </span>
                ) : null}
                {entry.actor_role && (
                  <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 border border-warm-grey/50 bg-ivory-light">
                    {entry.actor_role}
                  </span>
                )}
              </div>

              {entry.note && (
                <p className="font-sans text-xs text-charcoal/85 bg-ivory-light border-l-2 border-bronze pl-3 py-1.5">
                  {entry.note}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
