'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Image as ImageIcon,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import type { TiptapDoc } from '@/lib/cms/contentSecurity';
import {
  buildArticlePatchPayload,
  canStaffEditArticle,
  deriveAutoSlug,
  EDITORIAL_CATEGORIES,
  extractEditableSnapshot,
  isArticleFormDirty,
  resolveEditorPreviewImageSrc,
  validateEditableArticleClient,
  type EditableArticleFields,
  type EditorialArticleDetail,
} from '@/lib/cms/editorHelpers';
import { validateApprovedEditorialMediaUrl } from '@/lib/cms/mediaUrlPolicy';
import { describeStaffRole, formatStatusLabel } from '@/lib/cms/stage1Access';
import {
  EditorialRichTextEditor,
  type PendingEditorialImageInsert,
  type UploadedEditorialImage,
} from './EditorialRichTextEditor';
import {
  AdminMediaLibraryDrawer,
  type EditorialMediaAssetView,
} from './AdminMediaLibraryDrawer';
import { AdminWorkflowControls } from './AdminWorkflowControls';
import { AdminAuditHistoryPanel } from './AdminAuditHistoryPanel';
import type { StaffViewerIdentity } from './StaffAuthGateCards';

interface ConflictReconciliationState {
  message: string;
  serverArticle: EditorialArticleDetail | null;
  loadingLatest: boolean;
}

export function AdminArticleEditor({
  initialStaff,
  initialArticle,
}: {
  initialStaff: StaffViewerIdentity;
  initialArticle: EditorialArticleDetail;
}) {
  const router = useRouter();
  const [serverArticle, setServerArticle] = useState<EditorialArticleDetail>(initialArticle);
  const [baselineSnapshot, setBaselineSnapshot] = useState<EditableArticleFields>(() =>
    extractEditableSnapshot(initialArticle)
  );
  const [draft, setDraft] = useState<EditableArticleFields>(() =>
    extractEditableSnapshot(initialArticle)
  );
  const [editorRevision, setEditorRevision] = useState(1);

  const [isSaving, setIsSaving] = useState(false);
  const saveLockRef = useRef(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [sessionExpiredBanner, setSessionExpiredBanner] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictReconciliationState | null>(
    null
  );

  const [mediaDrawerOpen, setMediaDrawerOpen] = useState(false);
  const [mediaTargetMode, setMediaTargetMode] = useState<'body' | 'featured' | 'og'>('body');
  const [pendingInsert, setPendingInsert] = useState<PendingEditorialImageInsert | null>(null);
  const [auditRefreshTrigger, setAuditRefreshTrigger] = useState(0);
  const insertCounterRef = useRef(0);

  const canEdit = canStaffEditArticle(initialStaff.role, serverArticle.status);
  const isDirty = useMemo(
    () => isArticleFormDirty(baselineSnapshot, draft),
    [baselineSnapshot, draft]
  );

  // Protect unsaved changes across browser tab close/reload
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleBackNavigation = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isDirty) return;
    const confirmed = window.confirm(
      'You have unsaved editorial changes on this article. Leave without saving?'
    );
    if (!confirmed) {
      e.preventDefault();
    }
  };

  const fetchLatestServerArticle = useCallback(async (): Promise<EditorialArticleDetail | null> => {
    try {
      const res = await fetch(`/api/admin/insights/${serverArticle.id}`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (res.status === 401) {
        setSessionExpiredBanner(true);
        return null;
      }
      const json = (await res.json().catch(() => null)) as
        | { success: true; article: EditorialArticleDetail }
        | { success: false; error?: string }
        | null;
      if (!res.ok || !json || !json.success) {
        return null;
      }
      return json.article;
    } catch {
      return null;
    }
  }, [serverArticle.id]);

  const handleSave = async () => {
    if (!canEdit || saveLockRef.current || conflictState) return;
    setErrorBanner(null);
    setSaveSuccessMsg(null);
    setSessionExpiredBanner(false);

    const clientValidationErr = validateEditableArticleClient(draft);
    if (clientValidationErr) {
      setErrorBanner(clientValidationErr);
      return;
    }

    const patchPayload = buildArticlePatchPayload(
      baselineSnapshot,
      draft,
      serverArticle.updated_at
    );
    if (!patchPayload) {
      return;
    }

    saveLockRef.current = true;
    setIsSaving(true);

    try {
      const res = await fetch(`/api/admin/insights/${serverArticle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      });

      if (res.status === 401) {
        setSessionExpiredBanner(true);
        setErrorBanner(
          'Your staff session expired while editing. Sign in again in a separate tab, then click Save without losing local changes.'
        );
        return;
      }

      const json = (await res.json().catch(() => null)) as
        | { success: true; article: EditorialArticleDetail }
        | { success: false; code?: string; error?: string }
        | null;

      if (res.status === 409) {
        // Optimistic concurrency conflict: DO NOT overwrite local draft and DO NOT retry automatically
        const message =
          (json && !json.success && json.error) ||
          'Article was modified by another staff member before this save completed.';
        setConflictState({
          message,
          serverArticle: null,
          loadingLatest: true,
        });
        const latest = await fetchLatestServerArticle();
        setConflictState({
          message,
          serverArticle: latest,
          loadingLatest: false,
        });
        return;
      }

      if (!res.ok || !json || !json.success) {
        setErrorBanner(
          (json && !json.success && json.error) || 'Unable to save article changes.'
        );
        return;
      }

      const saved = json.article;
      const nextSnap = extractEditableSnapshot(saved);
      setServerArticle(saved);
      setBaselineSnapshot(nextSnap);
      setDraft(nextSnap);
      setAuditRefreshTrigger((c) => c + 1);
      setSaveSuccessMsg('Changes saved to database.');
    } catch {
      setErrorBanner('Network error saving article changes. Your local edits remain intact.');
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  const handleDiscardDirty = () => {
    setErrorBanner(null);
    setSaveSuccessMsg(null);
    setDraft(baselineSnapshot);
    setEditorRevision((r) => r + 1);
  };

  const handleTransitionSucceeded = async (
    transitioned: EditorialArticleDetail,
    message: string
  ) => {
    setErrorBanner(null);
    setConflictState(null);
    const immediateSnap = extractEditableSnapshot(transitioned);
    setServerArticle(transitioned);
    setBaselineSnapshot(immediateSnap);
    setDraft(immediateSnap);
    setEditorRevision((r) => r + 1);
    setAuditRefreshTrigger((c) => c + 1);
    setSaveSuccessMsg(message);

    // Refresh authoritative record from server and revalidate queue RSC state
    const latest = await fetchLatestServerArticle();
    if (latest) {
      const latestSnap = extractEditableSnapshot(latest);
      setServerArticle(latest);
      setBaselineSnapshot(latestSnap);
      setDraft(latestSnap);
    }
    router.refresh();
  };

  const handleTransitionConflict = async (message: string) => {
    setSaveSuccessMsg(null);
    setConflictState({
      message,
      serverArticle: null,
      loadingLatest: true,
    });
    const latest = await fetchLatestServerArticle();
    setConflictState({
      message,
      serverArticle: latest,
      loadingLatest: false,
    });
  };

  const handleAdoptServerVersion = async () => {
    setErrorBanner(null);
    setSaveSuccessMsg(null);
    const latest = conflictState?.serverArticle ?? (await fetchLatestServerArticle());
    if (!latest) {
      setErrorBanner('Could not fetch the latest server version. Retry in a moment.');
      return;
    }
    const nextSnap = extractEditableSnapshot(latest);
    setServerArticle(latest);
    setBaselineSnapshot(nextSnap);
    setDraft(nextSnap);
    setEditorRevision((r) => r + 1);
    setConflictState(null);
    setSaveSuccessMsg('Loaded latest server version cleanly.');
  };

  const handleKeepLocalAndRebaseTimestamp = async () => {
    setErrorBanner(null);
    setSaveSuccessMsg(null);
    const latest = conflictState?.serverArticle ?? (await fetchLatestServerArticle());
    if (!latest) {
      setErrorBanner('Unable to load latest server timestamp. Refresh and retry.');
      return;
    }
    // Rebase baseline fields and timestamp ONLY so user explicitly decides when to press Save Changes
    setServerArticle(latest);
    setBaselineSnapshot(extractEditableSnapshot(latest));
    setConflictState(null);
    setSaveSuccessMsg(
      'Rebased concurrency token to the latest server timestamp. Review your draft and click Save to apply.'
    );
  };

  const handleToolbarImageUpload = useCallback(
    async (file: File, altText: string): Promise<UploadedEditorialImage> => {
      const form = new FormData();
      form.append('file', file);
      form.append('altText', altText);
      form.append('articleId', serverArticle.id);

      const res = await fetch('/api/admin/insights/media', {
        method: 'POST',
        body: form,
      });

      if (res.status === 401) {
        setSessionExpiredBanner(true);
        throw new Error('Staff session expired. Re-authenticate before uploading media.');
      }

      const json = (await res.json().catch(() => null)) as
        | { success: true; asset: EditorialMediaAssetView }
        | { success: false; error?: string }
        | null;

      if (!res.ok || !json || !json.success) {
        throw new Error(
          (json && !json.success && json.error) || 'Unable to upload editorial image.'
        );
      }

      // Strictly return canonical `/api/editorial-media/<uuid>` for ProseMirror persistence
      return {
        url: json.asset.media_ref,
        alt: json.asset.alt_text,
        width: json.asset.width,
        height: json.asset.height,
      };
    },
    [serverArticle.id]
  );

  const openMediaDrawer = (mode: 'body' | 'featured' | 'og') => {
    setMediaTargetMode(mode);
    setMediaDrawerOpen(true);
  };

  const handleSelectForBody = (asset: EditorialMediaAssetView) => {
    insertCounterRef.current += 1;
    setPendingInsert({
      requestId: insertCounterRef.current,
      url: asset.media_ref,
      alt: asset.alt_text,
      width: asset.width,
      height: asset.height,
    });
  };

  const handleSelectForFeatured = (asset: EditorialMediaAssetView) => {
    setDraft((prev) => ({
      ...prev,
      featured_image_url: asset.media_ref,
      featured_image_alt: prev.featured_image_alt.trim() ? prev.featured_image_alt : asset.alt_text,
    }));
  };

  const handleSelectForOg = (asset: EditorialMediaAssetView) => {
    setDraft((prev) => ({
      ...prev,
      og_image_url: asset.media_ref,
    }));
  };

  const roleMeta = describeStaffRole(initialStaff.role);
  const featuredPreviewSrc = resolveEditorPreviewImageSrc(draft.featured_image_url);
  const featuredUrlValidity = draft.featured_image_url.trim()
    ? validateApprovedEditorialMediaUrl(draft.featured_image_url)
    : null;
  const ogPreviewSrc = resolveEditorPreviewImageSrc(draft.og_image_url);
  const ogUrlValidity = draft.og_image_url.trim()
    ? validateApprovedEditorialMediaUrl(draft.og_image_url)
    : null;

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal pt-24 pb-24">
      {/* Sticky Top Action & Concurrency Bar */}
      <div className="sticky top-16 sm:top-20 z-30 bg-white/95 backdrop-blur border-b border-warm-grey/60 px-4 sm:px-6 lg:px-10 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/insights"
              onClick={handleBackNavigation}
              className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-charcoal hover:text-bronze transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Queue</span>
            </Link>

            <span className="h-4 w-px bg-warm-grey/50" aria-hidden="true" />

            <span className="px-2.5 py-0.5 border border-warm-grey bg-ivory-light font-mono text-[11px] uppercase tracking-wider text-charcoal">
              {formatStatusLabel(serverArticle.status)}
            </span>

            {isDirty ? (
              <span className="px-2.5 py-0.5 bg-bronze/15 border border-bronze/50 font-mono text-[11px] text-bronze-hover">
                Unsaved edits
              </span>
            ) : (
              <span className="font-mono text-[11px] text-warm-grey-dark">
                Synced
              </span>
            )}

            {!canEdit && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 border border-warm-grey bg-ivory font-mono text-[11px] text-warm-grey-dark">
                <Lock className="w-3 h-3" aria-hidden="true" />
                <span>Read-only ({initialStaff.role})</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 border border-warm-grey/50 bg-ivory-light font-mono text-[10px] uppercase tracking-wider text-charcoal">
              <ShieldCheck className="w-3.5 h-3.5 text-bronze" aria-hidden="true" />
              {initialStaff.full_name} &middot; {roleMeta.label}
            </span>

            <button
              type="button"
              onClick={() => openMediaDrawer('body')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-warm-grey text-charcoal hover:border-charcoal font-mono text-xs uppercase tracking-wider cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Media Library</span>
            </button>

            <Link
              href={`/admin/insights/preview/${serverArticle.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-warm-grey text-charcoal hover:border-charcoal font-mono text-xs uppercase tracking-wider"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Preview</span>
            </Link>

            {canEdit && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !isDirty || Boolean(conflictState)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {isSaving
                    ? 'Saving...'
                    : serverArticle.status === 'draft'
                      ? 'Save Draft'
                      : 'Save Changes'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-8 space-y-6">
        {/* Session Expired Non-Destructive Warning */}
        {sessionExpiredBanner && (
          <div
            role="alert"
            className="bg-white border-2 border-brand-red/60 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <p className="font-mono text-xs uppercase tracking-wider text-brand-red-dark">
                Session Expired
              </p>
              <p className="font-sans text-sm text-charcoal">
                Your local draft edits are still preserved in memory. Sign in again at{' '}
                <Link
                  href="/admin/insights"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-bronze"
                >
                  /admin/insights (new tab)
                </Link>{' '}
                and then click Save Changes here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="px-3.5 py-2 border border-charcoal text-xs font-mono uppercase tracking-wider cursor-pointer"
            >
              Verify Session
            </button>
          </div>
        )}

        {/* 409 Optimistic Concurrency Conflict Resolution Panel */}
        {conflictState && (
          <section
            role="alert"
            aria-label="Optimistic concurrency conflict detected"
            className="bg-white border-2 border-bronze p-6 space-y-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-bronze flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze block">
                  HTTP 409 · Concurrent Edit Conflict
                </span>
                <h2 className="type-card-title text-xl text-charcoal">
                  Newer Server Version Detected — Your Draft Was Preserved
                </h2>
                <p className="font-sans text-sm text-charcoal/80">
                  {conflictState.message} Nothing was overwritten. Inspect the latest server state below and choose how to reconcile before saving again.
                </p>
              </div>
            </div>

            {conflictState.loadingLatest ? (
              <p className="font-mono text-xs text-warm-grey-dark">
                Loading latest server revision for comparison...
              </p>
            ) : conflictState.serverArticle ? (
              <div className="bg-ivory-light border border-warm-grey/60 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                <div className="space-y-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-bronze block">
                    Latest Server Revision ({new Date(conflictState.serverArticle.updated_at).toLocaleString('en-AU')})
                  </span>
                  <p><strong>Title:</strong> {conflictState.serverArticle.title}</p>
                  <p><strong>Slug:</strong> {conflictState.serverArticle.slug}</p>
                  <p><strong>Status:</strong> {conflictState.serverArticle.status}</p>
                  <p><strong>Excerpt:</strong> {conflictState.serverArticle.excerpt}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-charcoal block">
                    Your Unsaved Local Draft
                  </span>
                  <p><strong>Title:</strong> {draft.title}</p>
                  <p><strong>Slug:</strong> {draft.slug}</p>
                  <p><strong>Status:</strong> {serverArticle.status}</p>
                  <p><strong>Excerpt:</strong> {draft.excerpt}</p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleAdoptServerVersion}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-charcoal text-charcoal hover:bg-charcoal hover:text-ivory transition-colors font-mono text-xs uppercase tracking-wider cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Discard Local &amp; Load Server Version</span>
              </button>
              <button
                type="button"
                onClick={handleKeepLocalAndRebaseTimestamp}
                className="px-4 py-2 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-wider cursor-pointer"
              >
                Keep Local Draft &amp; Rebase to Latest Timestamp
              </button>
            </div>
          </section>
        )}

        {saveSuccessMsg && (
          <div
            role="status"
            aria-live="polite"
            className="bg-white border border-emerald-700/40 px-4 py-3 text-xs font-sans text-emerald-900 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {errorBanner && (
          <div
            role="alert"
            className="bg-white border border-brand-red/40 px-4 py-3 text-xs font-sans text-brand-red-dark"
          >
            {errorBanner}
          </div>
        )}

        {/* Two-Column Editorial Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Primary Writing Canvas */}
          <div className="lg:col-span-8 space-y-6">
            <section className="bg-white border border-warm-grey/60 p-6 space-y-4">
              <div>
                <label
                  htmlFor="cms-edit-title"
                  className="block font-mono text-[11px] uppercase tracking-wider text-warm-grey-dark mb-1.5"
                >
                  Headline
                </label>
                <input
                  id="cms-edit-title"
                  type="text"
                  disabled={!canEdit}
                  value={draft.title}
                  onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2.5 text-lg font-sans font-medium text-charcoal disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-bronze"
                />
              </div>

              <div>
                <label
                  htmlFor="cms-edit-subtitle"
                  className="block font-mono text-[11px] uppercase tracking-wider text-warm-grey-dark mb-1.5"
                >
                  Subtitle (optional)
                </label>
                <input
                  id="cms-edit-subtitle"
                  type="text"
                  disabled={!canEdit}
                  value={draft.subtitle}
                  onChange={(e) => setDraft((p) => ({ ...p, subtitle: e.target.value }))}
                  placeholder="Supporting editorial deck line"
                  className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2 text-sm font-sans text-charcoal disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-bronze"
                />
              </div>

              <div>
                <label
                  htmlFor="cms-edit-excerpt"
                  className="block font-mono text-[11px] uppercase tracking-wider text-warm-grey-dark mb-1.5"
                >
                  Excerpt <span className="text-warm-grey-dark">({draft.excerpt.trim().length}/360, min 20)</span>
                </label>
                <textarea
                  id="cms-edit-excerpt"
                  rows={3}
                  disabled={!canEdit}
                  value={draft.excerpt}
                  onChange={(e) => setDraft((p) => ({ ...p, excerpt: e.target.value }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2 text-sm font-sans text-charcoal disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-bronze"
                />
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze">
                  Article Body (Tiptap Structured Document)
                </h2>
                <span className="font-mono text-[10px] text-warm-grey-dark">
                  Persists canonical /api/editorial-media/&lt;uuid&gt; references
                </span>
              </div>

              <EditorialRichTextEditor
                key={editorRevision}
                value={draft.content_json}
                documentKey={`${serverArticle.id}-${editorRevision}`}
                disabled={!canEdit}
                onChange={(nextDoc: TiptapDoc) =>
                  setDraft((prev) => ({ ...prev, content_json: nextDoc }))
                }
                onUploadImage={canEdit ? handleToolbarImageUpload : undefined}
                onOpenMediaLibrary={canEdit ? () => openMediaDrawer('body') : undefined}
                pendingImageInsert={pendingInsert}
              />
            </section>

            <AdminAuditHistoryPanel
              articleId={serverArticle.id}
              refreshTrigger={auditRefreshTrigger}
              onSessionExpired={() => setSessionExpiredBanner(true)}
            />
          </div>

          {/* Right Column: Workflow Governance, Metadata, Cover Image & SEO */}
          <aside className="lg:col-span-4 space-y-6">
            <AdminWorkflowControls
              article={serverArticle}
              staffRole={initialStaff.role}
              isDirty={isDirty}
              hasConflict={Boolean(conflictState)}
              onSaveBeforeTransition={handleSave}
              onDiscardDirtyBeforeTransition={handleDiscardDirty}
              onTransitionSucceeded={handleTransitionSucceeded}
              onConflictDetected={handleTransitionConflict}
              onSessionExpired={() => setSessionExpiredBanner(true)}
            />

            <section className="bg-white border border-warm-grey/60 p-5 space-y-4">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze border-b border-warm-grey/40 pb-2.5">
                Classification &amp; URL
              </h2>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="cms-edit-slug"
                    className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark"
                  >
                    Slug
                  </label>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((p) => ({ ...p, slug: deriveAutoSlug(p.title) }))
                      }
                      className="font-mono text-[10px] text-bronze hover:underline cursor-pointer"
                    >
                      Derive from Title
                    </button>
                  )}
                </div>
                <input
                  id="cms-edit-slug"
                  type="text"
                  disabled={!canEdit}
                  value={draft.slug}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, slug: e.target.value.toLowerCase() }))
                  }
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-mono text-charcoal disabled:opacity-70"
                />
              </div>

              <div>
                <label
                  htmlFor="cms-edit-category"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Category
                </label>
                <select
                  id="cms-edit-category"
                  disabled={!canEdit}
                  value={draft.category}
                  onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
                >
                  {!EDITORIAL_CATEGORIES.includes(
                    draft.category as (typeof EDITORIAL_CATEGORIES)[number]
                  ) && <option value={draft.category}>{draft.category}</option>}
                  {EDITORIAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                <div>
                  <label
                    htmlFor="cms-edit-author-name"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Author Byline
                  </label>
                  <input
                    id="cms-edit-author-name"
                    type="text"
                    disabled={!canEdit}
                    value={draft.author_name}
                    onChange={(e) => setDraft((p) => ({ ...p, author_name: e.target.value }))}
                    className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cms-edit-author-role"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Author Role
                  </label>
                  <input
                    id="cms-edit-author-role"
                    type="text"
                    disabled={!canEdit}
                    value={draft.author_role}
                    onChange={(e) => setDraft((p) => ({ ...p, author_role: e.target.value }))}
                    className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-xs font-sans text-charcoal pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={draft.is_featured}
                  onChange={(e) => setDraft((p) => ({ ...p, is_featured: e.target.checked }))}
                  className="accent-bronze"
                />
                <span>Feature as Lead Monograph on Journal Index</span>
              </label>
            </section>

            {/* Featured & OG Media Panel */}
            <section className="bg-white border border-warm-grey/60 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-warm-grey/40 pb-2.5">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze">
                  Featured Image
                </h2>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openMediaDrawer('featured')}
                    className="font-mono text-[10px] uppercase tracking-wider text-bronze hover:underline cursor-pointer"
                  >
                    Browse Private Media
                  </button>
                )}
              </div>

              {featuredPreviewSrc && (!featuredUrlValidity || featuredUrlValidity.valid) && (
                <div className="relative aspect-[16/9] bg-charcoal border border-warm-grey/40 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featuredPreviewSrc}
                    alt={draft.featured_image_alt || draft.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="cms-edit-featured-url"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Cover Reference (Persisted Canonical URL)
                </label>
                <input
                  id="cms-edit-featured-url"
                  type="text"
                  disabled={!canEdit}
                  value={draft.featured_image_url}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, featured_image_url: e.target.value }))
                  }
                  placeholder="/api/editorial-media/<uuid> or /images/..."
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-mono text-charcoal disabled:opacity-70"
                />
                {featuredUrlValidity && !featuredUrlValidity.valid && (
                  <p className="text-[11px] text-brand-red-dark mt-1">
                    {featuredUrlValidity.reason}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="cms-edit-featured-alt"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Cover Alt Text
                </label>
                <input
                  id="cms-edit-featured-alt"
                  type="text"
                  disabled={!canEdit}
                  value={draft.featured_image_alt}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, featured_image_alt: e.target.value }))
                  }
                  placeholder="Required before review/publication if cover is set"
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-sans text-charcoal disabled:opacity-70"
                />
              </div>

              <div className="pt-2 border-t border-warm-grey/30 space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="cms-edit-og-url"
                    className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark"
                  >
                    OpenGraph Share Image (optional)
                  </label>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openMediaDrawer('og')}
                      className="font-mono text-[10px] text-bronze hover:underline cursor-pointer"
                    >
                      Pick Media
                    </button>
                  )}
                </div>
                {ogPreviewSrc && (!ogUrlValidity || ogUrlValidity.valid) && (
                  <div className="relative aspect-[16/9] bg-charcoal border border-warm-grey/40 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ogPreviewSrc}
                      alt="OpenGraph share preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <input
                  id="cms-edit-og-url"
                  type="text"
                  disabled={!canEdit}
                  value={draft.og_image_url}
                  onChange={(e) => setDraft((p) => ({ ...p, og_image_url: e.target.value }))}
                  placeholder="/api/editorial-media/<uuid>"
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-mono text-charcoal disabled:opacity-70"
                />
                {ogUrlValidity && !ogUrlValidity.valid && (
                  <p className="text-[11px] text-brand-red-dark mt-1">{ogUrlValidity.reason}</p>
                )}
              </div>
            </section>

            {/* SEO Panel */}
            <section className="bg-white border border-warm-grey/60 p-5 space-y-4">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze border-b border-warm-grey/40 pb-2.5">
                Search Engine Metadata
              </h2>

              <div>
                <label
                  htmlFor="cms-edit-seo-title"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  SEO Title ({draft.seo_title.trim().length}/70)
                </label>
                <input
                  id="cms-edit-seo-title"
                  type="text"
                  disabled={!canEdit}
                  value={draft.seo_title}
                  onChange={(e) => setDraft((p) => ({ ...p, seo_title: e.target.value }))}
                  placeholder="Optional custom search title"
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-sans text-charcoal disabled:opacity-70"
                />
              </div>

              <div>
                <label
                  htmlFor="cms-edit-seo-desc"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  SEO Description ({draft.seo_description.trim().length}/160)
                </label>
                <textarea
                  id="cms-edit-seo-desc"
                  rows={3}
                  disabled={!canEdit}
                  value={draft.seo_description}
                  onChange={(e) => setDraft((p) => ({ ...p, seo_description: e.target.value }))}
                  placeholder="Optional meta description (10–160 characters)"
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-sans text-charcoal disabled:opacity-70"
                />
              </div>

              <div className="pt-2 border-t border-warm-grey/30 font-mono text-[10px] text-warm-grey-dark space-y-1">
                <p>Concurrency lock: {serverArticle.updated_at}</p>
                {isDirty && (
                  <p className="text-bronze">
                    Preview shows the last saved version until edits are saved.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <AdminMediaLibraryDrawer
        isOpen={mediaDrawerOpen}
        articleId={serverArticle.id}
        staffRole={initialStaff.role}
        targetMode={mediaTargetMode}
        canMutateArticle={canEdit}
        onClose={() => setMediaDrawerOpen(false)}
        onSelectForBody={handleSelectForBody}
        onSelectForFeatured={handleSelectForFeatured}
        onSelectForOg={handleSelectForOg}
        onSessionExpired={() => {
          setMediaDrawerOpen(false);
          setSessionExpiredBanner(true);
        }}
      />
    </main>
  );
}
