'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  Lock,
  RefreshCw,
  Save,
  Star,
  Trash2,
} from 'lucide-react';
import {
  PROJECT_CATEGORIES,
  PROJECT_IMAGE_ROLES,
  PROJECT_LIFECYCLES,
  type ProjectImageRole,
  type ProjectVisibilityStatus,
} from '@/lib/cms/projectValidators';
import type { DbProjectDetail, ProjectImageRecord } from '@/lib/cms/projectsService';
import type { StaffViewerIdentity } from './StaffAuthGateCards';

interface EditableProjectFields {
  title: string;
  slug: string;
  category: string;
  status: string;
  location: string;
  year: string;
  short_description: string;
  description: string;
  architect: string;
  builder: string;
  finishes: string;
  sheen_levels: string;
  challenges: string;
  scopeText: string;
  seo_title: string;
  seo_description: string;
  is_featured: boolean;
  is_demonstration_spec: boolean;
  sort_order: number;
}

function extractProjectSnapshot(p: DbProjectDetail): EditableProjectFields {
  return {
    title: p.title ?? '',
    slug: p.slug ?? '',
    category: p.category ?? PROJECT_CATEGORIES[0],
    status: p.status ?? 'Completed',
    location: p.location ?? '',
    year: p.year ?? '',
    short_description: p.short_description ?? '',
    description: p.description ?? '',
    architect: p.architect ?? '',
    builder: p.builder ?? '',
    finishes: p.finishes ?? '',
    sheen_levels: p.sheen_levels ?? '',
    challenges: p.challenges ?? '',
    scopeText: Array.isArray(p.scope) ? p.scope.join('\n') : '',
    seo_title: p.seo_title ?? '',
    seo_description: p.seo_description ?? '',
    is_featured: Boolean(p.is_featured),
    is_demonstration_spec: Boolean(p.is_demonstration_spec),
    sort_order: typeof p.sort_order === 'number' ? p.sort_order : 0,
  };
}

function canEditProjectForRole(role: StaffViewerIdentity['role'], visibility: ProjectVisibilityStatus): boolean {
  if (visibility === 'draft') return true;
  return role === 'publisher' || role === 'admin';
}

export function AdminProjectEditor({
  initialStaff,
  initialProject,
}: {
  initialStaff: StaffViewerIdentity;
  initialProject: DbProjectDetail;
}) {
  const router = useRouter();
  const [serverProject, setServerProject] = useState<DbProjectDetail>(initialProject);
  const [baseline, setBaseline] = useState<EditableProjectFields>(() =>
    extractProjectSnapshot(initialProject)
  );
  const [draft, setDraft] = useState<EditableProjectFields>(() =>
    extractProjectSnapshot(initialProject)
  );
  const [imagesBaseline, setImagesBaseline] = useState<ProjectImageRecord[]>(initialProject.images);
  const [imagesDraft, setImagesDraft] = useState<ProjectImageRecord[]>(initialProject.images);
  const [coverUrlDraft, setCoverUrlDraft] = useState<string | null>(initialProject.main_image_url);

  const [uploadRole, setUploadRole] = useState<ProjectImageRole>('gallery');
  const [uploadPairKey, setUploadPairKey] = useState('');
  const [uploadAlt, setUploadAlt] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<ProjectVisibilityStatus | null>(null);
  const [confirmAck, setConfirmAck] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<{
    message: string;
    latest: DbProjectDetail | null;
  } | null>(null);

  const canEdit = canEditProjectForRole(initialStaff.role, serverProject.visibility_status);
  const canPublishOrArchive = initialStaff.role === 'publisher' || initialStaff.role === 'admin';

  const metadataDirty = useMemo(
    () => JSON.stringify(baseline) !== JSON.stringify(draft),
    [baseline, draft]
  );
  const imagesDirty = useMemo(
    () =>
      coverUrlDraft !== (serverProject.main_image_url ?? null) ||
      JSON.stringify(
        imagesBaseline.map((i) => ({
          id: i.id,
          image_role: i.image_role,
          alt_text: i.alt_text ?? '',
          caption: i.caption ?? '',
          pair_key: i.pair_key ?? '',
          sort_order: i.sort_order,
        }))
      ) !==
        JSON.stringify(
          imagesDraft.map((i) => ({
            id: i.id,
            image_role: i.image_role,
            alt_text: i.alt_text ?? '',
            caption: i.caption ?? '',
            pair_key: i.pair_key ?? '',
            sort_order: i.sort_order,
          }))
        ),
    [coverUrlDraft, serverProject.main_image_url, imagesBaseline, imagesDraft]
  );

  const isDirty = metadataDirty || imagesDirty;

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const syncFromServerProject = (next: DbProjectDetail) => {
    const snap = extractProjectSnapshot(next);
    setServerProject(next);
    setBaseline(snap);
    setDraft(snap);
    setImagesBaseline(next.images);
    setImagesDraft(next.images);
    setCoverUrlDraft(next.main_image_url);
  };

  const fetchLatest = async (): Promise<DbProjectDetail | null> => {
    const res = await fetch(`/api/admin/projects/${serverProject.id}`, { cache: 'no-store' });
    const json = (await res.json().catch(() => null)) as
      | { success: true; project: DbProjectDetail }
      | null;
    return res.ok && json?.success ? json.project : null;
  };

  const handleSaveAll = async () => {
    if (!canEdit || !isDirty || isSaving || conflictState) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSaving(true);

    try {
      let currentProject = serverProject;

      if (metadataDirty) {
        const scopeItems = draft.scopeText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length >= 3);

        const res = await fetch(`/api/admin/projects/${currentProject.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expected_updated_at: currentProject.updated_at,
            title: draft.title.trim(),
            slug: draft.slug.trim(),
            category: draft.category,
            status: draft.status,
            location: draft.location.trim(),
            year: draft.year.trim() || null,
            short_description: draft.short_description.trim() || null,
            description: draft.description.trim(),
            architect: draft.architect.trim() || null,
            builder: draft.builder.trim() || null,
            finishes: draft.finishes.trim() || null,
            sheen_levels: draft.sheen_levels.trim() || null,
            challenges: draft.challenges.trim() || null,
            scope: scopeItems,
            seo_title: draft.seo_title.trim() || null,
            seo_description: draft.seo_description.trim() || null,
            is_featured: draft.is_featured,
            is_demonstration_spec: draft.is_demonstration_spec,
            sort_order: Number(draft.sort_order) || 0,
          }),
        });

        const json = (await res.json().catch(() => null)) as
          | { success: true; project: DbProjectDetail }
          | { success: false; error?: string }
          | null;

        if (res.status === 409) {
          const latest = await fetchLatest();
          setConflictState({
            message: (json && !json.success && json.error) || 'Concurrent edit detected.',
            latest,
          });
          return;
        }

        if (!res.ok || !json || !json.success) {
          setErrorMsg((json && !json.success && json.error) || 'Failed saving project metadata.');
          return;
        }
        currentProject = json.project;
      }

      if (imagesDirty) {
        const selectedCoverImg = imagesDraft.find((i) => i.image_url === coverUrlDraft);
        const res = await fetch(`/api/admin/projects/${currentProject.id}/images`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expected_updated_at: currentProject.updated_at,
            coverImageId: selectedCoverImg?.id ?? null,
            images: imagesDraft.map((img, index) => ({
              id: img.id,
              image_role: img.image_role,
              alt_text: img.alt_text?.trim() || null,
              caption: img.caption?.trim() || null,
              pair_key: img.pair_key?.trim() || null,
              sort_order: index,
            })),
          }),
        });

        const json = (await res.json().catch(() => null)) as
          | { success: true; project: DbProjectDetail }
          | { success: false; error?: string }
          | null;

        if (res.status === 409) {
          const latest = await fetchLatest();
          setConflictState({
            message: (json && !json.success && json.error) || 'Concurrent image edit detected.',
            latest,
          });
          return;
        }

        if (!res.ok || !json || !json.success) {
          setErrorMsg((json && !json.success && json.error) || 'Failed saving project images.');
          return;
        }
        currentProject = json.project;
      }

      syncFromServerProject(currentProject);
      setSuccessMsg('Project changes saved cleanly.');
      router.refresh();
    } catch {
      setErrorMsg('Network error saving project changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardEdits = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setDraft(baseline);
    setImagesDraft(imagesBaseline);
    setCoverUrlDraft(serverProject.main_image_url);
  };

  const handleMultiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0 || !canEdit) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUploading(true);

    try {
      let latestProject = serverProject;
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        form.append('imageRole', uploadRole);
        if (uploadAlt.trim()) form.append('altText', uploadAlt.trim());
        if (uploadPairKey.trim()) form.append('pairKey', uploadPairKey.trim());
        if (uploadRole === 'cover') form.append('setAsCover', 'true');

        const res = await fetch(`/api/admin/projects/${serverProject.id}/images`, {
          method: 'POST',
          body: form,
        });
        const json = (await res.json().catch(() => null)) as
          | { success: true; project: DbProjectDetail }
          | { success: false; error?: string }
          | null;

        if (!res.ok || !json || !json.success) {
          setErrorMsg((json && !json.success && json.error) || `Upload failed for ${file.name}.`);
          break;
        }
        latestProject = json.project;
      }
      setServerProject(latestProject);
      setImagesBaseline(latestProject.images);
      setImagesDraft(latestProject.images);
      setCoverUrlDraft(latestProject.main_image_url);
      setUploadAlt('');
      setSuccessMsg(`Uploaded ${files.length} image${files.length === 1 ? '' : 's'} to project gallery.`);
      router.refresh();
    } catch {
      setErrorMsg('Network error uploading project images.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (img: ProjectImageRecord) => {
    if (!canEdit || isDirty) return;
    if (!window.confirm('Remove this image from the project gallery? Shared storage files are preserved.')) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(
        `/api/admin/projects/${serverProject.id}/images?imageId=${encodeURIComponent(img.id)}&expected_updated_at=${encodeURIComponent(serverProject.updated_at)}`,
        { method: 'DELETE' }
      );
      const json = (await res.json().catch(() => null)) as
        | { success: true; project: DbProjectDetail }
        | { success: false; error?: string }
        | null;

      if (res.status === 409) {
        const latest = await fetchLatest();
        setConflictState({
          message: (json && !json.success && json.error) || 'Concurrent edit detected.',
          latest,
        });
        return;
      }

      if (!res.ok || !json || !json.success) {
        setErrorMsg((json && !json.success && json.error) || 'Unable to delete project image.');
        return;
      }

      syncFromServerProject(json.project);
      setSuccessMsg('Project image removed.');
      router.refresh();
    } catch {
      setErrorMsg('Network error removing project image.');
    }
  };

  const handleVisibilityChange = async (nextStatus: ProjectVisibilityStatus) => {
    if (!canPublishOrArchive || isDirty || isTransitioning) return;
    if ((nextStatus === 'published' || nextStatus === 'archived') && !confirmAck) {
      setErrorMsg('Please tick the confirmation checkbox first.');
      return;
    }

    setIsTransitioning(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/projects/${serverProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_updated_at: serverProject.updated_at,
          visibility_status: nextStatus,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { success: true; project: DbProjectDetail }
        | { success: false; error?: string }
        | null;

      if (res.status === 409) {
        setPendingVisibility(null);
        const latest = await fetchLatest();
        setConflictState({
          message: (json && !json.success && json.error) || 'Concurrent edit detected.',
          latest,
        });
        return;
      }

      if (!res.ok || !json || !json.success) {
        setErrorMsg((json && !json.success && json.error) || 'Failed updating visibility.');
        return;
      }

      setPendingVisibility(null);
      setConfirmAck(false);
      syncFromServerProject(json.project);
      setSuccessMsg(`Project visibility updated to ${nextStatus}.`);
      router.refresh();
    } catch {
      setErrorMsg('Network error updating project visibility.');
    } finally {
      setIsTransitioning(false);
    }
  };

  const moveImage = (index: number, delta: -1 | 1) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= imagesDraft.length) return;
    setImagesDraft((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(nextIdx, 0, moved);
      return copy.map((item, i) => ({ ...item, sort_order: i }));
    });
  };

  const beforeAfterPairs = useMemo(() => {
    const groups = new Map<string, { before?: ProjectImageRecord; after?: ProjectImageRecord }>();
    for (const img of imagesDraft) {
      if (img.image_role !== 'before' && img.image_role !== 'after') continue;
      const key = img.pair_key?.trim() || 'default';
      const entry = groups.get(key) ?? {};
      if (img.image_role === 'before') entry.before = img;
      if (img.image_role === 'after') entry.after = img;
      groups.set(key, entry);
    }
    return Array.from(groups.entries()).map(([key, pair]) => ({ key, ...pair }));
  }, [imagesDraft]);

  return (
    <div className="space-y-6">
      {/* Sticky Top Action Bar */}
      <div className="sticky top-20 z-20 bg-white/95 backdrop-blur border border-warm-grey/60 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/projects"
            onClick={(e) => {
              if (isDirty && !window.confirm('You have unsaved project changes. Leave without saving?')) {
                e.preventDefault();
              }
            }}
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-charcoal hover:text-bronze"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Projects</span>
          </Link>
          <span className="h-4 w-px bg-warm-grey/50" aria-hidden="true" />
          <span className="px-2.5 py-0.5 border border-warm-grey bg-ivory-light font-mono text-[11px] uppercase tracking-wider text-charcoal">
            {serverProject.visibility_status}
          </span>
          {isDirty ? (
            <span className="px-2.5 py-0.5 bg-bronze/15 border border-bronze/50 font-mono text-[11px] text-bronze-hover">
              Unsaved edits
            </span>
          ) : (
            <span className="font-mono text-[11px] text-warm-grey-dark">Synced</span>
          )}
          {!canEdit && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-warm-grey bg-ivory font-mono text-[10px] text-warm-grey-dark">
              <Lock className="w-3 h-3" aria-hidden="true" />
              Read-only ({initialStaff.role})
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {serverProject.visibility_status === 'published' && (
            <Link
              href={`/projects/${serverProject.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal"
            >
              <span>View Public</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
          {isDirty && canEdit && (
            <button
              type="button"
              onClick={handleDiscardEdits}
              className="px-3 py-1.5 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal cursor-pointer"
            >
              Discard Edits
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={!isDirty || isSaving || Boolean(conflictState)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Conflict Panel */}
      {conflictState && (
        <section role="alert" className="bg-white border-2 border-bronze p-5 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-bronze flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-mono text-xs uppercase tracking-wider text-bronze">
                HTTP 409 · Concurrent Project Edit Detected
              </p>
              <p className="font-sans text-sm text-charcoal">
                {conflictState.message} Your local edits remain preserved below.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (conflictState.latest) syncFromServerProject(conflictState.latest);
                setConflictState(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-charcoal text-xs font-mono uppercase tracking-wider cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Discard Local &amp; Load Server Version</span>
            </button>
            {conflictState.latest && (
              <button
                type="button"
                onClick={() => {
                  const latest = conflictState.latest!;
                  setServerProject(latest);
                  setBaseline(extractProjectSnapshot(latest));
                  setConflictState(null);
                  setSuccessMsg('Rebased timestamp to latest server version. Click Save Changes to apply.');
                }}
                className="px-3.5 py-2 bg-charcoal text-ivory text-xs font-mono uppercase tracking-wider cursor-pointer"
              >
                Keep Local &amp; Rebase Timestamp
              </button>
            )}
          </div>
        </section>
      )}

      {successMsg && (
        <div role="status" className="bg-white border border-emerald-700/40 px-4 py-3 text-xs font-sans text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="bg-white border border-brand-red/50 px-4 py-3 text-xs font-sans text-brand-red-dark">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Metadata & Image Gallery */}
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white border border-warm-grey/60 p-6 space-y-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze border-b border-warm-grey/40 pb-2">
              Project Case Study Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="proj-edit-title" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                  Title
                </label>
                <input
                  id="proj-edit-title"
                  type="text"
                  disabled={!canEdit}
                  value={draft.title}
                  onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
                />
              </div>

              <div>
                <label htmlFor="proj-edit-slug" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                  Slug
                </label>
                <input
                  id="proj-edit-slug"
                  type="text"
                  disabled={!canEdit}
                  value={draft.slug}
                  onChange={(e) => setDraft((p) => ({ ...p, slug: e.target.value.toLowerCase() }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-mono text-charcoal disabled:opacity-70"
                />
              </div>

              <div>
                <label htmlFor="proj-edit-category" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                  Category
                </label>
                <select
                  id="proj-edit-category"
                  disabled={!canEdit}
                  value={draft.category}
                  onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
                >
                  {PROJECT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="proj-edit-lifecycle" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                  Construction Lifecycle
                </label>
                <select
                  id="proj-edit-lifecycle"
                  disabled={!canEdit}
                  value={draft.status}
                  onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
                >
                  {PROJECT_LIFECYCLES.map((lc) => (
                    <option key={lc} value={lc}>{lc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="proj-edit-location" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                  Location
                </label>
                <input
                  id="proj-edit-location"
                  type="text"
                  disabled={!canEdit}
                  value={draft.location}
                  onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
                />
              </div>

              <div>
                <label htmlFor="proj-edit-year" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                  Year
                </label>
                <input
                  id="proj-edit-year"
                  type="text"
                  maxLength={4}
                  disabled={!canEdit}
                  value={draft.year}
                  onChange={(e) => setDraft((p) => ({ ...p, year: e.target.value }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-mono text-charcoal disabled:opacity-70"
                />
              </div>
            </div>

            <div>
              <label htmlFor="proj-edit-desc" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                Case Study Description
              </label>
              <textarea
                id="proj-edit-desc"
                rows={4}
                disabled={!canEdit}
                value={draft.description}
                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="proj-edit-architect" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                  Architect / Specifier
                </label>
                <input
                  id="proj-edit-architect"
                  type="text"
                  disabled={!canEdit}
                  value={draft.architect}
                  onChange={(e) => setDraft((p) => ({ ...p, architect: e.target.value }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
                />
              </div>
              <div>
                <label htmlFor="proj-edit-builder" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                  Builder
                </label>
                <input
                  id="proj-edit-builder"
                  type="text"
                  disabled={!canEdit}
                  value={draft.builder}
                  onChange={(e) => setDraft((p) => ({ ...p, builder: e.target.value }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
                />
              </div>
              <div>
                <label htmlFor="proj-edit-finishes" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                  Finishes Schedule
                </label>
                <input
                  id="proj-edit-finishes"
                  type="text"
                  disabled={!canEdit}
                  value={draft.finishes}
                  onChange={(e) => setDraft((p) => ({ ...p, finishes: e.target.value }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
                />
              </div>
              <div>
                <label htmlFor="proj-edit-sheen" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                  Sheen Levels
                </label>
                <input
                  id="proj-edit-sheen"
                  type="text"
                  disabled={!canEdit}
                  value={draft.sheen_levels}
                  onChange={(e) => setDraft((p) => ({ ...p, sheen_levels: e.target.value }))}
                  className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
                />
              </div>
            </div>

            <div>
              <label htmlFor="proj-edit-challenges" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                Technical Challenges
              </label>
              <textarea
                id="proj-edit-challenges"
                rows={2}
                disabled={!canEdit}
                value={draft.challenges}
                onChange={(e) => setDraft((p) => ({ ...p, challenges: e.target.value }))}
                className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
              />
            </div>

            <div>
              <label htmlFor="proj-edit-scope" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                Scope Items (one per line)
              </label>
              <textarea
                id="proj-edit-scope"
                rows={4}
                disabled={!canEdit}
                value={draft.scopeText}
                onChange={(e) => setDraft((p) => ({ ...p, scopeText: e.target.value }))}
                className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal disabled:opacity-70"
              />
            </div>
          </section>

          {/* Gallery, Cover & Before/After Image Manager */}
          <section className="bg-white border border-warm-grey/60 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-warm-grey/40 pb-2">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze">
                Gallery, Cover &amp; Before/After Photos ({imagesDraft.length})
              </h2>
            </div>

            {canEdit && (
              <div className="bg-ivory-light border border-warm-grey/50 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="proj-upload-role" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                      Upload Role
                    </label>
                    <select
                      id="proj-upload-role"
                      value={uploadRole}
                      onChange={(e) => setUploadRole(e.target.value as ProjectImageRole)}
                      className="w-full bg-white border border-warm-grey px-2.5 py-1.5 text-xs font-sans text-charcoal"
                    >
                      {PROJECT_IMAGE_ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="proj-upload-pair" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                      Before/After Pair Key
                    </label>
                    <input
                      id="proj-upload-pair"
                      type="text"
                      value={uploadPairKey}
                      onChange={(e) => setUploadPairKey(e.target.value)}
                      placeholder="e.g. ceiling-level5"
                      className="w-full bg-white border border-warm-grey px-2.5 py-1.5 text-xs font-mono text-charcoal"
                    />
                  </div>
                  <div>
                    <label htmlFor="proj-upload-alt" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                      Alt Text
                    </label>
                    <input
                      id="proj-upload-alt"
                      type="text"
                      value={uploadAlt}
                      onChange={(e) => setUploadAlt(e.target.value)}
                      placeholder="Describe architectural view"
                      className="w-full bg-white border border-warm-grey px-2.5 py-1.5 text-xs font-sans text-charcoal"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleMultiFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-charcoal text-ivory hover:bg-bronze transition-colors text-xs font-mono uppercase tracking-wider cursor-pointer disabled:opacity-50"
                  >
                    <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isUploading ? 'Uploading...' : 'Upload Multi-Images (JPEG/PNG/WebP)'}</span>
                  </button>
                  <span className="font-mono text-[10px] text-warm-grey-dark">
                    Max 10 MiB per file · Stored in `project-photos`
                  </span>
                </div>
              </div>
            )}

            {imagesDraft.length === 0 ? (
              <p className="font-sans text-xs text-warm-grey-dark py-4">
                No project images attached yet. Upload photography above.
              </p>
            ) : (
              <div className="space-y-3">
                {imagesDraft.map((img, index) => {
                  const isCover = coverUrlDraft === img.image_url;
                  return (
                    <div
                      key={img.id}
                      className="border border-warm-grey/50 p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.image_url}
                          alt={img.alt_text || serverProject.title}
                          className="w-24 h-16 object-cover bg-charcoal border border-warm-grey/40 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] text-warm-grey-dark">
                              #{index + 1}
                            </span>
                            {isCover && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-bronze text-ivory font-mono text-[10px] uppercase">
                                <Star className="w-3 h-3" aria-hidden="true" />
                                Cover
                              </span>
                            )}
                            <select
                              aria-label={`Image ${index + 1} role`}
                              disabled={!canEdit}
                              value={img.image_role}
                              onChange={(e) => {
                                const nextRole = e.target.value as ProjectImageRole;
                                setImagesDraft((prev) =>
                                  prev.map((item) =>
                                    item.id === img.id ? { ...item, image_role: nextRole } : item
                                  )
                                );
                              }}
                              className="bg-ivory-light border border-warm-grey px-2 py-0.5 text-[11px] font-mono text-charcoal"
                            >
                              {PROJECT_IMAGE_ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            {(img.image_role === 'before' || img.image_role === 'after') && (
                              <input
                                type="text"
                                aria-label={`Image ${index + 1} pair key`}
                                disabled={!canEdit}
                                value={img.pair_key ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setImagesDraft((prev) =>
                                    prev.map((item) =>
                                      item.id === img.id ? { ...item, pair_key: val } : item
                                    )
                                  );
                                }}
                                placeholder="pair-key"
                                className="bg-ivory-light border border-warm-grey px-2 py-0.5 text-[11px] font-mono text-charcoal w-32"
                              />
                            )}
                          </div>

                          <input
                            type="text"
                            aria-label={`Image ${index + 1} alt text`}
                            disabled={!canEdit}
                            value={img.alt_text ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setImagesDraft((prev) =>
                                prev.map((item) =>
                                  item.id === img.id ? { ...item, alt_text: val } : item
                                )
                              );
                            }}
                            placeholder="Accessible alt text"
                            className="w-full bg-ivory-light border border-warm-grey px-2 py-1 text-xs font-sans text-charcoal"
                          />
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                          {!isCover && (
                            <button
                              type="button"
                              onClick={() => setCoverUrlDraft(img.image_url)}
                              className="px-2.5 py-1 border border-bronze text-bronze hover:bg-bronze hover:text-ivory text-[10px] font-mono uppercase cursor-pointer"
                            >
                              Set Cover
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Move image ${index + 1} up`}
                            disabled={index === 0}
                            onClick={() => moveImage(index, -1)}
                            className="p-1.5 border border-warm-grey text-charcoal disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move image ${index + 1} down`}
                            disabled={index === imagesDraft.length - 1}
                            onClick={() => moveImage(index, 1)}
                            className="p-1.5 border border-warm-grey text-charcoal disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove image ${index + 1}`}
                            disabled={isDirty}
                            title={isDirty ? 'Save or discard pending edits before deleting' : 'Remove image'}
                            onClick={() => handleDeleteImage(img)}
                            className="p-1.5 border border-brand-red/40 text-brand-red-dark hover:bg-brand-red/10 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {beforeAfterPairs.length > 0 && (
              <div className="pt-4 border-t border-warm-grey/40 space-y-3">
                <h3 className="font-mono text-[10px] uppercase tracking-wider text-bronze">
                  Configured Before / After Pairs
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {beforeAfterPairs.map((pair) => (
                    <div key={pair.key} className="border border-warm-grey/50 p-3 bg-ivory-light space-y-2">
                      <p className="font-mono text-[10px] uppercase text-charcoal">
                        Pair: <strong>{pair.key}</strong>
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center">
                          {pair.before ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pair.before.image_url} alt={pair.before.alt_text || 'Before'} className="w-full h-20 object-cover border border-warm-grey/40" />
                          ) : (
                            <div className="h-20 border border-dashed border-warm-grey flex items-center justify-center font-mono text-[10px] text-warm-grey-dark">No Before</div>
                          )}
                          <span className="font-mono text-[9px] uppercase text-warm-grey-dark">Before</span>
                        </div>
                        <div className="text-center">
                          {pair.after ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pair.after.image_url} alt={pair.after.alt_text || 'After'} className="w-full h-20 object-cover border border-warm-grey/40" />
                          ) : (
                            <div className="h-20 border border-dashed border-warm-grey flex items-center justify-center font-mono text-[10px] text-warm-grey-dark">No After</div>
                          )}
                          <span className="font-mono text-[9px] uppercase text-warm-grey-dark">After</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right: Publication Governance & SEO */}
        <aside className="lg:col-span-4 space-y-6">
          <section className="bg-white border border-warm-grey/60 p-5 space-y-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze border-b border-warm-grey/40 pb-2">
              Publication Governance
            </h2>
            <dl className="space-y-1.5 text-xs font-mono text-warm-grey-dark">
              <div>Visibility: <strong className="text-charcoal uppercase">{serverProject.visibility_status}</strong></div>
              <div>Updated: <strong className="text-charcoal">{new Date(serverProject.updated_at).toLocaleString('en-AU')}</strong></div>
            </dl>

            {isDirty && (
              <p className="text-xs font-sans text-bronze">
                Save or discard local edits before changing publication state.
              </p>
            )}

            {!canPublishOrArchive ? (
              <p className="text-xs font-sans text-warm-grey-dark">
                Only Publishers and Administrators can publish or archive portfolio projects.
              </p>
            ) : (
              <div className="space-y-2 pt-2">
                {serverProject.visibility_status !== 'published' && (
                  <button
                    type="button"
                    disabled={isDirty || isTransitioning}
                    onClick={() => {
                      setConfirmAck(false);
                      setPendingVisibility('published');
                    }}
                    className="w-full px-4 py-2 bg-charcoal text-ivory hover:bg-bronze transition-colors text-xs font-mono uppercase tracking-wider cursor-pointer disabled:opacity-40"
                  >
                    Publish Project
                  </button>
                )}
                {serverProject.visibility_status === 'published' && (
                  <button
                    type="button"
                    disabled={isDirty || isTransitioning}
                    onClick={() => handleVisibilityChange('draft')}
                    className="w-full px-4 py-2 border border-warm-grey text-charcoal hover:border-charcoal text-xs font-mono uppercase tracking-wider cursor-pointer disabled:opacity-40"
                  >
                    Unpublish to Draft
                  </button>
                )}
                {serverProject.visibility_status !== 'archived' && (
                  <button
                    type="button"
                    disabled={isDirty || isTransitioning}
                    onClick={() => {
                      setConfirmAck(false);
                      setPendingVisibility('archived');
                    }}
                    className="w-full px-4 py-2 border border-brand-red/50 text-brand-red-dark hover:bg-brand-red/10 text-xs font-mono uppercase tracking-wider cursor-pointer disabled:opacity-40"
                  >
                    Archive Project
                  </button>
                )}
                {serverProject.visibility_status === 'archived' && (
                  <button
                    type="button"
                    disabled={isDirty || isTransitioning}
                    onClick={() => handleVisibilityChange('draft')}
                    className="w-full px-4 py-2 border border-charcoal text-charcoal text-xs font-mono uppercase tracking-wider cursor-pointer disabled:opacity-40"
                  >
                    Restore to Draft
                  </button>
                )}
              </div>
            )}

            {pendingVisibility && (
              <div className="border border-bronze bg-ivory-light p-3.5 space-y-3">
                <p className="font-sans text-xs text-charcoal font-medium">
                  {pendingVisibility === 'published'
                    ? 'Confirm making this project publicly visible on /projects and /api/projects.'
                    : 'Confirm archiving this project and removing it from public portfolio pages.'}
                </p>
                <label className="flex items-start gap-2 text-xs font-sans text-charcoal cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmAck}
                    onChange={(e) => setConfirmAck(e.target.checked)}
                    className="mt-0.5 accent-bronze"
                  />
                  <span>I confirm this publication state change.</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!confirmAck || isTransitioning}
                    onClick={() => handleVisibilityChange(pendingVisibility)}
                    className="px-3 py-1.5 bg-charcoal text-ivory text-xs font-mono uppercase cursor-pointer disabled:opacity-40"
                  >
                    {isTransitioning ? 'Updating...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingVisibility(null)}
                    className="px-3 py-1.5 border border-warm-grey text-xs font-mono uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Flags & SEO */}
          <section className="bg-white border border-warm-grey/60 p-5 space-y-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze border-b border-warm-grey/40 pb-2">
              Display &amp; SEO Metadata
            </h2>

            <label className="flex items-center gap-2 text-xs font-sans text-charcoal cursor-pointer">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={draft.is_featured}
                onChange={(e) => setDraft((p) => ({ ...p, is_featured: e.target.checked }))}
                className="accent-bronze"
              />
              <span>Feature on Homepage Commission Showcase</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-sans text-charcoal cursor-pointer">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={draft.is_demonstration_spec}
                onChange={(e) => setDraft((p) => ({ ...p, is_demonstration_spec: e.target.checked }))}
                className="accent-bronze"
              />
              <span>Mark as Demonstration Study</span>
            </label>

            <div>
              <label htmlFor="proj-edit-sort" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                Display Sort Order
              </label>
              <input
                id="proj-edit-sort"
                type="number"
                min={0}
                max={1000}
                disabled={!canEdit}
                value={draft.sort_order}
                onChange={(e) => setDraft((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))}
                className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-mono text-charcoal"
              />
            </div>

            <div>
              <label htmlFor="proj-edit-seo-title" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                SEO Title ({draft.seo_title.trim().length}/70)
              </label>
              <input
                id="proj-edit-seo-title"
                type="text"
                disabled={!canEdit}
                value={draft.seo_title}
                onChange={(e) => setDraft((p) => ({ ...p, seo_title: e.target.value }))}
                className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-sans text-charcoal"
              />
            </div>

            <div>
              <label htmlFor="proj-edit-seo-desc" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                SEO Description ({draft.seo_description.trim().length}/160)
              </label>
              <textarea
                id="proj-edit-seo-desc"
                rows={3}
                disabled={!canEdit}
                value={draft.seo_description}
                onChange={(e) => setDraft((p) => ({ ...p, seo_description: e.target.value }))}
                className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-sans text-charcoal"
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
