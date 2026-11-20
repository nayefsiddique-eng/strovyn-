import type { TiptapDoc } from './contentSecurity';
import type { ArticleStatus, EditorialRole } from './roles';
import { canEditArticleInStatus } from './rbac';
import { generateSlug, isValidSlug } from './slugs';
import { validateApprovedEditorialMediaUrl } from './mediaUrlPolicy';

export const EDITORIAL_CATEGORIES = [
  'Surface Preparation',
  'Paint Chemistry',
  'Painting Techniques',
  'Heritage Conservation',
  'Architectural Finishes',
] as const;

export interface EditableArticleFields {
  title: string;
  subtitle: string;
  slug: string;
  category: string;
  excerpt: string;
  content_json: TiptapDoc;
  featured_image_url: string;
  featured_image_alt: string;
  og_image_url: string;
  seo_title: string;
  seo_description: string;
  is_featured: boolean;
  author_name: string;
  author_role: string;
}

export interface EditorialArticleDetail {
  id: string;
  title: string;
  subtitle?: string | null;
  slug: string;
  category: string;
  excerpt: string;
  status: ArticleStatus;
  content?: string;
  content_json?: TiptapDoc | null;
  content_html?: string | null;
  featured_image_url?: string | null;
  featured_image_alt?: string | null;
  og_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  is_featured?: boolean;
  reading_time?: number;
  author_name: string;
  author_role?: string | null;
  approved_at?: string | null;
  archived_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

const CANONICAL_EDITORIAL_MEDIA_REGEX =
  /^\/api\/editorial-media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Resolves canonical `/api/editorial-media/<uuid>` URLs to the authenticated
 * staff preview endpoint (`/api/admin/insights/media/<uuid>`) strictly for
 * visual display inside `/admin/insights/**` editors and metadata thumbnails.
 * Never mutates persisted ProseMirror JSON or clipboard serialization.
 */
export function resolveEditorPreviewImageSrc(rawSrc: string | null | undefined): string {
  const trimmed = typeof rawSrc === 'string' ? rawSrc.trim() : '';
  if (!trimmed) return '';
  const match = trimmed.match(CANONICAL_EDITORIAL_MEDIA_REGEX);
  if (match) {
    return `/api/admin/insights/media/${match[1].toLowerCase()}`;
  }
  return trimmed;
}

export function buildStarterTiptapDoc(openingParagraph?: string): TiptapDoc {
  const text = (openingParagraph || '').trim();
  const safeText =
    text.length >= 20
      ? text
      : 'Begin drafting technical painting specifications and substrate preparation notes here.';
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: safeText }],
      },
    ],
  };
}

export function normalizeTiptapContentForEditor(
  rawJson: unknown,
  fallbackPlainText?: string | null
): TiptapDoc {
  if (
    rawJson &&
    typeof rawJson === 'object' &&
    (rawJson as { type?: unknown }).type === 'doc' &&
    Array.isArray((rawJson as { content?: unknown }).content) &&
    (rawJson as { content: unknown[] }).content.length > 0
  ) {
    return rawJson as TiptapDoc;
  }

  const paragraphs = (fallbackPlainText || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length > 0) {
    return {
      type: 'doc',
      content: paragraphs.map((p) => ({
        type: 'paragraph',
        content: [{ type: 'text', text: p }],
      })),
    };
  }

  return buildStarterTiptapDoc();
}

export function extractEditableSnapshot(
  article: EditorialArticleDetail
): EditableArticleFields {
  return {
    title: article.title ?? '',
    subtitle: article.subtitle ?? '',
    slug: article.slug ?? '',
    category: article.category ?? EDITORIAL_CATEGORIES[0],
    excerpt: article.excerpt ?? '',
    content_json: normalizeTiptapContentForEditor(article.content_json, article.content),
    featured_image_url: article.featured_image_url ?? '',
    featured_image_alt: article.featured_image_alt ?? '',
    og_image_url: article.og_image_url ?? '',
    seo_title: article.seo_title ?? '',
    seo_description: article.seo_description ?? '',
    is_featured: Boolean(article.is_featured),
    author_name: article.author_name ?? 'Strovyn Painting Co.',
    author_role: article.author_role ?? '',
  };
}

function normOpt(val: string): string | null {
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function canonicalizeTiptapNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => canonicalizeTiptapNode(item));
  }
  if (!node || typeof node !== 'object') {
    return node;
  }

  const record = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const key of Object.keys(record).sort()) {
    const val = record[key];
    if (val === undefined) continue;

    if (key === 'attrs' && val && typeof val === 'object' && !Array.isArray(val)) {
      const cleanedAttrs: Record<string, unknown> = {};
      for (const attrKey of Object.keys(val as Record<string, unknown>).sort()) {
        const attrVal = (val as Record<string, unknown>)[attrKey];
        if (attrVal !== null && attrVal !== undefined) {
          cleanedAttrs[attrKey] = canonicalizeTiptapNode(attrVal);
        }
      }
      if (Object.keys(cleanedAttrs).length > 0) {
        out.attrs = cleanedAttrs;
      }
      continue;
    }

    if (key === 'content' && Array.isArray(val)) {
      if (val.length === 0) continue;
      out.content = val.map((child) => canonicalizeTiptapNode(child));
      continue;
    }

    if (key === 'marks' && Array.isArray(val)) {
      if (val.length === 0) continue;
      out.marks = val.map((mark) => canonicalizeTiptapNode(mark));
      continue;
    }

    out[key] = canonicalizeTiptapNode(val);
  }

  return out;
}

/**
 * Produces a canonical JSON string for a Tiptap document so semantic comparisons
 * ignore PostgreSQL JSONB key reordering and ProseMirror default `null` attrs /
 * empty `content: []` arrays while preserving all real content, structure, and attrs.
 */
export function canonicalSerializeTiptapDoc(doc: TiptapDoc | null | undefined): string {
  return JSON.stringify(canonicalizeTiptapNode(doc ?? null));
}

export function areTiptapDocsEqual(
  a: TiptapDoc | null | undefined,
  b: TiptapDoc | null | undefined
): boolean {
  return canonicalSerializeTiptapDoc(a) === canonicalSerializeTiptapDoc(b);
}

export function isArticleFormDirty(
  baseline: EditableArticleFields,
  draft: EditableArticleFields
): boolean {
  return (
    baseline.title.trim() !== draft.title.trim() ||
    normOpt(baseline.subtitle) !== normOpt(draft.subtitle) ||
    baseline.slug.trim() !== draft.slug.trim() ||
    baseline.category.trim() !== draft.category.trim() ||
    baseline.excerpt.trim() !== draft.excerpt.trim() ||
    normOpt(baseline.featured_image_url) !== normOpt(draft.featured_image_url) ||
    normOpt(baseline.featured_image_alt) !== normOpt(draft.featured_image_alt) ||
    normOpt(baseline.og_image_url) !== normOpt(draft.og_image_url) ||
    normOpt(baseline.seo_title) !== normOpt(draft.seo_title) ||
    normOpt(baseline.seo_description) !== normOpt(draft.seo_description) ||
    baseline.is_featured !== draft.is_featured ||
    baseline.author_name.trim() !== draft.author_name.trim() ||
    normOpt(baseline.author_role) !== normOpt(draft.author_role) ||
    !areTiptapDocsEqual(baseline.content_json, draft.content_json)
  );
}

/**
 * Validates draft metadata before issuing `PATCH /api/admin/insights/[id]` so
 * obvious formatting issues fail immediately on the client without masking server checks.
 */
export function validateEditableArticleClient(
  draft: EditableArticleFields
): string | null {
  if (draft.title.trim().length < 5 || draft.title.trim().length > 180) {
    return 'Title must be between 5 and 180 characters.';
  }
  if (!isValidSlug(draft.slug.trim())) {
    return 'Slug must be URL-safe kebab-case (3–96 lowercase characters, no reserved words).';
  }
  if (!/^[A-Za-z0-9 &/-]{2,60}$/.test(draft.category.trim())) {
    return 'Category must be 2–60 alphanumeric, space, &, /, or hyphen characters.';
  }
  if (draft.excerpt.trim().length < 20 || draft.excerpt.trim().length > 360) {
    return 'Excerpt must be between 20 and 360 characters.';
  }
  if (draft.featured_image_url.trim()) {
    const check = validateApprovedEditorialMediaUrl(draft.featured_image_url);
    if (!check.valid) return `Featured image: ${check.reason}`;
  }
  if (draft.featured_image_alt.trim() && (draft.featured_image_alt.trim().length < 3 || draft.featured_image_alt.trim().length > 300)) {
    return 'Featured image alt text must be between 3 and 300 characters.';
  }
  if (draft.og_image_url.trim()) {
    const check = validateApprovedEditorialMediaUrl(draft.og_image_url);
    if (!check.valid) return `OG image: ${check.reason}`;
  }
  if (draft.seo_title.trim() && (draft.seo_title.trim().length < 3 || draft.seo_title.trim().length > 70)) {
    return 'SEO title must be between 3 and 70 characters.';
  }
  if (draft.seo_description.trim() && (draft.seo_description.trim().length < 10 || draft.seo_description.trim().length > 160)) {
    return 'SEO description must be between 10 and 160 characters.';
  }
  if (draft.author_name.trim().length < 2 || draft.author_name.trim().length > 100) {
    return 'Author name must be between 2 and 100 characters.';
  }
  return null;
}

/**
 * Builds a minimal `UpdateArticleSchema`-compliant `PATCH` payload with the
 * required optimistic concurrency token `expected_updated_at`. Returns `null`
 * if zero editable fields changed.
 */
export function buildArticlePatchPayload(
  baseline: EditableArticleFields,
  draft: EditableArticleFields,
  expectedUpdatedAt: string
): Record<string, unknown> | null {
  const payload: Record<string, unknown> = {};

  if (baseline.title.trim() !== draft.title.trim()) {
    payload.title = draft.title.trim();
  }
  if (normOpt(baseline.subtitle) !== normOpt(draft.subtitle)) {
    payload.subtitle = normOpt(draft.subtitle);
  }
  if (baseline.slug.trim() !== draft.slug.trim()) {
    payload.slug = draft.slug.trim();
  }
  if (baseline.category.trim() !== draft.category.trim()) {
    payload.category = draft.category.trim();
  }
  if (baseline.excerpt.trim() !== draft.excerpt.trim()) {
    payload.excerpt = draft.excerpt.trim();
  }
  if (normOpt(baseline.featured_image_url) !== normOpt(draft.featured_image_url)) {
    payload.featured_image_url = normOpt(draft.featured_image_url);
  }
  if (normOpt(baseline.featured_image_alt) !== normOpt(draft.featured_image_alt)) {
    payload.featured_image_alt = normOpt(draft.featured_image_alt);
  }
  if (normOpt(baseline.og_image_url) !== normOpt(draft.og_image_url)) {
    payload.og_image_url = normOpt(draft.og_image_url);
  }
  if (normOpt(baseline.seo_title) !== normOpt(draft.seo_title)) {
    payload.seo_title = normOpt(draft.seo_title);
  }
  if (normOpt(baseline.seo_description) !== normOpt(draft.seo_description)) {
    payload.seo_description = normOpt(draft.seo_description);
  }
  if (baseline.is_featured !== draft.is_featured) {
    payload.is_featured = draft.is_featured;
  }
  if (baseline.author_name.trim() !== draft.author_name.trim()) {
    payload.author_name = draft.author_name.trim();
  }
  if (normOpt(baseline.author_role) !== normOpt(draft.author_role)) {
    payload.author_role = normOpt(draft.author_role);
  }
  if (!areTiptapDocsEqual(baseline.content_json, draft.content_json)) {
    payload.content_json = draft.content_json;
  }

  if (Object.keys(payload).length === 0) {
    return null;
  }

  payload.expected_updated_at = expectedUpdatedAt;
  return payload;
}

export function deriveAutoSlug(title: string): string {
  return generateSlug(title);
}

export function canStaffEditArticle(role: EditorialRole, status: ArticleStatus): boolean {
  return canEditArticleInStatus(role, status);
}
