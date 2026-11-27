'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileUp,
  Lock,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  APPROVED_PUBLIC_STATEMENT,
  INCIDENT_CATEGORY_LABELS,
  INSURANCE_ENQUIRY_STATUSES,
  INSURANCE_REQUEST_TYPE_LABELS,
  INSURANCE_STATUS_LABELS,
  type AdminInsuranceWorkspaceSnapshot,
  type InsuranceEnquiryCounts,
  type InsuranceEnquiryDetail,
  type InsuranceEnquiryStatus,
  type InsuranceEnquirySummary,
} from '@/lib/cms/insuranceTypes';

interface AdminInsuranceWorkspaceProps {
  initialSnapshot: AdminInsuranceWorkspaceSnapshot;
}

function formatAdelaideDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-AU', {
    timeZone: 'Australia/Adelaide',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeClass(status: InsuranceEnquiryStatus): string {
  switch (status) {
    case 'new':
      return 'bg-amber-50 border-amber-300 text-amber-900';
    case 'under_review':
      return 'bg-sky-50 border-sky-300 text-sky-900';
    case 'awaiting_customer':
      return 'bg-purple-50 border-purple-300 text-purple-900';
    case 'referred_to_insurer':
      return 'bg-indigo-50 border-indigo-300 text-indigo-900';
    case 'closed':
      return 'bg-emerald-50 border-emerald-300 text-emerald-900';
  }
}

export function AdminInsuranceWorkspace({
  initialSnapshot,
}: AdminInsuranceWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'enquiries' | 'policy'>('enquiries');

  // Enquiries state
  const [enquiries, setEnquiries] = useState<InsuranceEnquirySummary[]>(
    initialSnapshot.enquiries
  );
  const [counts, setCounts] = useState<InsuranceEnquiryCounts>(initialSnapshot.counts);
  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<
    'all' | 'information_request' | 'incident_report' | 'urgent'
  >('all');
  const [statusFilter, setStatusFilter] = useState<'all' | InsuranceEnquiryStatus>('all');
  const [loadingList, setLoadingList] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(
    initialSnapshot.enquiries[0]?.id ?? null
  );
  const [detail, setDetail] = useState<InsuranceEnquiryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingEnquiry, setSavingEnquiry] = useState(false);

  // Editable detail fields
  const [editStatus, setEditStatus] = useState<InsuranceEnquiryStatus>('new');
  const [editUrgent, setEditUrgent] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editFollowUp, setEditFollowUp] = useState('');

  // Policy Compliance state
  const initialRecord = initialSnapshot.policyRecord;
  const [providerName, setProviderName] = useState(initialRecord?.provider_name || '');
  const [namedInsured, setNamedInsured] = useState(
    initialRecord?.named_insured || 'Strovyn Painting Co.'
  );
  const [policyNumber, setPolicyNumber] = useState(initialRecord?.policy_number || '');
  const [coverageLimitAud, setCoverageLimitAud] = useState<number | ''>(
    initialRecord?.coverage_limit_aud || ''
  );
  const [commencementDate, setCommencementDate] = useState(
    initialRecord?.policy_commencement_date || ''
  );
  const [expiryDate, setExpiryDate] = useState(initialRecord?.policy_expiry_date || '');
  const [certificateStoragePath, setCertificateStoragePath] = useState(
    initialRecord?.certificate_storage_path || ''
  );
  const [exclusionsSummary, setExclusionsSummary] = useState(
    initialRecord?.exclusions_summary || ''
  );
  const [publicStatement, setPublicStatement] = useState(
    initialRecord?.public_statement || APPROVED_PUBLIC_STATEMENT
  );
  const [isPublished, setIsPublished] = useState(initialRecord?.is_published || false);
  const [isExpired, setIsExpired] = useState(Boolean(initialRecord?.is_expired));
  const [uploadingCert, setUploadingCert] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const refreshEnquiryList = useCallback(
    async (
      nextSearch = searchQuery,
      nextKind = kindFilter,
      nextStatus = statusFilter
    ) => {
      setLoadingList(true);
      try {
        const params = new URLSearchParams();
        if (nextSearch.trim()) params.set('search', nextSearch.trim());
        if (nextKind !== 'all') params.set('kind', nextKind);
        if (nextStatus !== 'all') params.set('status', nextStatus);

        const res = await fetch(`/api/admin/insurance/enquiries?${params.toString()}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          setEnquiries(data.items || []);
          if (data.counts) setCounts(data.counts);
        }
      } finally {
        setLoadingList(false);
      }
    },
    [searchQuery, kindFilter, statusFilter]
  );

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/insurance/enquiries/${id}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.enquiry) {
        setErrorMsg(data?.error?.message || 'Unable to load enquiry record.');
        return;
      }
      const d = data.enquiry as InsuranceEnquiryDetail;
      setDetail(d);
      setEditStatus(d.status);
      setEditUrgent(d.is_urgent);
      setEditNotes(d.internal_notes || '');
      setEditFollowUp(d.follow_up_actions || '');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  const applyEnquiryPatch = async (
    patchPayload: Record<string, unknown>,
    toastMessage: string
  ) => {
    if (!detail) return;
    setSavingEnquiry(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/insurance/enquiries/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.enquiry) {
        throw new Error(data?.error?.message || 'Unable to update enquiry.');
      }
      const updated = data.enquiry as InsuranceEnquiryDetail;
      setDetail(updated);
      setEditStatus(updated.status);
      setEditUrgent(updated.is_urgent);
      setEditNotes(updated.internal_notes || '');
      setEditFollowUp(updated.follow_up_actions || '');
      setSuccessMsg(toastMessage);
      await refreshEnquiryList();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSavingEnquiry(false);
    }
  };

  const buildExportHref = (): string => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (kindFilter !== 'all') params.set('kind', kindFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const qs = params.toString();
    return qs
      ? `/api/admin/insurance/enquiries/export?${qs}`
      : '/api/admin/insurance/enquiries/export';
  };

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadingCert(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/insurance/certificate', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || 'Certificate upload failed.');
      }
      setCertificateStoragePath(data.storagePath);
      setSuccessMsg(`Certificate uploaded privately: ${data.fileName}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingCert(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const todayStr = new Date().toISOString().slice(0, 10);
    const nextExpired = Boolean(expiryDate && expiryDate < todayStr);
    setIsExpired(nextExpired);

    if (isPublished) {
      if (!providerName.trim() || !namedInsured.trim() || !policyNumber.trim()) {
        setErrorMsg('Insurer name, named insured, and policy number are required to publish.');
        return;
      }
      if (!coverageLimitAud || coverageLimitAud <= 0) {
        setErrorMsg('Coverage limit must be greater than $0 AUD to publish.');
        return;
      }
      if (!certificateStoragePath) {
        setErrorMsg('Upload a verified Certificate of Currency before publishing.');
        return;
      }
      if (nextExpired) {
        setErrorMsg(`Cannot publish an expired policy (${expiryDate}).`);
        return;
      }
    }

    setSavingPolicy(true);
    try {
      const res = await fetch('/api/admin/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_name: providerName,
          named_insured: namedInsured,
          policy_number: policyNumber,
          coverage_limit_aud: Number(coverageLimitAud || 0),
          policy_commencement_date: commencementDate,
          policy_expiry_date: expiryDate,
          certificate_storage_path: certificateStoragePath || null,
          exclusions_summary: exclusionsSummary || null,
          public_statement: publicStatement,
          is_published: isPublished,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || 'Failed to save policy record.');
      }
      setIsExpired(Boolean(data.insurance?.is_expired));
      setSuccessMsg(
        isPublished
          ? 'Policy verified and published.'
          : 'Policy saved as UNPUBLISHED draft. Public site makes no active coverage claims.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSavingPolicy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Urgent Incident Banner */}
      <div className="bg-white border border-warm-grey/60 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze">
                INSURANCE &amp; INCIDENT GOVERNANCE
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-charcoal/5 text-charcoal border border-charcoal/20">
                <Lock className="w-3 h-3 text-bronze" aria-hidden="true" />
                Admin Only
              </span>
            </div>
            <h1 className="type-section-title text-3xl text-charcoal">
              Public Liability Enquiries &amp; Incidents
            </h1>
            <p className="font-sans text-sm text-charcoal/75 mt-1">
              Review customer insurance enquiries, triage incident notifications, inspect private supporting photos, and govern policy publication.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('enquiries');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border transition-colors cursor-pointer ${
                activeTab === 'enquiries'
                  ? 'bg-charcoal text-ivory border-charcoal'
                  : 'bg-white text-charcoal border-warm-grey hover:border-charcoal'
              }`}
            >
              Enquiries &amp; Incidents ({counts.openCount} Open)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('policy');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border transition-colors cursor-pointer ${
                activeTab === 'policy'
                  ? 'bg-charcoal text-ivory border-charcoal'
                  : 'bg-white text-charcoal border-warm-grey hover:border-charcoal'
              }`}
            >
              Policy &amp; Certificate
            </button>
          </div>
        </div>

        {counts.urgentOpenCount > 0 && (
          <div
            role="alert"
            className="p-4 bg-red-50 border-l-4 border-brand-red text-red-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 text-xs font-sans">
              <AlertTriangle className="w-4 h-4 text-brand-red shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <strong className="font-semibold block">
                  {counts.urgentOpenCount} Unresolved Incident / Urgent Notification(s) Require Review
                </strong>
                <span>
                  Note: Incident reports are not automatically transmitted to any insurer. Review details below and coordinate follow-up directly.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab('enquiries');
                setKindFilter('incident_report');
                void refreshEnquiryList(searchQuery, 'incident_report', statusFilter);
              }}
              className="px-3 py-1.5 bg-brand-red text-white text-[11px] font-mono uppercase tracking-wider shrink-0 cursor-pointer"
            >
              Filter Incidents
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-300 text-red-900 text-sm flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm flex items-start gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {activeTab === 'enquiries' ? (
        <div className="space-y-6">
          {/* Operational Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white border border-warm-grey/60 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark block">
                Total Logged
              </span>
              <span className="type-metric text-2xl text-charcoal">{counts.total}</span>
            </div>
            <div className="bg-white border border-warm-grey/60 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark block">
                Open Queue
              </span>
              <span className="type-metric text-2xl text-charcoal">{counts.openCount}</span>
            </div>
            <div className="bg-white border border-warm-grey/60 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-brand-red block">
                Urgent / New Incidents
              </span>
              <span className="type-metric text-2xl text-brand-red">{counts.urgentOpenCount}</span>
            </div>
            <div className="bg-white border border-warm-grey/60 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark block">
                Info Requests
              </span>
              <span className="type-metric text-2xl text-charcoal">{counts.infoRequestCount}</span>
            </div>
            <div className="bg-white border border-warm-grey/60 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark block">
                Incident Reports
              </span>
              <span className="type-metric text-2xl text-charcoal">{counts.incidentReportCount}</span>
            </div>
          </div>

          {/* Search, Filter & Export Toolbar */}
          <div className="bg-white border border-warm-grey/60 p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void refreshEnquiryList(searchQuery, kindFilter, statusFilter);
              }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1"
            >
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  className="w-4 h-4 text-warm-grey-dark absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reference, name, email, suburb..."
                  className="w-full pl-9 pr-3 py-2 border border-warm-grey text-xs font-sans text-charcoal focus:outline-none focus:border-charcoal"
                />
              </div>

              <select
                aria-label="Filter by submission kind"
                value={kindFilter}
                onChange={(e) => {
                  const next = e.target.value as typeof kindFilter;
                  setKindFilter(next);
                  void refreshEnquiryList(searchQuery, next, statusFilter);
                }}
                className="px-3 py-2 border border-warm-grey text-xs font-sans text-charcoal bg-white"
              >
                <option value="all">All Types</option>
                <option value="information_request">Information Requests</option>
                <option value="incident_report">Incident Reports</option>
                <option value="urgent">Urgent Flagged Only</option>
              </select>

              <select
                aria-label="Filter by workflow status"
                value={statusFilter}
                onChange={(e) => {
                  const next = e.target.value as typeof statusFilter;
                  setStatusFilter(next);
                  void refreshEnquiryList(searchQuery, kindFilter, next);
                }}
                className="px-3 py-2 border border-warm-grey text-xs font-sans text-charcoal bg-white"
              >
                <option value="all">All Statuses</option>
                {INSURANCE_ENQUIRY_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {INSURANCE_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={loadingList}
                className="px-4 py-2 bg-charcoal text-ivory text-xs font-mono uppercase tracking-wider hover:bg-bronze transition-colors cursor-pointer"
              >
                {loadingList ? 'Filtering...' : 'Search'}
              </button>
            </form>

            <a
              href={buildExportHref()}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-charcoal text-charcoal hover:bg-charcoal hover:text-ivory text-xs font-mono uppercase tracking-wider transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </a>
          </div>

          {/* Master-Detail Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Queue List */}
            <div className="lg:col-span-5 bg-white border border-warm-grey/60 divide-y divide-warm-grey/30">
              {enquiries.length === 0 ? (
                <div className="p-8 text-center font-sans text-xs text-warm-grey-dark">
                  No insurance enquiries or incident reports match the current filter.
                </div>
              ) : (
                enquiries.map((item) => {
                  const selected = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full text-left p-4 transition-colors cursor-pointer block space-y-2 ${
                        selected ? 'bg-ivory border-l-4 border-bronze' : 'hover:bg-ivory/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-charcoal">
                          {item.reference_code}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${getStatusBadgeClass(
                            item.status
                          )}`}
                        >
                          {INSURANCE_STATUS_LABELS[item.status]}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-mono uppercase ${
                            item.enquiry_kind === 'incident_report'
                              ? 'bg-charcoal text-white'
                              : 'bg-warm-grey/25 text-charcoal'
                          }`}
                        >
                          {item.enquiry_kind === 'incident_report'
                            ? 'Incident Report'
                            : 'Info Request'}
                        </span>
                        {item.is_urgent && (
                          <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-brand-red text-white">
                            Urgent
                          </span>
                        )}
                        {item.attachment_count > 0 && (
                          <span className="text-[10px] font-mono text-bronze">
                            · {item.attachment_count} photo(s)
                          </span>
                        )}
                      </div>

                      <div className="font-sans text-xs text-charcoal">
                        <strong>{item.full_name}</strong> · {item.email}
                      </div>
                      <div className="font-mono text-[10px] text-warm-grey-dark">
                        Logged {formatAdelaideDateTime(item.created_at)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Right Detail Inspector */}
            <div className="lg:col-span-7 bg-white border border-warm-grey/60 p-6 space-y-6">
              {loadingDetail ? (
                <p className="font-mono text-xs uppercase tracking-wider text-warm-grey-dark py-8 text-center">
                  Loading confidential submission record...
                </p>
              ) : !detail ? (
                <p className="font-sans text-xs text-warm-grey-dark py-8 text-center">
                  Select an enquiry or incident report from the queue to inspect details.
                </p>
              ) : (
                <>
                  {/* Record Header & Quick Review / Close Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-warm-grey/30 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-semibold text-charcoal">
                          {detail.reference_code}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono uppercase border ${getStatusBadgeClass(
                            detail.status
                          )}`}
                        >
                          {INSURANCE_STATUS_LABELS[detail.status]}
                        </span>
                        {detail.is_urgent && (
                          <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-brand-red text-white">
                            Urgent Priority
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-warm-grey-dark">
                        Submitted {formatAdelaideDateTime(detail.created_at)}
                        {detail.reviewed_at &&
                          ` · Reviewed ${formatAdelaideDateTime(detail.reviewed_at)}`}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!detail.reviewed_at && (
                        <button
                          type="button"
                          disabled={savingEnquiry}
                          onClick={() =>
                            void applyEnquiryPatch(
                              { mark_reviewed: true },
                              `Marked ${detail.reference_code} as reviewed.`
                            )
                          }
                          className="px-3 py-1.5 bg-bronze text-white text-[11px] font-mono uppercase tracking-wider hover:opacity-90 cursor-pointer disabled:opacity-50"
                        >
                          Mark Reviewed
                        </button>
                      )}
                      {detail.status !== 'closed' && (
                        <button
                          type="button"
                          disabled={savingEnquiry}
                          onClick={() =>
                            void applyEnquiryPatch(
                              { status: 'closed' },
                              `Closed resolved enquiry ${detail.reference_code}.`
                            )
                          }
                          className="px-3 py-1.5 border border-charcoal text-charcoal hover:bg-charcoal hover:text-ivory text-[11px] font-mono uppercase tracking-wider cursor-pointer disabled:opacity-50"
                        >
                          Close Resolved
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Customer & Submission Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans bg-ivory/60 p-4 border border-warm-grey/30">
                    <div>
                      <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                        Submitter Name
                      </span>
                      <strong className="text-charcoal">{detail.full_name}</strong>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                        Email
                      </span>
                      <a href={`mailto:${detail.email}`} className="text-bronze underline">
                        {detail.email}
                      </a>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                        Contact Phone
                      </span>
                      <span className="text-charcoal">{detail.phone || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                        Project Location / Suburb
                      </span>
                      <span className="text-charcoal">
                        {detail.project_location || 'Not provided'}
                      </span>
                    </div>
                  </div>

                  {detail.enquiry_kind === 'information_request' ? (
                    <div className="space-y-3 text-xs font-sans">
                      <div>
                        <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                          Request Type
                        </span>
                        <strong className="text-charcoal">
                          {detail.request_type
                            ? INSURANCE_REQUEST_TYPE_LABELS[detail.request_type]
                            : 'General'}
                        </strong>
                      </div>
                      <div>
                        <span className="font-mono text-[10px] uppercase text-warm-grey-dark block mb-1">
                          Customer Message
                        </span>
                        <div className="p-3.5 bg-ivory/40 border border-warm-grey/30 whitespace-pre-line leading-relaxed text-charcoal">
                          {detail.message || 'No additional message provided.'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 text-xs font-sans">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                            Incident Date
                          </span>
                          <strong className="text-charcoal">{detail.incident_date}</strong>
                        </div>
                        <div>
                          <span className="font-mono text-[10px] uppercase text-warm-grey-dark block">
                            Incident Category
                          </span>
                          <strong className="text-charcoal">
                            {detail.incident_category
                              ? INCIDENT_CATEGORY_LABELS[detail.incident_category]
                              : 'Other'}
                          </strong>
                        </div>
                      </div>

                      <div>
                        <span className="font-mono text-[10px] uppercase text-warm-grey-dark block mb-1">
                          Factual Incident Description
                        </span>
                        <div className="p-3.5 bg-ivory/40 border border-warm-grey/30 whitespace-pre-line leading-relaxed text-charcoal">
                          {detail.incident_description}
                        </div>
                      </div>

                      {/* Private Supporting Photographs */}
                      <div>
                        <span className="font-mono text-[10px] uppercase text-warm-grey-dark block mb-1.5">
                          Private Supporting Photographs ({detail.attachments.length})
                        </span>
                        {detail.attachments.length === 0 ? (
                          <p className="text-warm-grey-dark">No photographs attached.</p>
                        ) : (
                          <ul className="space-y-2">
                            {detail.attachments.map((att) => (
                              <li
                                key={att.id}
                                className="flex items-center justify-between gap-3 p-2.5 border border-warm-grey/40 bg-ivory/40"
                              >
                                <div className="min-w-0">
                                  <span className="font-mono text-xs text-charcoal block truncate">
                                    {att.original_label}
                                  </span>
                                  <span className="font-mono text-[10px] text-warm-grey-dark">
                                    {att.mime_type} · {Math.max(1, Math.round(att.byte_size / 1024))} KB · Retain until{' '}
                                    {att.retention_until.slice(0, 10)}
                                  </span>
                                </div>
                                <a
                                  href={`/api/admin/insurance/attachments/${att.id}`}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-charcoal text-ivory text-[10px] font-mono uppercase tracking-wider hover:bg-bronze shrink-0"
                                >
                                  <Download className="w-3 h-3" aria-hidden="true" />
                                  <span>Download</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Workflow Management Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void applyEnquiryPatch(
                        {
                          status: editStatus,
                          is_urgent: editUrgent,
                          internal_notes: editNotes,
                          follow_up_actions: editFollowUp,
                        },
                        `Saved workflow updates for ${detail.reference_code}.`
                      );
                    }}
                    className="pt-4 border-t border-warm-grey/40 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div>
                        <label
                          htmlFor="admin-ins-status"
                          className="block font-mono text-[10px] uppercase tracking-wider text-charcoal/80 mb-1"
                        >
                          Workflow Status
                        </label>
                        <select
                          id="admin-ins-status"
                          value={editStatus}
                          onChange={(e) =>
                            setEditStatus(e.target.value as InsuranceEnquiryStatus)
                          }
                          className="w-full px-3 py-2 border border-warm-grey text-xs font-sans text-charcoal bg-white"
                        >
                          {INSURANCE_ENQUIRY_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {INSURANCE_STATUS_LABELS[st]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="flex items-center gap-2.5 cursor-pointer pt-4">
                        <input
                          type="checkbox"
                          checked={editUrgent}
                          onChange={(e) => setEditUrgent(e.target.checked)}
                          className="w-4 h-4 accent-brand-red"
                        />
                        <span className="font-sans text-xs font-medium text-charcoal">
                          Flag as Urgent Attention
                        </span>
                      </label>
                    </div>

                    {editStatus === 'referred_to_insurer' && (
                      <p className="p-2.5 bg-indigo-50 border border-indigo-200 text-[11px] font-sans text-indigo-950">
                        Manual tracking status only: changing status to &ldquo;Referred to Insurer&rdquo; records your internal workflow step and does not transmit data externally.
                      </p>
                    )}

                    <div>
                      <label
                        htmlFor="admin-ins-notes"
                        className="block font-mono text-[10px] uppercase tracking-wider text-charcoal/80 mb-1"
                      >
                        Internal Notes (Private to Admin)
                      </label>
                      <textarea
                        id="admin-ins-notes"
                        rows={3}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Record internal investigation notes, verification checks, or site supervisor observations..."
                        className="w-full px-3 py-2 border border-warm-grey text-xs font-sans text-charcoal"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="admin-ins-followup"
                        className="block font-mono text-[10px] uppercase tracking-wider text-charcoal/80 mb-1"
                      >
                        Follow-Up Actions Recorded
                      </label>
                      <textarea
                        id="admin-ins-followup"
                        rows={2}
                        value={editFollowUp}
                        onChange={(e) => setEditFollowUp(e.target.value)}
                        placeholder="e.g. Phoned client on 28 Nov; provided policy confirmation directly via email..."
                        className="w-full px-3 py-2 border border-warm-grey text-xs font-sans text-charcoal"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingEnquiry}
                      className="px-5 py-2.5 bg-charcoal text-ivory hover:bg-bronze text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {savingEnquiry ? 'Saving...' : 'Save Workflow Updates'}
                    </button>
                  </form>

                  {/* Audit Log */}
                  {detail.audit_log.length > 0 && (
                    <div className="pt-4 border-t border-warm-grey/30 space-y-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark block">
                        Audit Trail
                      </span>
                      <ul className="space-y-1 max-h-40 overflow-y-auto text-[11px] font-mono text-charcoal/75">
                        {detail.audit_log.map((ev) => (
                          <li key={ev.id} className="flex items-center justify-between gap-2">
                            <span>
                              {ev.action}
                              {ev.to_status ? ` → ${ev.to_status}` : ''}
                            </span>
                            <span className="text-warm-grey-dark">
                              {formatAdelaideDateTime(ev.created_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Tab 2: Compatible Policy & Certificate Governance */
        <form onSubmit={handleSavePolicy} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-white border border-warm-grey/60 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-warm-grey/30 pb-3">
              <h2 className="font-sans text-base font-semibold text-charcoal flex items-center gap-2">
                <Lock className="w-4 h-4 text-bronze" aria-hidden="true" />
                Private Policy &amp; Certificate Governance
              </h2>
              {isPublished && !isExpired ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-mono uppercase">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Published
                </span>
              ) : isPublished && isExpired ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-mono uppercase">
                  <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                  Expired (Auto-Suppressed)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-charcoal/5 border border-charcoal/20 text-charcoal text-[10px] font-mono uppercase">
                  <Shield className="w-3.5 h-3.5 text-bronze" aria-hidden="true" />
                  Unpublished (Default)
                </span>
              )}
            </div>

            <p className="font-sans text-xs text-charcoal/70 leading-relaxed">
              Keep policy publication disabled until genuine client-verified insurance documentation is uploaded. Customer enquiries and incident reports operate independently even while policy details remain unpublished.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                  Insurer / Provider Name
                </label>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                  Named Insured
                </label>
                <input
                  type="text"
                  value={namedInsured}
                  onChange={(e) => setNamedInsured(e.target.value)}
                  className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                  Policy Number (Private)
                </label>
                <input
                  type="text"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                  Coverage Limit ($ AUD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100000"
                  value={coverageLimitAud}
                  onChange={(e) =>
                    setCoverageLimitAud(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                  Commencement Date
                </label>
                <input
                  type="date"
                  value={commencementDate}
                  onChange={(e) => setCommencementDate(e.target.value)}
                  className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-warm-grey/30 space-y-2">
              <span className="block text-xs font-mono uppercase tracking-wider text-charcoal/80">
                Certificate of Currency (Private Storage)
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 border border-charcoal text-xs font-mono uppercase tracking-wider text-charcoal hover:bg-charcoal hover:text-ivory cursor-pointer transition-colors">
                  <FileUp className="w-4 h-4 text-bronze" aria-hidden="true" />
                  <span>{uploadingCert ? 'Uploading...' : 'Upload Certificate'}</span>
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    disabled={uploadingCert}
                    onChange={handleCertUpload}
                    className="sr-only"
                  />
                </label>
                {certificateStoragePath && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-charcoal">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    <span>{certificateStoragePath.split('/').pop()}</span>
                    <a
                      href={`/api/admin/insurance/certificate?path=${encodeURIComponent(
                        certificateStoragePath
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-bronze underline ml-1"
                    >
                      Download
                    </a>
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                Internal Exclusions / Notes
              </label>
              <textarea
                rows={2}
                value={exclusionsSummary}
                onChange={(e) => setExclusionsSummary(e.target.value)}
                className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal"
              />
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-warm-grey/60 p-6 space-y-5 h-fit">
            <h2 className="font-sans text-base font-semibold text-charcoal">
              Public Statement Publication
            </h2>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                Public Policy Statement
              </label>
              <textarea
                rows={4}
                value={publicStatement}
                onChange={(e) => setPublicStatement(e.target.value)}
                className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-warm-grey/30">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="mt-1 w-4 h-4 accent-charcoal"
              />
              <div>
                <span className="block text-sm font-semibold text-charcoal">
                  Authorize Public Policy Statement
                </span>
                <span className="font-sans text-xs text-charcoal/70 block mt-0.5 leading-relaxed">
                  Leave unchecked unless verified Certificate of Currency documentation is on file and active.
                </span>
              </div>
            </label>

            <button
              type="submit"
              disabled={savingPolicy || uploadingCert}
              className="w-full py-3 bg-charcoal text-ivory hover:bg-bronze font-mono text-xs uppercase tracking-[0.2em] transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingPolicy ? 'Saving...' : 'Save Policy Record'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
