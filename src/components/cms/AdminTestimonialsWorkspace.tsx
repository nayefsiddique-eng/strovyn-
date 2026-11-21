'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  MessageSquarePlus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import type { StaffViewerIdentity } from './StaffAuthGateCards';
import type {
  PromotableFeedbackRecord,
  TestimonialModerationEventRecord,
  TestimonialRecord,
} from '@/lib/cms/testimonialsService';

type FilterTab =
  | 'all'
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'hidden';

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending_review', label: 'Pending Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'published', label: 'Published' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'hidden', label: 'Hidden' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Australia/Adelaide',
  });
}

function statusBadgeClass(t: TestimonialRecord): string {
  if (t.is_published) {
    return 'bg-emerald-50 text-emerald-800 border-emerald-300';
  }
  switch (t.moderation_status) {
    case 'approved':
      return 'bg-sky-50 text-sky-800 border-sky-300';
    case 'pending_review':
      return 'bg-amber-50 text-amber-800 border-amber-300';
    case 'rejected':
      return 'bg-red-50 text-red-800 border-red-300';
    case 'hidden':
      return 'bg-stone-100 text-stone-700 border-stone-300';
    case 'draft':
    default:
      return 'bg-ivory text-charcoal border-warm-grey/60';
  }
}

function statusLabel(t: TestimonialRecord): string {
  if (t.is_published) return 'Published';
  switch (t.moderation_status) {
    case 'pending_review':
      return 'Pending Review';
    case 'approved':
      return 'Approved (Unpublished)';
    case 'rejected':
      return 'Rejected';
    case 'hidden':
      return 'Hidden';
    case 'draft':
    default:
      return 'Draft';
  }
}

export function AdminTestimonialsWorkspace({
  staff,
  initialTestimonials,
}: {
  staff: StaffViewerIdentity;
  initialTestimonials: TestimonialRecord[];
}) {
  const router = useRouter();
  const canModerate = staff.role === 'publisher' || staff.role === 'admin';

  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>(initialTestimonials);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(
    initialTestimonials[0]?.id ?? null
  );

  // Selected detail + moderation history
  const [events, setEvents] = useState<TestimonialModerationEventRecord[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Feedback message / error banner
  const [banner, setBanner] = useState<{
    type: 'success' | 'error' | 'conflict';
    message: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // Create new testimonial modal state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newProjectRef, setNewProjectRef] = useState('');
  const [newSpecification, setNewSpecification] = useState('');
  const [newRating, setNewRating] = useState<string>('');
  const [newConsentVerified, setNewConsentVerified] = useState(false);
  const [newConsentEvidence, setNewConsentEvidence] = useState('');

  // Promote from feedback drawer
  const [showPromotePanel, setShowPromotePanel] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<PromotableFeedbackRecord[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // Selected testimonial edit state
  const selected = useMemo(
    () => testimonials.find((t) => t.id === selectedId) ?? null,
    [testimonials, selectedId]
  );

  const [editCustomerName, setEditCustomerName] = useState(selected?.customer_name ?? '');
  const [editContent, setEditContent] = useState(selected?.content ?? '');
  const [editRole, setEditRole] = useState(selected?.customer_role ?? '');
  const [editLocation, setEditLocation] = useState(selected?.location ?? '');
  const [editProjectRef, setEditProjectRef] = useState(selected?.project_reference ?? '');
  const [editSpecification, setEditSpecification] = useState(selected?.specification ?? '');
  const [editRating, setEditRating] = useState<string>(
    selected?.rating != null ? String(selected.rating) : ''
  );
  const [editConsentVerified, setEditConsentVerified] = useState<boolean>(
    selected?.consent_verified ?? false
  );
  const [editConsentEvidence, setEditConsentEvidence] = useState<string>(
    selected?.consent_evidence ?? ''
  );
  const [rejectReason, setRejectReason] = useState('');
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [unpublishConfirmed, setUnpublishConfirmed] = useState(false);
  const [conflictLatest, setConflictLatest] = useState<TestimonialRecord | null>(null);

  const syncFormFromRecord = (record: TestimonialRecord | null) => {
    setEditCustomerName(record?.customer_name ?? '');
    setEditContent(record?.content ?? '');
    setEditRole(record?.customer_role ?? '');
    setEditLocation(record?.location ?? '');
    setEditProjectRef(record?.project_reference ?? '');
    setEditSpecification(record?.specification ?? '');
    setEditRating(record?.rating != null ? String(record.rating) : '');
    setEditConsentVerified(record?.consent_verified ?? false);
    setEditConsentEvidence(record?.consent_evidence ?? '');
    setRejectReason('');
    setPublishConfirmed(false);
    setUnpublishConfirmed(false);
    setConflictLatest(null);
  };

  const loadDetailAndEvents = async (id: string) => {
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.testimonial) {
        setTestimonials((prev) =>
          prev.map((item) => (item.id === id ? data.testimonial : item))
        );
        setEvents(data.events ?? []);
        syncFormFromRecord(data.testimonial);
      }
    } catch {
      // Ignore transient fetch errors on background detail load
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSelectTestimonial = (record: TestimonialRecord) => {
    setSelectedId(record.id);
    setBanner(null);
    syncFormFromRecord(record);
    void loadDetailAndEvents(record.id);
  };

  const refreshList = async (focusId?: string) => {
    const res = await fetch('/api/admin/testimonials', { cache: 'no-store' });
    const data = await res.json();
    if (res.ok && Array.isArray(data.testimonials)) {
      setTestimonials(data.testimonials);
      const nextId = focusId ?? selectedId ?? data.testimonials[0]?.id ?? null;
      if (nextId) {
        setSelectedId(nextId);
        const match = data.testimonials.find((t: TestimonialRecord) => t.id === nextId);
        if (match) syncFormFromRecord(match);
      }
    }
  };

  const filteredTestimonials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return testimonials.filter((t) => {
      if (activeFilter === 'published' && !t.is_published) return false;
      if (activeFilter === 'approved' && (t.moderation_status !== 'approved' || t.is_published)) {
        return false;
      }
      if (
        (activeFilter === 'draft' ||
          activeFilter === 'pending_review' ||
          activeFilter === 'rejected' ||
          activeFilter === 'hidden') &&
        t.moderation_status !== activeFilter
      ) {
        return false;
      }
      if (!q) return true;
      return [
        t.customer_name,
        t.content,
        t.customer_role ?? '',
        t.location ?? '',
        t.project_reference ?? '',
        t.specification ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [testimonials, activeFilter, searchQuery]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/admin/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: newCustomerName,
          content: newContent,
          customer_role: newRole || null,
          location: newLocation || null,
          project_reference: newProjectRef || null,
          specification: newSpecification || null,
          rating: newRating ? Number(newRating) : null,
          consent_verified: newConsentVerified,
          consent_evidence: newConsentEvidence || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'error', message: data.error ?? 'Failed to create testimonial.' });
        return;
      }
      const created = data.testimonial as TestimonialRecord;
      setTestimonials((prev) => [created, ...prev]);
      setSelectedId(created.id);
      syncFormFromRecord(created);
      setShowCreateForm(false);
      setNewCustomerName('');
      setNewContent('');
      setNewRole('');
      setNewLocation('');
      setNewProjectRef('');
      setNewSpecification('');
      setNewRating('');
      setNewConsentVerified(false);
      setNewConsentEvidence('');
      setBanner({ type: 'success', message: 'Testimonial draft created.' });
      void loadDetailAndEvents(created.id);
    } catch {
      setBanner({ type: 'error', message: 'Network error while creating testimonial.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSelected = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || busy) return;
    setBusy(true);
    setBanner(null);
    setConflictLatest(null);
    try {
      const res = await fetch(`/api/admin/testimonials/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_updated_at: selected.updated_at,
          customer_name: editCustomerName,
          content: editContent,
          customer_role: editRole || null,
          location: editLocation || null,
          project_reference: editProjectRef || null,
          specification: editSpecification || null,
          rating: editRating ? Number(editRating) : null,
          consent_verified: editConsentVerified,
          consent_evidence: editConsentEvidence || null,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        // Fetch latest server record so user can rebase timestamp without losing local text
        const latestRes = await fetch(`/api/admin/testimonials/${selected.id}`, {
          cache: 'no-store',
        });
        const latestData = await latestRes.json().catch(() => null);
        if (latestRes.ok && latestData?.testimonial) {
          setConflictLatest(latestData.testimonial as TestimonialRecord);
        }
        setBanner({
          type: 'conflict',
          message:
            data.error ??
            'This content was updated elsewhere. Your local edits are preserved below.',
        });
        return;
      }
      if (!res.ok) {
        setBanner({ type: 'error', message: data.error ?? 'Failed to save changes.' });
        return;
      }
      const updated = data.testimonial as TestimonialRecord;
      setTestimonials((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      syncFormFromRecord(updated);
      setBanner({ type: 'success', message: 'Testimonial changes saved.' });
      void loadDetailAndEvents(updated.id);
      router.refresh();
    } catch {
      setBanner({ type: 'error', message: 'Network error while saving changes.' });
    } finally {
      setBusy(false);
    }
  };

  const handleRebaseTimestamp = () => {
    if (!conflictLatest) return;
    setTestimonials((prev) =>
      prev.map((t) => (t.id === conflictLatest.id ? conflictLatest : t))
    );
    setConflictLatest(null);
    setBanner({
      type: 'success',
      message: 'Timestamp rebased to latest server version. Click Save Changes to apply.',
    });
  };

  const handleTransition = async (
    action: 'submit-review' | 'approve' | 'reject' | 'publish' | 'unpublish'
  ) => {
    if (!selected || busy) return;
    setBusy(true);
    setBanner(null);
    try {
      const payload: Record<string, unknown> = {
        expected_updated_at: selected.updated_at,
      };
      if (action === 'reject') {
        payload.reason = rejectReason.trim() || 'Rejected during editorial review.';
      }
      if (action === 'publish') {
        payload.confirmed = publishConfirmed;
      }
      if (action === 'unpublish') {
        payload.confirmed = unpublishConfirmed;
      }

      const res = await fetch(`/api/admin/testimonials/${selected.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: res.status === 409 ? 'conflict' : 'error',
          message: data.error ?? `Action ${action} failed.`,
        });
        return;
      }
      const updated = data.testimonial as TestimonialRecord;
      setTestimonials((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      syncFormFromRecord(updated);
      setBanner({
        type: 'success',
        message: `Testimonial updated to "${statusLabel(updated)}".`,
      });
      void loadDetailAndEvents(updated.id);
      router.refresh();
    } catch {
      setBanner({ type: 'error', message: 'Network error during moderation action.' });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleFeatured = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/admin/testimonials/${selected.id}/feature`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_updated_at: selected.updated_at,
          is_featured: !selected.is_featured,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'error', message: data.error ?? 'Failed to update featured flag.' });
        return;
      }
      const updated = data.testimonial as TestimonialRecord;
      setTestimonials((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      syncFormFromRecord(updated);
      setBanner({
        type: 'success',
        message: updated.is_featured
          ? 'Marked as Featured Endorsement.'
          : 'Removed Featured status.',
      });
      router.refresh();
    } catch {
      setBanner({ type: 'error', message: 'Network error updating featured status.' });
    } finally {
      setBusy(false);
    }
  };

  const handleMoveOrder = async (id: string, delta: -1 | 1) => {
    if (!canModerate || busy) return;
    const idx = testimonials.findIndex((t) => t.id === id);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= testimonials.length) return;

    const reordered = [...testimonials];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);
    setTestimonials(reordered);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/testimonials/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ordered_ids: reordered.map((t) => t.id),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBanner({ type: 'error', message: data.error ?? 'Failed to reorder testimonials.' });
        await refreshList(id);
        return;
      }
      setBanner({ type: 'success', message: 'Testimonial display order saved.' });
      router.refresh();
    } catch {
      setBanner({ type: 'error', message: 'Network error saving order.' });
    } finally {
      setBusy(false);
    }
  };

  const handleOpenPromotePanel = async () => {
    setShowPromotePanel((prev) => !prev);
    if (!showPromotePanel) {
      setLoadingFeedback(true);
      try {
        const res = await fetch('/api/admin/testimonials/promote-feedback', {
          cache: 'no-store',
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.feedback)) {
          setFeedbackItems(data.feedback);
        }
      } catch {
        setBanner({ type: 'error', message: 'Failed to load customer feedback.' });
      } finally {
        setLoadingFeedback(false);
      }
    }
  };

  const handlePromoteFeedback = async (feedbackId: string) => {
    if (busy) return;
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
          message: data.error ?? 'Failed to promote feedback.',
        });
        return;
      }
      const created = data.testimonial as TestimonialRecord;
      setTestimonials((prev) => [created, ...prev]);
      setFeedbackItems((prev) =>
        prev.map((fb) =>
          fb.id === feedbackId
            ? { ...fb, already_promoted: true, promoted_testimonial_id: created.id }
            : fb
        )
      );
      setSelectedId(created.id);
      syncFormFromRecord(created);
      setShowPromotePanel(false);
      setBanner({
        type: 'success',
        message:
          'Feedback promoted to Testimonial Draft. Verify customer publication consent before approving or publishing.',
      });
      void loadDetailAndEvents(created.id);
    } catch {
      setBanner({ type: 'error', message: 'Network error promoting feedback.' });
    } finally {
      setBusy(false);
    }
  };

  const canEditSelected =
    selected &&
    (!selected.is_published && selected.moderation_status !== 'approved'
      ? true
      : canModerate);

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="bg-white border border-warm-grey/60 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-bronze block mb-1">
            Client Endorsements
          </span>
          <h2 className="font-serif text-2xl text-charcoal">
            Testimonials &amp; Moderation
          </h2>
          <p className="font-sans text-xs text-warm-grey-dark mt-1">
            Only approved endorsements with documented customer consent can be published to the homepage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canModerate && (
            <button
              type="button"
              onClick={handleOpenPromotePanel}
              className="inline-flex items-center gap-2 px-3 py-2 border border-warm-grey/60 bg-ivory text-charcoal font-mono text-[11px] uppercase tracking-wider hover:border-charcoal cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-bronze" aria-hidden="true" />
              <span>Promote Feedback</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-charcoal text-ivory font-mono text-[11px] uppercase tracking-wider hover:bg-bronze transition-colors cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New Testimonial</span>
          </button>
        </div>
      </div>

      {/* Status Banner */}
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

      {/* Promote from Customer Feedback Panel */}
      {showPromotePanel && canModerate && (
        <div className="bg-white border border-warm-grey/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-warm-grey/30 pb-3">
            <div>
              <h3 className="font-serif text-lg text-charcoal">
                Promote Customer Feedback to Testimonial Draft
              </h3>
              <p className="font-sans text-xs text-warm-grey-dark">
                Private email addresses are hidden. Promoted drafts always start unverified and unpublished.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPromotePanel(false)}
              className="font-mono text-[11px] uppercase tracking-wider text-warm-grey-dark hover:text-charcoal cursor-pointer"
            >
              Close
            </button>
          </div>

          {loadingFeedback ? (
            <p className="font-mono text-xs text-warm-grey-dark">Loading feedback...</p>
          ) : feedbackItems.length === 0 ? (
            <p className="font-sans text-xs text-warm-grey-dark">
              No customer feedback submissions available yet.
            </p>
          ) : (
            <div className="divide-y divide-warm-grey/30">
              {feedbackItems.map((fb) => (
                <div
                  key={fb.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-sans text-sm font-semibold text-charcoal">
                        {fb.name}
                      </span>
                      {fb.project_reference && (
                        <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-ivory border border-warm-grey/50 text-charcoal">
                          {fb.project_reference}
                        </span>
                      )}
                      {typeof fb.rating === 'number' && (
                        <span className="font-mono text-[10px] text-bronze">
                          {fb.rating}/5
                        </span>
                      )}
                    </div>
                    <p className="font-sans text-xs text-charcoal/85 line-clamp-2">
                      &ldquo;{fb.message}&rdquo;
                    </p>
                  </div>
                  <div className="shrink-0">
                    {fb.already_promoted ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border border-emerald-300 bg-emerald-50 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                        Already Promoted
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handlePromoteFeedback(fb.id)}
                        className="px-3 py-1.5 bg-charcoal text-ivory font-mono text-[10px] uppercase tracking-wider hover:bg-bronze disabled:opacity-50 cursor-pointer"
                      >
                        Promote to Testimonial Draft
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Testimonial Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-white border border-warm-grey/60 p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-warm-grey/30 pb-3">
            <h3 className="font-serif text-lg text-charcoal">Create Testimonial Draft</h3>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="font-mono text-[11px] uppercase tracking-wider text-warm-grey-dark hover:text-charcoal cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="new-testimonial-name"
                className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
              >
                Customer Display Name *
              </label>
              <input
                id="new-testimonial-name"
                required
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="e.g. A. Mitchell"
                className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="new-testimonial-role"
                className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
              >
                Role / Company (Verified)
              </label>
              <input
                id="new-testimonial-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="e.g. Principal Architect"
                className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="new-testimonial-location"
                className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
              >
                Location (Verified)
              </label>
              <input
                id="new-testimonial-location"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="e.g. North Adelaide, SA"
                className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="new-testimonial-rating"
                className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
              >
                Rating (Only if genuinely supplied)
              </label>
              <select
                id="new-testimonial-rating"
                value={newRating}
                onChange={(e) => setNewRating(e.target.value)}
                className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
              >
                <option value="">Not supplied</option>
                <option value="5">5 / 5</option>
                <option value="4">4 / 5</option>
                <option value="3">3 / 5</option>
                <option value="2">2 / 5</option>
                <option value="1">1 / 5</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="new-testimonial-project"
                className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
              >
                Project Reference
              </label>
              <input
                id="new-testimonial-project"
                value={newProjectRef}
                onChange={(e) => setNewProjectRef(e.target.value)}
                placeholder="e.g. North Adelaide Villa"
                className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="new-testimonial-spec"
                className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
              >
                Specification Badge
              </label>
              <input
                id="new-testimonial-spec"
                value={newSpecification}
                onChange={(e) => setNewSpecification(e.target.value)}
                placeholder="e.g. Level 5 Drywall & Cornices"
                className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="new-testimonial-content"
              className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
            >
              Endorsement Quote *
            </label>
            <textarea
              id="new-testimonial-content"
              required
              rows={3}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Verbatim client quotation..."
              className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
            />
          </div>

          <div className="border border-warm-grey/40 bg-ivory p-3 space-y-2">
            <label className="flex items-center gap-2 text-xs font-sans cursor-pointer">
              <input
                type="checkbox"
                checked={newConsentVerified}
                onChange={(e) => setNewConsentVerified(e.target.checked)}
              />
              <span>Customer publication consent verified</span>
            </label>
            <input
              value={newConsentEvidence}
              onChange={(e) => setNewConsentEvidence(e.target.value)}
              placeholder="Consent evidence (e.g. Written email approval 2026-11-20)"
              className="w-full border border-warm-grey/60 bg-white px-3 py-2 text-xs"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 bg-charcoal text-ivory font-mono text-[11px] uppercase tracking-wider hover:bg-bronze disabled:opacity-50 cursor-pointer"
            >
              Create Draft
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs + Search */}
      <div className="bg-white border border-warm-grey/60 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border cursor-pointer transition-colors ${
                activeFilter === tab.id
                  ? 'bg-charcoal text-ivory border-charcoal'
                  : 'bg-ivory text-charcoal border-warm-grey/50 hover:border-charcoal'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search
            className="w-3.5 h-3.5 text-warm-grey-dark absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer, quote, location..."
            aria-label="Search testimonials"
            className="w-full border border-warm-grey/60 bg-ivory pl-8 pr-3 py-1.5 text-xs"
          />
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Queue List */}
        <div className="lg:col-span-5 bg-white border border-warm-grey/60 divide-y divide-warm-grey/30">
          {filteredTestimonials.length === 0 ? (
            <div className="p-6 text-center">
              <p className="font-sans text-xs text-warm-grey-dark">
                No testimonials match the selected filter.
              </p>
            </div>
          ) : (
            filteredTestimonials.map((item, idx) => {
              const isSelected = item.id === selectedId;
              return (
                <div
                  key={item.id}
                  className={`p-4 transition-colors ${
                    isSelected ? 'bg-ivory border-l-2 border-l-bronze' : 'hover:bg-ivory/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectTestimonial(item)}
                      className="text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border ${statusBadgeClass(
                            item
                          )}`}
                        >
                          {statusLabel(item)}
                        </span>
                        {item.is_featured && (
                          <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-bronze/50 bg-ivory text-bronze">
                            <Star className="w-2.5 h-2.5" aria-hidden="true" />
                            Featured
                          </span>
                        )}
                        {item.consent_verified ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-emerald-700">
                            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                            Consent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-amber-700">
                            <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                            Unverified
                          </span>
                        )}
                      </div>
                      <p className="font-sans text-sm font-semibold text-charcoal truncate">
                        {item.customer_name}
                      </p>
                      <p className="font-sans text-xs text-charcoal/80 line-clamp-2 mt-1">
                        &ldquo;{item.content}&rdquo;
                      </p>
                      <p className="font-mono text-[10px] text-warm-grey-dark mt-2">
                        Updated {formatDate(item.updated_at)}
                      </p>
                    </button>

                    {canModerate && activeFilter === 'all' && !searchQuery && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={busy || idx === 0}
                          onClick={() => handleMoveOrder(item.id, -1)}
                          aria-label={`Move ${item.customer_name} up`}
                          className="p-1 border border-warm-grey/50 bg-white text-charcoal disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={busy || idx === testimonials.length - 1}
                          onClick={() => handleMoveOrder(item.id, 1)}
                          aria-label={`Move ${item.customer_name} down`}
                          className="p-1 border border-warm-grey/50 bg-white text-charcoal disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Detail Editor & Moderation */}
        <div className="lg:col-span-7 bg-white border border-warm-grey/60 p-5 space-y-6">
          {!selected ? (
            <p className="font-sans text-xs text-warm-grey-dark">
              Select a testimonial from the list or create a new draft.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warm-grey/30 pb-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-warm-grey-dark block">
                    Record ID: {selected.id.slice(0, 8)}
                  </span>
                  <h3 className="font-serif text-xl text-charcoal">
                    {selected.customer_name}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border ${statusBadgeClass(
                      selected
                    )}`}
                  >
                    {statusLabel(selected)}
                  </span>
                  {canModerate && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleToggleFeatured}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 font-mono text-[10px] uppercase tracking-wider border cursor-pointer ${
                        selected.is_featured
                          ? 'bg-bronze text-white border-bronze'
                          : 'bg-ivory text-charcoal border-warm-grey/60 hover:border-charcoal'
                      }`}
                    >
                      <Star className="w-3 h-3" aria-hidden="true" />
                      <span>{selected.is_featured ? 'Featured' : 'Feature'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Edit Form */}
              <form onSubmit={handleSaveSelected} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="edit-testimonial-name"
                      className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                    >
                      Customer Display Name
                    </label>
                    <input
                      id="edit-testimonial-name"
                      required
                      disabled={!canEditSelected || busy}
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-testimonial-role"
                      className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                    >
                      Role / Company
                    </label>
                    <input
                      id="edit-testimonial-role"
                      disabled={!canEditSelected || busy}
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-testimonial-location"
                      className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                    >
                      Location
                    </label>
                    <input
                      id="edit-testimonial-location"
                      disabled={!canEditSelected || busy}
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-testimonial-rating"
                      className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                    >
                      Rating
                    </label>
                    <select
                      id="edit-testimonial-rating"
                      disabled={!canEditSelected || busy}
                      value={editRating}
                      onChange={(e) => setEditRating(e.target.value)}
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
                    >
                      <option value="">Not supplied</option>
                      <option value="5">5 / 5</option>
                      <option value="4">4 / 5</option>
                      <option value="3">3 / 5</option>
                      <option value="2">2 / 5</option>
                      <option value="1">1 / 5</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="edit-testimonial-project"
                      className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                    >
                      Project Reference
                    </label>
                    <input
                      id="edit-testimonial-project"
                      disabled={!canEditSelected || busy}
                      value={editProjectRef}
                      onChange={(e) => setEditProjectRef(e.target.value)}
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-testimonial-spec"
                      className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                    >
                      Specification Badge
                    </label>
                    <input
                      id="edit-testimonial-spec"
                      disabled={!canEditSelected || busy}
                      value={editSpecification}
                      onChange={(e) => setEditSpecification(e.target.value)}
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="edit-testimonial-content"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Endorsement Quote
                  </label>
                  <textarea
                    id="edit-testimonial-content"
                    required
                    rows={4}
                    disabled={!canEditSelected || busy}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
                  />
                </div>

                {/* Consent Verification Box */}
                <div className="border border-warm-grey/50 bg-ivory p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-charcoal font-semibold">
                      Publication Consent Governance
                    </span>
                    {selected.consent_verified ? (
                      <span className="font-mono text-[10px] uppercase text-emerald-700">
                        Verified
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase text-amber-700">
                        Consent Required Before Publish
                      </span>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs font-sans cursor-pointer">
                    <input
                      id="edit-testimonial-consent-verified"
                      type="checkbox"
                      disabled={!canEditSelected || busy}
                      checked={editConsentVerified}
                      onChange={(e) => setEditConsentVerified(e.target.checked)}
                    />
                    <span>Customer publication consent verified</span>
                  </label>
                  <input
                    id="edit-testimonial-consent-evidence"
                    disabled={!canEditSelected || busy}
                    value={editConsentEvidence}
                    onChange={(e) => setEditConsentEvidence(e.target.value)}
                    placeholder="Documented consent evidence (e.g. Signed release / email date)"
                    className="w-full border border-warm-grey/60 bg-white px-3 py-2 text-xs disabled:opacity-60"
                  />
                </div>

                {canEditSelected && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-5 py-2 bg-charcoal text-ivory font-mono text-[11px] uppercase tracking-wider hover:bg-bronze disabled:opacity-50 cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                )}
              </form>

              {/* Moderation & Publication Controls */}
              <div className="border-t border-warm-grey/30 pt-5 space-y-4">
                <h4 className="font-mono text-[11px] uppercase tracking-widest text-charcoal">
                  Moderation &amp; Publication Controls
                </h4>

                {(selected.moderation_status === 'draft' ||
                  selected.moderation_status === 'rejected') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleTransition('submit-review')}
                    className="px-4 py-2 border border-charcoal bg-ivory text-charcoal font-mono text-[11px] uppercase tracking-wider hover:bg-charcoal hover:text-ivory cursor-pointer"
                  >
                    Submit for Review
                  </button>
                )}

                {!canModerate ? (
                  <p className="font-sans text-xs text-warm-grey-dark">
                    Only Publishers and Administrators can approve, reject, publish, or hide testimonials.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {selected.moderation_status !== 'approved' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleTransition('approve')}
                          className="px-4 py-2 bg-emerald-700 text-white font-mono text-[11px] uppercase tracking-wider hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                        >
                          Approve
                        </button>
                      )}

                      {selected.moderation_status !== 'rejected' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Rejection reason (optional)"
                            className="border border-warm-grey/60 bg-ivory px-3 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleTransition('reject')}
                            className="px-4 py-2 border border-red-400 text-red-800 bg-red-50 font-mono text-[11px] uppercase tracking-wider hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {selected.moderation_status === 'approved' && !selected.is_published && (
                      <div className="border border-emerald-300 bg-emerald-50/50 p-4 space-y-3">
                        <label className="flex items-start gap-2 text-xs font-sans cursor-pointer">
                          <input
                            id="confirm-publish-testimonial"
                            type="checkbox"
                            checked={publishConfirmed}
                            onChange={(e) => setPublishConfirmed(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            I confirm customer publication consent has been verified and approve public display on the Strovyn website.
                          </span>
                        </label>
                        <button
                          type="button"
                          disabled={busy || !publishConfirmed || !selected.consent_verified}
                          onClick={() => handleTransition('publish')}
                          className="px-4 py-2 bg-charcoal text-ivory font-mono text-[11px] uppercase tracking-wider hover:bg-bronze disabled:opacity-40 cursor-pointer"
                        >
                          Publish Testimonial
                        </button>
                      </div>
                    )}

                    {selected.is_published && (
                      <div className="border border-warm-grey/60 bg-ivory p-4 space-y-3">
                        <label className="flex items-start gap-2 text-xs font-sans cursor-pointer">
                          <input
                            id="confirm-unpublish-testimonial"
                            type="checkbox"
                            checked={unpublishConfirmed}
                            onChange={(e) => setUnpublishConfirmed(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            I confirm removing this endorsement from public display (Hidden).
                          </span>
                        </label>
                        <button
                          type="button"
                          disabled={busy || !unpublishConfirmed}
                          onClick={() => handleTransition('unpublish')}
                          className="px-4 py-2 border border-charcoal bg-white text-charcoal font-mono text-[11px] uppercase tracking-wider hover:bg-charcoal hover:text-ivory disabled:opacity-40 cursor-pointer"
                        >
                          Unpublish (Hide)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Moderation History */}
              <div className="border-t border-warm-grey/30 pt-5 space-y-3">
                <h4 className="font-mono text-[11px] uppercase tracking-widest text-charcoal">
                  Moderation History
                </h4>
                {loadingEvents ? (
                  <p className="font-mono text-xs text-warm-grey-dark">Loading history...</p>
                ) : events.length === 0 ? (
                  <p className="font-sans text-xs text-warm-grey-dark">No events recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {events.map((ev) => (
                      <li
                        key={ev.id}
                        className="border border-warm-grey/30 bg-ivory px-3 py-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                      >
                        <div>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-bronze mr-2">
                            {ev.action}
                          </span>
                          <span className="font-sans text-charcoal">
                            {ev.note || `${ev.from_status ?? 'new'} → ${ev.to_status ?? ''}`}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-warm-grey-dark">
                          {formatDate(ev.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
