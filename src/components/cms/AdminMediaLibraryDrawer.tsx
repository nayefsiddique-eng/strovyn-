'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Trash2, Upload, X, CheckCircle2 } from 'lucide-react';
import { hasEditorialPermission } from '@/lib/cms/rbac';
import type { EditorialRole } from '@/lib/cms/roles';

export interface EditorialMediaAssetView {
  id: string;
  bucket_id: string;
  storage_path: string;
  visibility: 'private';
  media_ref: string;
  staff_preview_url: string;
  public_url: null;
  mime_type: string;
  byte_size: number;
  width: number;
  height: number;
  alt_text: string;
  article_id: string | null;
  created_at: string;
}

const MAX_CLIENT_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function AdminMediaLibraryDrawer({
  isOpen,
  articleId,
  staffRole,
  targetMode,
  canMutateArticle,
  onClose,
  onSelectForBody,
  onSelectForFeatured,
  onSelectForOg,
  onSessionExpired,
}: {
  isOpen: boolean;
  articleId: string;
  staffRole: EditorialRole;
  targetMode: 'body' | 'featured' | 'og';
  canMutateArticle: boolean;
  onClose: () => void;
  onSelectForBody: (asset: EditorialMediaAssetView) => void;
  onSelectForFeatured: (asset: EditorialMediaAssetView) => void;
  onSelectForOg: (asset: EditorialMediaAssetView) => void;
  onSessionExpired: () => void;
}) {
  const [scope, setScope] = useState<'article' | 'all'>('article');
  const [assets, setAssets] = useState<EditorialMediaAssetView[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadAltText, setUploadAltText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canUpload = hasEditorialPermission(staffRole, 'media:upload');
  const canDeleteOrphan = hasEditorialPermission(staffRole, 'media:delete_orphan');

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    setErrorBanner(null);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: '20',
    });
    if (scope === 'article') {
      params.set('articleId', articleId);
    }

    try {
      const res = await fetch(`/api/admin/insights/media?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const json = (await res.json().catch(() => null)) as
        | {
            success: true;
            items: EditorialMediaAssetView[];
            pagination?: { page: number; totalPages: number };
          }
        | { success: false; error?: string }
        | null;

      if (!res.ok || !json || !json.success) {
        setErrorBanner(
          (json && !json.success && json.error) || 'Unable to load private editorial media.'
        );
        return;
      }

      setAssets(json.items || []);
      setTotalPages(Math.max(1, json.pagination?.totalPages ?? 1));
    } catch {
      setErrorBanner('Network error loading editorial media library.');
    } finally {
      setIsLoading(false);
    }
  }, [articleId, scope, page, onSessionExpired]);

  useEffect(() => {
    if (!isOpen) return;
    loadAssets();
  }, [isOpen, loadAssets]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setStatusNotice(null);

    if (!selectedFile) {
      setErrorBanner('Choose a JPEG, PNG, or WebP image file first.');
      return;
    }
    if (!ALLOWED_TYPES.has(selectedFile.type)) {
      setErrorBanner('Unsupported file type. Upload JPEG, PNG, or WebP images only.');
      return;
    }
    if (selectedFile.size > MAX_CLIENT_UPLOAD_BYTES) {
      setErrorBanner('File exceeds maximum permitted size of 5 MB.');
      return;
    }
    const cleanAlt = uploadAltText.trim();
    if (cleanAlt.length < 3 || cleanAlt.length > 300) {
      setErrorBanner('Descriptive alt text (3–300 characters) is required.');
      return;
    }

    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('altText', cleanAlt);
      form.append('articleId', articleId);

      const res = await fetch('/api/admin/insights/media', {
        method: 'POST',
        body: form,
      });

      if (res.status === 401) {
        onSessionExpired();
        return;
      }

      const json = (await res.json().catch(() => null)) as
        | { success: true; asset: EditorialMediaAssetView }
        | { success: false; error?: string }
        | null;

      if (!res.ok || !json || !json.success) {
        setErrorBanner(
          (json && !json.success && json.error) || 'Unable to upload editorial image.'
        );
        return;
      }

      setSelectedFile(null);
      setUploadAltText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStatusNotice(`Uploaded private asset cleanly (${json.asset.media_ref}).`);
      await loadAssets();
    } catch {
      setErrorBanner('Network failure while uploading image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAsset = async (asset: EditorialMediaAssetView) => {
    setErrorBanner(null);
    setStatusNotice(null);
    setDeletingId(asset.id);
    try {
      const res = await fetch(`/api/admin/insights/media?id=${encodeURIComponent(asset.id)}`, {
        method: 'DELETE',
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const json = (await res.json().catch(() => null)) as
        | { success: true }
        | { success: false; error?: string }
        | null;

      if (!res.ok || !json || !json.success) {
        setErrorBanner(
          (json && !json.success && json.error) ||
            'Cannot delete asset (it may be referenced by an article).'
        );
        return;
      }

      setStatusNotice(`Deleted unreferenced media asset ${asset.id}.`);
      setAssets((prev) => prev.filter((item) => item.id !== asset.id));
    } catch {
      setErrorBanner('Network failure deleting media asset.');
    } finally {
      setDeletingId(null);
    }
  };

  const primaryActionLabel =
    targetMode === 'featured'
      ? 'Use as Cover Image'
      : targetMode === 'og'
        ? 'Use as OG Image'
        : 'Insert into Body';

  return (
    <div
      className="fixed inset-0 z-50 bg-charcoal/55 backdrop-blur-[2px] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cms-media-drawer-title"
    >
      <div className="w-full max-w-2xl bg-ivory h-full overflow-y-auto border-l border-warm-grey flex flex-col">
        {/* Drawer Header */}
        <div className="bg-white border-b border-warm-grey/50 px-6 py-5 flex items-start justify-between gap-4 sticky top-0 z-10">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bronze block mb-1">
              Private Bucket · editorial-media
            </span>
            <h2 id="cms-media-drawer-title" className="type-section-title text-2xl text-charcoal">
              Editorial Media Library
            </h2>
            <p className="font-sans text-xs text-warm-grey-dark mt-1">
              Saved articles persist canonical{' '}
              <code className="font-mono text-charcoal">/api/editorial-media/&lt;uuid&gt;</code>{' '}
              references; previews render strictly over authenticated staff sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close media library"
            className="p-2 border border-warm-grey text-charcoal hover:border-charcoal cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {/* Upload Form */}
          {canUpload && (
            <form
              onSubmit={handleUploadSubmit}
              className="bg-white border border-warm-grey/60 p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-charcoal">
                  Upload Private Editorial Image
                </span>
                <span className="font-mono text-[10px] text-warm-grey-dark">
                  JPEG / PNG / WebP · Max 5 MB
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="cms-media-file-input"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Image File
                  </label>
                  <input
                    id="cms-media-file-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    className="w-full text-xs font-sans file:mr-3 file:py-1.5 file:px-3 file:border file:border-charcoal file:bg-ivory-light file:text-xs file:font-mono file:uppercase file:cursor-pointer"
                  />
                </div>

                <div>
                  <label
                    htmlFor="cms-media-alt-input"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Required Alt Text (3–300 chars)
                  </label>
                  <input
                    id="cms-media-alt-input"
                    type="text"
                    required
                    value={uploadAltText}
                    onChange={(e) => setUploadAltText(e.target.value)}
                    placeholder="e.g. Level 5 drywall joint in North Adelaide villa"
                    className="w-full bg-ivory-light border border-warm-grey px-3 py-1.5 text-xs font-sans text-charcoal"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] text-warm-grey-dark">
                  {selectedFile
                    ? `${selectedFile.name} (${formatBytes(selectedFile.size)})`
                    : 'No file selected'}
                </span>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isUploading ? 'Uploading...' : 'Upload to Private Library'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex border border-warm-grey bg-white">
              <button
                type="button"
                onClick={() => {
                  setScope('article');
                  setPage(1);
                }}
                className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider cursor-pointer ${
                  scope === 'article' ? 'bg-charcoal text-ivory' : 'text-charcoal'
                }`}
              >
                This Article
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope('all');
                  setPage(1);
                }}
                className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider cursor-pointer ${
                  scope === 'all' ? 'bg-charcoal text-ivory' : 'text-charcoal'
                }`}
              >
                All Private Media
              </button>
            </div>

            <button
              type="button"
              onClick={loadAssets}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-warm-grey bg-white font-mono text-[11px] uppercase tracking-wider text-charcoal cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {statusNotice && (
            <div
              role="status"
              className="bg-white border border-emerald-700/40 px-4 py-2.5 text-xs font-sans text-emerald-900 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{statusNotice}</span>
            </div>
          )}

          {errorBanner && (
            <div
              role="alert"
              className="bg-white border border-brand-red/40 px-4 py-2.5 text-xs font-sans text-brand-red-dark"
            >
              {errorBanner}
            </div>
          )}

          {/* Media Asset Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-52 bg-white border border-warm-grey/40 animate-pulse" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="bg-white border border-warm-grey/60 p-8 text-center text-sm font-sans text-warm-grey-dark">
              {scope === 'article'
                ? 'No private assets uploaded for this article yet. Upload above or switch to All Private Media.'
                : 'No private editorial media assets found.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-white border border-warm-grey/60 flex flex-col overflow-hidden"
                >
                  <div className="relative aspect-[16/10] bg-charcoal/90 border-b border-warm-grey/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.staff_preview_url}
                      alt={asset.alt_text}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="font-sans text-xs font-medium text-charcoal line-clamp-2">
                        {asset.alt_text}
                      </p>
                      <p className="font-mono text-[10px] text-warm-grey-dark mt-1 truncate">
                        {asset.media_ref}
                      </p>
                      <p className="font-mono text-[10px] text-warm-grey-dark">
                        {asset.width}&times;{asset.height} &middot; {formatBytes(asset.byte_size)}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-warm-grey/30">
                      {canMutateArticle && (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (targetMode === 'featured') onSelectForFeatured(asset);
                              else if (targetMode === 'og') onSelectForOg(asset);
                              else onSelectForBody(asset);
                              onClose();
                            }}
                            className="flex-1 px-2.5 py-1.5 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-[10px] uppercase tracking-wider cursor-pointer"
                          >
                            {primaryActionLabel}
                          </button>

                          {targetMode !== 'body' && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectForBody(asset);
                                onClose();
                              }}
                              className="px-2.5 py-1.5 border border-warm-grey text-charcoal hover:border-charcoal font-mono text-[10px] uppercase tracking-wider cursor-pointer"
                            >
                              + Body
                            </button>
                          )}

                          {targetMode === 'body' && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectForFeatured(asset);
                                onClose();
                              }}
                              className="px-2.5 py-1.5 border border-warm-grey text-charcoal hover:border-charcoal font-mono text-[10px] uppercase tracking-wider cursor-pointer"
                            >
                              Cover
                            </button>
                          )}
                        </div>
                      )}

                      {canDeleteOrphan && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset(asset)}
                          disabled={deletingId === asset.id}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1 border border-warm-grey/70 text-[10px] font-mono uppercase tracking-wider text-brand-red-dark hover:border-brand-red cursor-pointer disabled:opacity-40"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>
                            {deletingId === asset.id ? 'Deleting...' : 'Delete Orphan'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="px-3 py-1.5 border border-warm-grey bg-white text-xs font-mono uppercase cursor-pointer disabled:opacity-40"
              >
                Prev
              </button>
              <span className="font-mono text-xs text-warm-grey-dark">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="px-3 py-1.5 border border-warm-grey bg-white text-xs font-mono uppercase cursor-pointer disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
