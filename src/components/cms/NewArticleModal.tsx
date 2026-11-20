'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import {
  buildStarterTiptapDoc,
  deriveAutoSlug,
  EDITORIAL_CATEGORIES,
} from '@/lib/cms/editorHelpers';
import { isValidSlug } from '@/lib/cms/slugs';
import type { StaffViewerIdentity } from './StaffAuthGateCards';

export function NewArticleModal({
  isOpen,
  staff,
  onClose,
  onSessionExpired,
  onAccessDenied,
}: {
  isOpen: boolean;
  staff: StaffViewerIdentity;
  onClose: () => void;
  onSessionExpired: () => void;
  onAccessDenied: (code: string, status: number, message: string) => void;
}) {
  const router = useRouter();
  const submitLockRef = useRef(false);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState<string>(EDITORIAL_CATEGORIES[0]);
  const [excerpt, setExcerpt] = useState('');
  const [openingParagraph, setOpeningParagraph] = useState('');
  const [authorName, setAuthorName] = useState(staff.full_name || 'Strovyn Painting Co.');
  const [authorRole, setAuthorRole] = useState('Architectural Finishes');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    if (!slugTouched) {
      setSlug(deriveAutoSlug(nextTitle));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;

    const trimmedTitle = title.trim();
    const trimmedSlug = slug.trim();
    const trimmedExcerpt = excerpt.trim();
    const trimmedBody = openingParagraph.trim();

    if (trimmedTitle.length < 5 || trimmedTitle.length > 180) {
      setErrorMessage('Title must be between 5 and 180 characters.');
      return;
    }
    if (!isValidSlug(trimmedSlug)) {
      setErrorMessage('Slug must be URL-safe kebab-case (3–96 lowercase characters).');
      return;
    }
    if (trimmedExcerpt.length < 20 || trimmedExcerpt.length > 360) {
      setErrorMessage('Excerpt must be between 20 and 360 characters.');
      return;
    }
    if (trimmedBody.length < 20) {
      setErrorMessage('Initial opening copy must be at least 20 characters.');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          slug: trimmedSlug,
          category: category.trim(),
          excerpt: trimmedExcerpt,
          content_json: buildStarterTiptapDoc(trimmedBody),
          author_name: authorName.trim() || 'Strovyn Painting Co.',
          author_role: authorRole.trim() || null,
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | { success: true; article: { id: string } }
        | { success: false; code?: string; error?: string }
        | null;

      if (res.status === 401) {
        onClose();
        onSessionExpired();
        return;
      }

      if (res.status === 403) {
        if (json && !json.success && json.code && json.code !== 'CSRF_FAILED' && json.code !== 'FORBIDDEN') {
          onClose();
          onAccessDenied(json.code, res.status, json.error || 'Access denied.');
          return;
        }
        setErrorMessage((json && !json.success && json.error) || 'You are not authorized to create drafts.');
        return;
      }

      if (res.status === 409) {
        setErrorMessage(
          (json && !json.success && json.error) ||
            `Slug '${trimmedSlug}' is already in use. Choose a distinct slug.`
        );
        return;
      }

      if (!res.ok || !json || !json.success || !json.article?.id) {
        setErrorMessage(
          (json && !json.success && json.error) || 'Unable to create draft article.'
        );
        return;
      }

      router.push(`/admin/insights/articles/${json.article.id}`);
    } catch {
      setErrorMessage('Network error creating article draft. Check connection and retry.');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cms-new-article-title"
    >
      <div className="w-full max-w-2xl bg-white border border-warm-grey p-6 sm:p-8 shadow-xl my-8">
        <div className="flex items-start justify-between gap-4 border-b border-warm-grey/40 pb-4 mb-6">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bronze block mb-1">
              Strovyn Editorial Desk
            </span>
            <h2 id="cms-new-article-title" className="type-section-title text-2xl sm:text-3xl text-charcoal">
              Create New Draft
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close new draft dialog"
            className="p-2 border border-warm-grey/60 text-charcoal hover:border-charcoal cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="cms-new-title"
              className="block font-mono text-[11px] uppercase tracking-wider text-charcoal mb-1.5"
            >
              Title <span className="text-warm-grey-dark">({title.trim().length}/180, min 5)</span>
            </label>
            <input
              id="cms-new-title"
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Mineral Silicate Breathability on Heritage Masonry"
              className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2.5 text-sm font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cms-new-slug"
                className="block font-mono text-[11px] uppercase tracking-wider text-charcoal mb-1.5"
              >
                URL Slug
              </label>
              <input
                id="cms-new-slug"
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                placeholder="mineral-silicate-breathability"
                className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2 text-xs font-mono text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
              />
            </div>

            <div>
              <label
                htmlFor="cms-new-category"
                className="block font-mono text-[11px] uppercase tracking-wider text-charcoal mb-1.5"
              >
                Category
              </label>
              <select
                id="cms-new-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2 text-sm font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
              >
                {EDITORIAL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="cms-new-excerpt"
              className="block font-mono text-[11px] uppercase tracking-wider text-charcoal mb-1.5"
            >
              Excerpt <span className="text-warm-grey-dark">({excerpt.trim().length}/360, min 20)</span>
            </label>
            <textarea
              id="cms-new-excerpt"
              rows={2}
              required
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Concise editorial abstract displayed on listings and social previews (minimum 20 characters)."
              className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2 text-sm font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
            />
          </div>

          <div>
            <label
              htmlFor="cms-new-body"
              className="block font-mono text-[11px] uppercase tracking-wider text-charcoal mb-1.5"
            >
              Initial Opening Paragraph{' '}
              <span className="text-warm-grey-dark">({openingParagraph.trim().length} chars, min 20)</span>
            </label>
            <textarea
              id="cms-new-body"
              rows={3}
              required
              value={openingParagraph}
              onChange={(e) => setOpeningParagraph(e.target.value)}
              placeholder="Draft an opening paragraph (minimum 20 characters) — full Tiptap rich formatting opens next."
              className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2 text-sm font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cms-new-author"
                className="block font-mono text-[11px] uppercase tracking-wider text-charcoal mb-1.5"
              >
                Author Byline
              </label>
              <input
                id="cms-new-author"
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2 text-sm font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
              />
            </div>

            <div>
              <label
                htmlFor="cms-new-author-role"
                className="block font-mono text-[11px] uppercase tracking-wider text-charcoal mb-1.5"
              >
                Author Credentials
              </label>
              <input
                id="cms-new-author-role"
                type="text"
                value={authorRole}
                onChange={(e) => setAuthorRole(e.target.value)}
                className="w-full bg-ivory-light border border-warm-grey px-3.5 py-2 text-sm font-sans text-charcoal focus-visible:outline-2 focus-visible:outline-bronze"
              />
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="border border-brand-red/30 bg-brand-red/5 px-3.5 py-2.5 text-xs font-sans text-brand-red-dark"
            >
              {errorMessage}
            </div>
          )}

          <div className="pt-4 border-t border-warm-grey/40 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-charcoal text-ivory hover:bg-bronze transition-colors text-xs font-mono uppercase tracking-wider cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Draft...' : 'Create & Open Editor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
