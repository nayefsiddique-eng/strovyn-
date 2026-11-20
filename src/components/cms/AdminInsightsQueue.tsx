'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ARTICLE_STATUSES, type ArticleStatus } from '@/lib/cms/roles';
import {
  describeStaffRole,
  formatStatusLabel,
  getRoleQueueActionModel,
} from '@/lib/cms/stage1Access';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
  type AccessDeniedState,
  type StaffViewerIdentity,
} from './StaffAuthGateCards';

export interface EditorialQueueItem {
  id: string;
  title: string;
  subtitle?: string | null;
  slug: string;
  excerpt?: string;
  category: string;
  status: ArticleStatus;
  is_featured?: boolean;
  reading_time?: number;
  author_name: string;
  author_role?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_BADGE_CLASS: Record<ArticleStatus, string> = {
  draft: 'border-warm-grey bg-ivory text-charcoal',
  review: 'border-bronze/60 bg-bronze/10 text-bronze-hover',
  approved: 'border-charcoal/50 bg-charcoal/5 text-charcoal',
  scheduled: 'border-amber-700/40 bg-amber-50 text-amber-900',
  published: 'border-emerald-800/40 bg-emerald-50 text-emerald-900',
  archived: 'border-warm-grey-dark/40 bg-warm-grey-light/60 text-warm-grey-dark',
};

const CATEGORIES = [
  'All',
  'Surface Preparation',
  'Paint Chemistry',
  'Painting Techniques',
] as const;

function formatTimestamp(iso: string | null | undefined): string {
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

export function AdminInsightsQueue({
  initialStaff,
}: {
  initialStaff: StaffViewerIdentity;
}) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffViewerIdentity>(initialStaff);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [deniedState, setDeniedState] = useState<AccessDeniedState | null>(null);

  const [items, setItems] = useState<EditorialQueueItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 15,
    total: 0,
    totalPages: 1,
  });

  const [statusFilter, setStatusFilter] = useState<'all' | ArticleStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchInput, setSearchInput] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'updated_at' | 'published_at' | 'title'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setErrorBanner(null);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: '15',
      sortBy,
      sortOrder,
    });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (categoryFilter !== 'All') params.set('category', categoryFilter);
    if (appliedSearch) params.set('search', appliedSearch);

    try {
      const res = await fetch(`/api/admin/insights?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => null)) as
        | {
            success: true;
            items: EditorialQueueItem[];
            pagination: PaginationMeta;
          }
        | { success: false; code?: string; error?: string }
        | null;

      if (res.status === 401) {
        setItems([]);
        setSessionExpired(true);
        return;
      }

      if (res.status === 403 || res.status === 503) {
        setItems([]);
        setDeniedState({
          code: (json && !json.success && json.code) || `HTTP_${res.status}`,
          status: res.status,
          message:
            (json && !json.success && json.error) ||
            'Editorial access is unavailable for this account.',
        });
        return;
      }

      if (!res.ok || !json || !json.success) {
        setErrorBanner(
          (json && !json.success && json.error) || 'Unable to load editorial queue.'
        );
        return;
      }

      setItems(json.items);
      setPagination(json.pagination);
    } catch {
      setErrorBanner('Network error loading editorial queue. Check connection and retry.');
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortOrder, statusFilter, categoryFilter, appliedSearch]);

  useEffect(() => {
    if (!sessionExpired && !deniedState) {
      fetchQueue();
    }
  }, [fetchQueue, sessionExpired, deniedState]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut().catch(() => {});
      await fetch('/api/admin/insights/session', { method: 'DELETE' }).catch(() => {});
      setItems([]);
      setSessionExpired(false);
      router.replace('/admin/insights');
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  if (deniedState) {
    return (
      <StaffAccessDeniedCard
        code={deniedState.code}
        status={deniedState.status}
        message={deniedState.message}
        onSignedOut={() => setDeniedState(null)}
      />
    );
  }

  if (sessionExpired) {
    return (
      <StaffSignInCard
        reason="expired"
        redirectTo="/admin/insights"
        onAuthorized={(nextStaff) => {
          setStaff(nextStaff);
          setSessionExpired(false);
        }}
        onAccessDenied={(denied) => {
          setSessionExpired(false);
          setDeniedState(denied);
        }}
      />
    );
  }

  const roleMeta = describeStaffRole(staff.role);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setStatusFilter('all');
    setCategoryFilter('All');
    setSortBy('updated_at');
    setSortOrder('desc');
    setPage(1);
  };

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal pt-28 pb-24 px-4 sm:px-6 lg:px-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Workspace Header */}
        <header className="bg-white border border-warm-grey/60 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bronze">
                [ Strovyn Editorial Desk ]
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 border border-bronze/50 bg-ivory-light font-mono text-[11px] uppercase tracking-wider text-charcoal">
                <ShieldCheck className="w-3.5 h-3.5 text-bronze" aria-hidden="true" />
                {roleMeta.label}
              </span>
            </div>
            <h1 className="type-page-title text-3xl sm:text-4xl lg:text-5xl text-charcoal">
              Insights Editorial Queue
            </h1>
            <p className="font-sans text-sm text-charcoal/75 mt-2 max-w-2xl">
              {roleMeta.scopeSummary}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t lg:border-t-0 pt-4 lg:pt-0 border-warm-grey/40">
            <div className="text-left sm:text-right pr-2">
              <p className="font-sans text-sm font-medium text-charcoal">{staff.full_name}</p>
              <p className="font-mono text-[11px] text-warm-grey-dark">{staff.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/insights"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal transition-colors"
              >
                <span>Public Insights</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isSigningOut ? 'Signing Out' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Stage 1 Notice Banner */}
        <div className="border border-warm-grey/50 bg-ivory-light px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-sans text-charcoal/80">
          <span>
            <strong>Stage 1 Workspace:</strong> Authenticated queue, status inspection, and RBAC navigation are active. Rich-text authoring, media library management, and workflow transitions arrive in Stages 2–3.
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-bronze flex-shrink-0">
            Role Scope: {staff.role}
          </span>
        </div>

        {/* Search, Filter & Refresh Controls */}
        <section
          aria-label="Queue filters"
          className="bg-white border border-warm-grey/60 p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2 max-w-xl">
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-warm-grey-dark absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Search articles by title, slug, or excerpt"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search title, slug, or excerpt..."
                  className="w-full pl-9 pr-3 py-2 bg-ivory-light border border-warm-grey text-sm font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-bronze"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-wider cursor-pointer"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-warm-grey-dark">
                <span>Category</span>
                <select
                  aria-label="Filter by category"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-sans normal-case text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-warm-grey-dark">
                <span>Sort</span>
                <select
                  aria-label="Sort articles"
                  value={`${sortBy}:${sortOrder}`}
                  onChange={(e) => {
                    const [col, ord] = e.target.value.split(':') as [
                      'updated_at' | 'published_at' | 'title',
                      'asc' | 'desc',
                    ];
                    setSortBy(col);
                    setSortOrder(ord);
                    setPage(1);
                  }}
                  className="bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-sans normal-case text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
                >
                  <option value="updated_at:desc">Recently Updated</option>
                  <option value="updated_at:asc">Oldest Updated</option>
                  <option value="published_at:desc">Recently Published</option>
                  <option value="title:asc">Title (A–Z)</option>
                </select>
              </label>

              <button
                type="button"
                onClick={fetchQueue}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-warm-grey/30" role="tablist" aria-label="Filter by status">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'all'}
              onClick={() => {
                setStatusFilter('all');
                setPage(1);
              }}
              className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider border transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-charcoal text-ivory border-charcoal'
                  : 'bg-ivory-light text-charcoal border-warm-grey/70 hover:border-charcoal'
              }`}
            >
              All Statuses
            </button>
            {ARTICLE_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={statusFilter === status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider border transition-colors cursor-pointer ${
                  statusFilter === status
                    ? 'bg-charcoal text-ivory border-charcoal'
                    : 'bg-ivory-light text-charcoal border-warm-grey/70 hover:border-charcoal'
                }`}
              >
                {formatStatusLabel(status)}
              </button>
            ))}
          </div>
        </section>

        {/* Error State */}
        {errorBanner && (
          <div
            role="alert"
            className="bg-white border border-brand-red/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <p className="font-sans text-sm text-brand-red-dark">{errorBanner}</p>
            <button
              type="button"
              onClick={fetchQueue}
              className="px-4 py-2 border border-charcoal text-xs font-mono uppercase tracking-wider text-charcoal hover:bg-charcoal hover:text-ivory transition-colors cursor-pointer self-start sm:self-auto"
            >
              Retry
            </button>
          </div>
        )}

        {/* Article Table (Desktop) & Card List (Mobile) */}
        <section aria-label="Editorial articles list" className="bg-white border border-warm-grey/60">
          {isLoading ? (
            <div className="p-8 space-y-4" aria-busy="true" aria-live="polite">
              <p className="font-mono text-xs uppercase tracking-widest text-warm-grey-dark">
                Loading editorial queue...
              </p>
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-16 bg-ivory-light border border-warm-grey/30 animate-pulse"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <FileText className="w-8 h-8 text-bronze mx-auto" aria-hidden="true" />
              <h2 className="type-card-title text-2xl text-charcoal">
                No Matching Articles
              </h2>
              <p className="font-sans text-sm text-charcoal/70 max-w-md mx-auto">
                No editorial entries match the active search or status filters.
              </p>
              {(statusFilter !== 'all' || categoryFilter !== 'All' || appliedSearch) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 border border-charcoal text-xs font-mono uppercase tracking-wider text-charcoal hover:bg-charcoal hover:text-ivory transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-warm-grey/50 bg-ivory-light font-mono text-[11px] uppercase tracking-[0.15em] text-warm-grey-dark">
                      <th className="py-3.5 px-5 font-medium">Title &amp; Slug</th>
                      <th className="py-3.5 px-4 font-medium">Status</th>
                      <th className="py-3.5 px-4 font-medium">Author</th>
                      <th className="py-3.5 px-4 font-medium">Last Updated</th>
                      <th className="py-3.5 px-5 font-medium text-right">Role Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-grey/30">
                    {items.map((article) => {
                      const actions = getRoleQueueActionModel(staff.role, article.status);
                      return (
                        <tr key={article.id} className="hover:bg-ivory-light/70 transition-colors">
                          <td className="py-4 px-5 align-top max-w-md">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-bronze">
                                {article.category}
                              </span>
                              {article.is_featured && (
                                <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-bronze/15 text-bronze-hover">
                                  Featured
                                </span>
                              )}
                            </div>
                            <Link
                              href={`/admin/insights/articles/${article.id}`}
                              className="font-sans text-sm font-medium text-charcoal hover:text-bronze transition-colors block"
                            >
                              {article.title}
                            </Link>
                            <span className="font-mono text-[11px] text-warm-grey-dark block mt-1 break-all">
                              /insights/{article.slug}
                            </span>
                          </td>

                          <td className="py-4 px-4 align-top whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-1 border font-mono text-[11px] uppercase tracking-wider ${STATUS_BADGE_CLASS[article.status]}`}
                            >
                              {formatStatusLabel(article.status)}
                            </span>
                          </td>

                          <td className="py-4 px-4 align-top text-sm">
                            <span className="font-sans text-charcoal block">
                              {article.author_name}
                            </span>
                            {article.author_role && (
                              <span className="font-sans text-xs text-warm-grey-dark block">
                                {article.author_role}
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 align-top whitespace-nowrap">
                            <span className="font-mono text-xs text-charcoal block">
                              {formatTimestamp(article.updated_at)}
                            </span>
                            {article.published_at && (
                              <span className="font-mono text-[10px] text-warm-grey-dark block mt-0.5">
                                Pub: {formatTimestamp(article.published_at)}
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-5 align-top text-right">
                            <div className="inline-flex flex-col items-end gap-2">
                              <div className="flex items-center gap-2">
                                {actions.canInspectShell && (
                                  <Link
                                    href={`/admin/insights/articles/${article.id}`}
                                    className="px-3 py-1.5 border border-charcoal bg-charcoal text-ivory hover:bg-bronze hover:border-bronze transition-colors font-mono text-[11px] uppercase tracking-wider"
                                  >
                                    {actions.workspaceLinkLabel}
                                  </Link>
                                )}
                                {actions.canOpenPreview && (
                                  <Link
                                    href={`/admin/insights/preview/${article.id}`}
                                    className="px-3 py-1.5 border border-warm-grey text-charcoal hover:border-charcoal transition-colors font-mono text-[11px] uppercase tracking-wider"
                                  >
                                    Preview
                                  </Link>
                                )}
                              </div>

                              <div className="flex flex-wrap justify-end gap-1.5">
                                {actions.lockNotice && (
                                  <span className="font-mono text-[10px] text-warm-grey-dark">
                                    {actions.lockNotice}
                                  </span>
                                )}
                                {actions.permittedTransitions.map((tr) => (
                                  <span
                                    key={tr.toStatus}
                                    title="Workflow execution unlocks in CMS-3 Stage 3"
                                    className="px-2 py-0.5 bg-ivory-light border border-warm-grey/60 font-mono text-[10px] text-charcoal/80"
                                  >
                                    Permitted: {tr.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet Card View */}
              <div className="lg:hidden divide-y divide-warm-grey/40">
                {items.map((article) => {
                  const actions = getRoleQueueActionModel(staff.role, article.status);
                  return (
                    <article key={article.id} className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-bronze">
                          {article.category}
                        </span>
                        <span
                          className={`px-2 py-0.5 border font-mono text-[10px] uppercase tracking-wider ${STATUS_BADGE_CLASS[article.status]}`}
                        >
                          {formatStatusLabel(article.status)}
                        </span>
                      </div>

                      <div>
                        <Link
                          href={`/admin/insights/articles/${article.id}`}
                          className="font-sans text-base font-medium text-charcoal hover:text-bronze block"
                        >
                          {article.title}
                        </Link>
                        <p className="font-mono text-[11px] text-warm-grey-dark mt-1 break-all">
                          /insights/{article.slug}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-sans text-charcoal/80 pt-1">
                        <div>
                          <span className="text-warm-grey-dark block font-mono text-[10px] uppercase">
                            Author
                          </span>
                          <span>{article.author_name}</span>
                        </div>
                        <div>
                          <span className="text-warm-grey-dark block font-mono text-[10px] uppercase">
                            Updated
                          </span>
                          <span className="font-mono text-[11px]">
                            {formatTimestamp(article.updated_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {actions.canInspectShell && (
                          <Link
                            href={`/admin/insights/articles/${article.id}`}
                            className="px-3 py-1.5 bg-charcoal text-ivory font-mono text-[11px] uppercase tracking-wider"
                          >
                            {actions.workspaceLinkLabel}
                          </Link>
                        )}
                        {actions.canOpenPreview && (
                          <Link
                            href={`/admin/insights/preview/${article.id}`}
                            className="px-3 py-1.5 border border-warm-grey text-charcoal font-mono text-[11px] uppercase tracking-wider"
                          >
                            Preview
                          </Link>
                        )}
                      </div>

                      {(actions.lockNotice || actions.permittedTransitions.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {actions.lockNotice && (
                            <span className="font-mono text-[10px] text-warm-grey-dark">
                              {actions.lockNotice}
                            </span>
                          )}
                          {actions.permittedTransitions.map((tr) => (
                            <span
                              key={tr.toStatus}
                              className="px-2 py-0.5 bg-ivory-light border border-warm-grey/60 font-mono text-[10px] text-charcoal/80"
                            >
                              Permitted: {tr.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {/* Pagination Footer */}
              <div className="border-t border-warm-grey/40 bg-ivory-light px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="font-mono text-xs text-warm-grey-dark">
                  Page {pagination.page} of {pagination.totalPages} &mdash; {pagination.total}{' '}
                  {pagination.total === 1 ? 'article' : 'articles'}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1 || isLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-warm-grey bg-white text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Prev</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page >= pagination.totalPages || isLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-warm-grey bg-white text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
