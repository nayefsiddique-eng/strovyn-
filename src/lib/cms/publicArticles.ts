import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeHtml } from '@/lib/security/escapeHtml';
import {
  createPublicSupabaseClient,
  isPublicSupabaseConfigured,
} from '@/lib/supabase/public';
import {
  sanitizeEditorialHtml,
  validateAndCompileTiptapContent,
} from './contentSecurity';
import { validateApprovedEditorialMediaUrl } from './mediaUrlPolicy';

export interface PublicArticleSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  excerpt: string;
  readTimeMinutes: number;
  readTimeLabel: string;
  publishedAt: string | null;
  publishedDateLabel: string;
  authorName: string;
  authorRole: string;
  coverImage: string | null;
  coverImageAlt: string;
  isFeatured: boolean;
}

export interface PublicArticleDetail extends PublicArticleSummary {
  sanitizedHtml: string;
  ogImage: string | null;
  seoTitle: string;
  seoDescription: string;
}

interface PublicArticleDbRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  excerpt: string;
  content?: string | null;
  content_json?: unknown;
  content_html?: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  og_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  is_featured: boolean | null;
  reading_time: number | null;
  author_name: string | null;
  author_role: string | null;
  published_at: string | null;
  created_at?: string | null;
  status?: string | null;
}

const PUBLIC_SUMMARY_COLUMNS = [
  'id',
  'slug',
  'title',
  'subtitle',
  'category',
  'excerpt',
  'featured_image_url',
  'featured_image_alt',
  'is_featured',
  'reading_time',
  'author_name',
  'author_role',
  'published_at',
  'created_at',
].join(', ');

const PUBLIC_DETAIL_COLUMNS = [
  PUBLIC_SUMMARY_COLUMNS,
  'content',
  'content_json',
  'content_html',
  'og_image_url',
  'seo_title',
  'seo_description',
].join(', ');

export function formatPublicArticleDate(iso: string | null | undefined): string {
  if (!iso) return 'Current Publication';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Current Publication';
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Australia/Adelaide',
  });
}

export function formatPublicReadingTime(minutes: number | null | undefined): {
  minutes: number;
  label: string;
} {
  const safeMinutes =
    typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 1
      ? Math.min(60, Math.round(minutes))
      : 4;
  return {
    minutes: safeMinutes,
    label: `${safeMinutes} min read`,
  };
}

function resolveSafePublicMediaUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || !rawUrl.trim()) return null;
  const check = validateApprovedEditorialMediaUrl(rawUrl);
  return check.valid ? check.url : null;
}

function isRowLivePublished(row: PublicArticleDbRow, nowMs: number = Date.now()): boolean {
  if (row.status && row.status !== 'published') return false;
  if (!row.published_at) return true;
  const pubMs = new Date(row.published_at).getTime();
  return Number.isFinite(pubMs) && pubMs <= nowMs;
}

function mapSummaryRow(row: PublicArticleDbRow): PublicArticleSummary {
  const readTime = formatPublicReadingTime(row.reading_time);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? null,
    category: row.category,
    excerpt: row.excerpt,
    readTimeMinutes: readTime.minutes,
    readTimeLabel: readTime.label,
    publishedAt: row.published_at ?? row.created_at ?? null,
    publishedDateLabel: formatPublicArticleDate(row.published_at ?? row.created_at),
    authorName: row.author_name?.trim() || 'Strovyn Painting Co.',
    authorRole: row.author_role?.trim() || row.category,
    coverImage: resolveSafePublicMediaUrl(row.featured_image_url),
    coverImageAlt: row.featured_image_alt?.trim() || row.title,
    isFeatured: Boolean(row.is_featured),
  };
}

export function renderSafePublicArticleHtml(row: {
  content_html?: string | null;
  content_json?: unknown;
  content?: string | null;
}): string {
  if (typeof row.content_html === 'string' && row.content_html.trim()) {
    return sanitizeEditorialHtml(row.content_html, {
      allowSignedPreviewUrls: false,
    });
  }

  if (row.content_json) {
    const compiled = validateAndCompileTiptapContent(row.content_json);
    if (compiled.ok) {
      return compiled.compiled.contentHtml;
    }
  }

  const paragraphs = (row.content || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');

  return sanitizeEditorialHtml(paragraphs, {
    allowSignedPreviewUrls: false,
  });
}

function resolvePublicClient(override?: SupabaseClient): SupabaseClient | null {
  if (override) return override;
  if (!isPublicSupabaseConfigured()) return null;
  return createPublicSupabaseClient();
}

export function derivePublicCategories(articles: PublicArticleSummary[]): string[] {
  const categories = new Set(
    articles.map((a) => a.category.trim()).filter(Boolean)
  );
  return ['All', ...Array.from(categories)];
}

export function selectFeaturedPublicArticle(
  articles: PublicArticleSummary[]
): PublicArticleSummary | null {
  if (articles.length === 0) return null;
  return articles.find((a) => a.isFeatured) ?? articles[0];
}

export async function listPublishedArticles(options?: {
  limit?: number;
  clientOverride?: SupabaseClient;
}): Promise<PublicArticleSummary[]> {
  const client = resolvePublicClient(options?.clientOverride);
  if (!client) {
    return [];
  }

  const nowIso = new Date().toISOString();
  let query = client
    .from('articles')
    .select(PUBLIC_SUMMARY_COLUMNS)
    .eq('status', 'published')
    .or(`published_at.is.null,published_at.lte.${nowIso}`)
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (typeof options?.limit === 'number' && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[CMS-4] Failed loading published insights index:', error.message);
    return [];
  }

  const rows = ((data as unknown as PublicArticleDbRow[]) ?? []).filter((row) =>
    isRowLivePublished(row)
  );
  return rows.map(mapSummaryRow);
}

export async function getPublishedArticleBySlug(
  rawSlug: string,
  clientOverride?: SupabaseClient
): Promise<PublicArticleDetail | null> {
  const slug = rawSlug.trim().toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 96) {
    return null;
  }

  const client = resolvePublicClient(clientOverride);
  if (!client) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from('articles')
    .select(PUBLIC_DETAIL_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published')
    .or(`published_at.is.null,published_at.lte.${nowIso}`)
    .maybeSingle();

  if (error) {
    console.error('[CMS-4] Failed loading published insight by slug:', error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as PublicArticleDbRow;
  if (!isRowLivePublished(row)) {
    return null;
  }

  const summary = mapSummaryRow(row);
  const ogImage =
    resolveSafePublicMediaUrl(row.og_image_url) ?? summary.coverImage;

  return {
    ...summary,
    sanitizedHtml: renderSafePublicArticleHtml(row),
    ogImage,
    seoTitle: row.seo_title?.trim() || summary.title,
    seoDescription: row.seo_description?.trim() || summary.excerpt,
  };
}
