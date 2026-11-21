'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Mail,
  Phone,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  CUSTOMER_FEEDBACK_STATUSES,
  JOB_APPLICATION_STATUSES,
  QUOTE_REQUEST_STATUSES,
} from '@/lib/cms/submissionValidators';
import type {
  ApplicationDetailRecord,
  ApplicationListSummary,
  FeedbackDetailRecord,
  FeedbackListSummary,
  PaginatedSubmissionList,
  QuoteDetailRecord,
  QuoteListSummary,
} from '@/lib/cms/submissionsService';

type SubmissionMode = 'quotes' | 'applications' | 'feedback';

type ListSummaryUnion =
  | QuoteListSummary
  | ApplicationListSummary
  | FeedbackListSummary;

type DetailUnion =
  | QuoteDetailRecord
  | ApplicationDetailRecord
  | FeedbackDetailRecord;

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'quoted':
    case 'hired':
    case 'approved':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    case 'reviewed':
    case 'reviewing':
    case 'interviewed':
      return 'bg-sky-50 text-sky-800 border-sky-300';
    case 'rejected':
      return 'bg-red-50 text-red-800 border-red-300';
    case 'closed':
    case 'archived':
      return 'bg-stone-100 text-stone-700 border-stone-300';
    case 'pending':
    default:
      return 'bg-amber-50 text-amber-800 border-amber-300';
  }
}

export function AdminSubmissionsWorkspace({
  mode,
  initialPageData,
}: {
  mode: SubmissionMode;
  initialPageData: PaginatedSubmissionList<ListSummaryUnion>;
}) {
  const [pageData, setPageData] =
    useState<PaginatedSubmissionList<ListSummaryUnion>>(initialPageData);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPageData.items[0]?.id ?? null
  );
  const [detail, setDetail] = useState<DetailUnion | null>(null);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  const [editStatus, setEditStatus] = useState<string>('pending');
  const [editNotes, setEditNotes] = useState<string>('');
  const [conflictLatest, setConflictLatest] = useState<DetailUnion | null>(null);
  const [banner, setBanner] = useState<{
    type: 'success' | 'error' | 'conflict';
    message: string;
  } | null>(null);

  const statusOptions: readonly string[] =
    mode === 'quotes'
      ? QUOTE_REQUEST_STATUSES
      : mode === 'applications'
        ? JOB_APPLICATION_STATUSES
        : CUSTOMER_FEEDBACK_STATUSES;

  const headerMeta =
    mode === 'quotes'
      ? {
          tag: 'Inbound Client Inquiries',
          title: 'Quote Requests & Scope Attachments',
          subtitle:
            'Inspect private client specifications, record internal notes, and download bound scope documents.',
        }
      : mode === 'applications'
        ? {
            tag: 'Candidate Recruitment Intake',
            title: 'Job Applications & Private Resumes',
            subtitle:
              'Review candidate credentials, update interview status, and securely download bound CV files.',
          }
        : {
            tag: 'Client Feedback Triage',
            title: 'Customer Feedback & Testimonial Promotion',
            subtitle:
              'Triage direct customer evaluations, record internal notes, and promote eligible feedback to testimonial drafts.',
          };

  const syncEditorFromDetail = (rec: DetailUnion) => {
    setDetail(rec);
    setEditStatus(rec.status);
    setEditNotes(rec.admin_notes ?? '');
    setConflictLatest(null);
  };

  const fetchDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/submissions/${mode}/${id}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      const record = (data.quote ?? data.application ?? data.feedback) as
        | DetailUnion
        | undefined;
      if (res.ok && record) {
        syncEditorFromDetail(record);
      }
    } catch {
      // Ignore background fetch errors
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedId) {
      void fetchDetail(selectedId);
    } else {
      setDetail(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, mode]);

  const fetchList = async (
    nextPage: number,
    nextStatus: string = statusFilter,
    nextSearch: string = searchQuery
  ) => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pageData.pageSize),
        status: nextStatus,
        search: nextSearch,
      });
      const res = await fetch(
        `/api/admin/submissions/${mode}?${params.toString()}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        const nextData: PaginatedSubmissionList<ListSummaryUnion> = {
          items: data.items,
          page: data.page,
          pageSize: data.pageSize,
          total: data.total,
          totalPages: data.totalPages,
        };
        setPageData(nextData);
        if (
          !nextData.items.some((item) => item.id === selectedId) &&
          nextData.items[0]
        ) {
          setSelectedId(nextData.items[0].id);
        } else if (nextData.items.length === 0) {
          setSelectedId(null);
        }
      }
    } finally {
      setLoadingList(false);
    }
  };

  const handleFilterChange = (nextStatus: string) => {
    setStatusFilter(nextStatus);
    setBanner(null);
    void fetchList(1, nextStatus, searchQuery);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    void fetchList(1, statusFilter, searchQuery);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || busy) return;
    setBusy(true);
    setBanner(null);
    setConflictLatest(null);
    try {
      const res = await fetch(`/api/admin/submissions/${mode}/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_updated_at: detail.updated_at,
          status: editStatus,
          admin_notes: editNotes,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        const latestRes = await fetch(
          `/api/admin/submissions/${mode}/${detail.id}`,
          { cache: 'no-store' }
        );
        const latestData = await latestRes.json().catch(() => null);
        const latestRec = (latestData?.quote ??
          latestData?.application ??
          latestData?.feedback) as DetailUnion | undefined;
        if (latestRes.ok && latestRec) {
          setConflictLatest(latestRec);
        }
        setBanner({
          type: 'conflict',
          message:
            data.error ??
            'This record was updated elsewhere. Your unsaved notes/status are preserved.',
        });
        return;
      }
      if (!res.ok) {
        setBanner({
          type: 'error',
          message: data.error ?? 'Failed to update submission.',
        });
        return;
      }
      const updated = (data.quote ?? data.application ?? data.feedback) as DetailUnion;
      syncEditorFromDetail(updated);
      setBanner({
        type: 'success',
        message: 'Submission status and internal notes saved.',
      });
      await fetchList(pageData.page, statusFilter, searchQuery);
    } catch {
      setBanner({
        type: 'error',
        message: 'Network error while saving submission.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRebaseTimestamp = () => {
    if (!conflictLatest) return;
    setDetail(conflictLatest);
    setConflictLatest(null);
    setBanner({
      type: 'success',
      message:
        'Timestamp rebased to latest server version. Click Save Processing Update to persist your changes.',
    });
  };

  const handlePromoteFeedback = async (feedbackId: string) => {
    if (busy || mode !== 'feedback') return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/admin/testimonials/promote-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_id: feedbackId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: res.status === 409 ? 'conflict' : 'error',
          message: data.error ?? 'Failed to promote feedback to testimonial draft.',
        });
        return;
      }
      setBanner({
        type: 'success',
        message:
          'Promoted to unpublished Testimonial Draft. Verify publication consent in Testimonials before publishing.',
      });
      await fetchDetail(feedbackId);
      await fetchList(pageData.page, statusFilter, searchQuery);
    } catch {
      setBanner({
        type: 'error',
        message: 'Network error promoting customer feedback.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-warm-grey/60 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-bronze block mb-1">
            {headerMeta.tag}
          </span>
          <h2 className="font-serif text-2xl text-charcoal">
            {headerMeta.title}
          </h2>
          <p className="font-sans text-xs text-warm-grey-dark mt-1">
            {headerMeta.subtitle}
          </p>
        </div>
        <div className="font-mono text-xs text-warm-grey-dark">
          Total Records: <strong className="text-charcoal">{pageData.total}</strong>
        </div>
      </div>

      {banner && (
        <div
          role="alert"
          className={`border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : banner.type === 'conflict'
                ? 'bg-amber-50 border-amber-400 text-amber-950'
                : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <span>{banner.message}</span>
          {banner.type === 'conflict' && conflictLatest && (
            <button
              type="button"
              onClick={handleRebaseTimestamp}
              className="px-3 py-1.5 bg-charcoal text-ivory font-mono text-[10px] uppercase tracking-wider cursor-pointer shrink-0"
            >
              Keep Local &amp; Rebase Timestamp
            </button>
          )}
        </div>
      )}

      {/* Filter Bar + Search */}
      <div className="bg-white border border-warm-grey/60 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {['all', ...statusOptions].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => handleFilterChange(st)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border cursor-pointer transition-colors ${
                statusFilter === st
                  ? 'bg-charcoal text-ivory border-charcoal'
                  : 'bg-ivory text-charcoal border-warm-grey/50 hover:border-charcoal'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full lg:w-80">
          <div className="relative flex-1">
            <Search
              className="w-3.5 h-3.5 text-warm-grey-dark absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, service, project..."
              aria-label="Search submissions"
              className="w-full border border-warm-grey/60 bg-ivory pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={loadingList}
            className="px-3 py-1.5 bg-charcoal text-ivory font-mono text-[10px] uppercase tracking-wider cursor-pointer"
          >
            Find
          </button>
        </form>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Paginated List */}
        <div className="lg:col-span-5 bg-white border border-warm-grey/60 flex flex-col justify-between">
          <div className="divide-y divide-warm-grey/30">
            {loadingList ? (
              <div className="p-6 text-center font-mono text-xs text-warm-grey-dark">
                Loading submissions...
              </div>
            ) : pageData.items.length === 0 ? (
              <div className="p-8 text-center font-sans text-xs text-warm-grey-dark">
                No submissions match the selected filter.
              </div>
            ) : (
              pageData.items.map((item) => {
                const isSelected = item.id === selectedId;
                const displayName =
                  'full_name' in item
                    ? item.full_name
                    : 'applicant_name' in item
                      ? item.applicant_name
                      : item.name;
                const subline =
                  'service_required' in item
                    ? `${item.service_required}${
                        item.project_location ? ` · ${item.project_location}` : ''
                      }`
                    : 'vacancy_title' in item
                      ? item.vacancy_title || 'General Application'
                      : `${item.project_reference || 'General Feedback'}${
                          item.rating != null ? ` · ${item.rating}/5` : ''
                        }`;
                const hasAttachment =
                  'has_attachment' in item && item.has_attachment;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setBanner(null);
                    }}
                    className={`w-full text-left p-4 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-ivory border-l-2 border-l-bronze'
                        : 'hover:bg-ivory/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                      <span
                        className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border ${statusBadgeClass(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                      <div className="flex items-center gap-2">
                        {hasAttachment && (
                          <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-bronze/50 bg-white text-bronze">
                            Attachment
                          </span>
                        )}
                        {'already_promoted' in item && item.already_promoted && (
                          <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-emerald-300 bg-emerald-50 text-emerald-800">
                            Promoted
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-warm-grey-dark">
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>
                    </div>
                    <p className="font-sans text-sm font-semibold text-charcoal truncate">
                      {displayName}
                    </p>
                    <p className="font-sans text-xs text-warm-grey-dark truncate mt-0.5">
                      {subline}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          <div className="border-t border-warm-grey/40 p-3 bg-ivory flex items-center justify-between text-xs font-mono">
            <span>
              Page {pageData.page} of {pageData.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={loadingList || pageData.page <= 1}
                onClick={() => void fetchList(pageData.page - 1)}
                aria-label="Previous page"
                className="p-1.5 border border-warm-grey/60 bg-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={loadingList || pageData.page >= pageData.totalPages}
                onClick={() => void fetchList(pageData.page + 1)}
                aria-label="Next page"
                className="p-1.5 border border-warm-grey/60 bg-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Submission Detail, Private Attachment Download & Processing Form */}
        <div className="lg:col-span-7 bg-white border border-warm-grey/60 p-6 space-y-6">
          {loadingDetail ? (
            <p className="font-mono text-xs text-warm-grey-dark">
              Loading submission details...
            </p>
          ) : !detail ? (
            <p className="font-sans text-xs text-warm-grey-dark">
              Select a submission record from the list to inspect full details.
            </p>
          ) : (
            <>
              <div className="border-b border-warm-grey/30 pb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-warm-grey-dark block">
                    Record ID: {detail.id}
                  </span>
                  <h3 className="font-serif text-2xl text-charcoal mt-0.5">
                    {'full_name' in detail
                      ? detail.full_name
                      : 'applicant_name' in detail
                        ? detail.applicant_name
                        : detail.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-sans text-charcoal/85">
                    {detail.email && (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-bronze" aria-hidden="true" />
                        <span>{detail.email}</span>
                      </span>
                    )}
                    {'phone' in detail && detail.phone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-bronze" aria-hidden="true" />
                        <span>{detail.phone}</span>
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border ${statusBadgeClass(
                    detail.status
                  )}`}
                >
                  {detail.status}
                </span>
              </div>

              {/* Submission Metadata & Body */}
              <div className="space-y-4">
                {'service_required' in detail && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-ivory border border-warm-grey/40 p-4 text-xs">
                    <div>
                      <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                        Service Required
                      </span>
                      <span className="font-sans font-semibold text-charcoal">
                        {detail.service_required}
                      </span>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                        Location
                      </span>
                      <span className="font-sans text-charcoal">
                        {detail.project_location || 'Unspecified'}
                      </span>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                        Preferred Contact
                      </span>
                      <span className="font-sans uppercase text-charcoal">
                        {detail.preferred_contact || 'Email'}
                      </span>
                    </div>
                  </div>
                )}

                {'vacancy_title' in detail && (
                  <div className="bg-ivory border border-warm-grey/40 p-4 text-xs">
                    <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                      Linked Vacancy Opening
                    </span>
                    <span className="font-sans font-semibold text-charcoal">
                      {detail.vacancy_title || 'General Expression of Interest'}
                    </span>
                  </div>
                )}

                {'rating' in detail && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-ivory border border-warm-grey/40 p-4 text-xs">
                    <div>
                      <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                        Project Reference
                      </span>
                      <span className="font-sans font-semibold text-charcoal">
                        {detail.project_reference || 'Unspecified'}
                      </span>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                        Client Rating
                      </span>
                      <span className="font-mono text-bronze font-semibold">
                        {detail.rating != null ? `${detail.rating} / 5` : 'Not supplied'}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1.5">
                    {'description' in detail
                      ? 'Project Scope Description'
                      : 'cover_letter' in detail
                        ? 'Candidate Cover Letter & Credentials'
                        : 'Customer Evaluation Message'}
                  </span>
                  <div className="border border-warm-grey/50 bg-ivory p-4 text-sm font-sans text-charcoal whitespace-pre-wrap leading-relaxed">
                    {'description' in detail
                      ? detail.description
                      : 'cover_letter' in detail
                        ? detail.cover_letter || 'No cover letter provided.'
                        : detail.message}
                  </div>
                </div>

                {/* Private Attachment Download Card */}
                {'attachment' in detail && detail.attachment && (
                  <div className="border border-bronze/50 bg-ivory p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText
                        className="w-5 h-5 text-bronze shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-bronze block">
                          Bound Private Document (customer-documents)
                        </span>
                        <p className="font-sans text-xs font-semibold text-charcoal truncate">
                          {detail.attachment.file_name}
                        </p>
                        <p className="font-mono text-[10px] text-warm-grey-dark">
                          {detail.attachment.mime_type} ·{' '}
                          {formatBytes(detail.attachment.byte_size)}
                        </p>
                      </div>
                    </div>

                    <a
                      href={detail.attachment.download_path}
                      download={detail.attachment.file_name}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-charcoal text-ivory font-mono text-[11px] uppercase tracking-wider hover:bg-bronze transition-colors shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Download Private File</span>
                    </a>
                  </div>
                )}

                {/* Feedback Promotion to Testimonial Draft */}
                {'already_promoted' in detail && (
                  <div className="border border-warm-grey/50 bg-ivory p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-charcoal font-semibold block">
                        Testimonial Governance Integration
                      </span>
                      <p className="font-sans text-xs text-warm-grey-dark mt-0.5">
                        Promotes this feedback into an unpublished testimonial draft without exposing private contact details.
                      </p>
                    </div>
                    {detail.already_promoted ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border border-emerald-300 bg-emerald-50 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          Already Promoted
                        </span>
                        <Link
                          href="/admin/testimonials"
                          className="px-3 py-1.5 border border-charcoal bg-white text-charcoal font-mono text-[10px] uppercase tracking-wider"
                        >
                          Open Testimonials
                        </Link>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handlePromoteFeedback(detail.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-charcoal text-ivory font-mono text-[10px] uppercase tracking-wider hover:bg-bronze disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Promote to Testimonial Draft</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Processing Status & Internal Notes Form */}
              <form
                onSubmit={handleSave}
                className="border-t border-warm-grey/30 pt-5 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="submission-status-select"
                      className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                    >
                      Processing Status
                    </label>
                    <select
                      id="submission-status-select"
                      disabled={busy}
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm uppercase font-mono"
                    >
                      {statusOptions.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="submission-admin-notes"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Internal Staff Notes (Private — Never Visible Publicly)
                  </label>
                  <textarea
                    id="submission-admin-notes"
                    rows={3}
                    disabled={busy}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Record triage notes, follow-up dates, or internal assessment..."
                    className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-5 py-2 bg-charcoal text-ivory font-mono text-[11px] uppercase tracking-wider hover:bg-bronze disabled:opacity-50 cursor-pointer"
                  >
                    Save Processing Update
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
