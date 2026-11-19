import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeHtml } from '@/lib/security/escapeHtml';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { validateAndCompileTiptapContent, sanitizeEditorialHtml } from './contentSecurity';
import { EditorialHttpError } from './http';
import {
  assertReferencedMediaAssetsExist,
  extractMediaRefsFromArticleFields,
  resolveMediaUrlsForPreview,
} from './mediaService';
import {
  buildCanonicalEditorialMediaRef,
  validateApprovedEditorialMediaUrl,
} from './mediaUrlPolicy';
import { canEditArticleInStatus, canTransitionArticleStatus } from './rbac';
import type { ArticleStatus, EditorialRole, StaffProfile } from './roles';
import { generateSlug, isValidSlug } from './slugs';
import {
  CreateArticleSchema,
  ListArticlesQuerySchema,
  TransitionArticleSchema,
  UpdateArticleSchema,
} from './validators';

export interface ArticleRecord {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  excerpt: string;
  content: string;
  content_json: unknown;
  content_html: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  og_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  category: string;
  status: ArticleStatus;
  is_featured: boolean;
  reading_time: number;
  author_name: string;
  author_role: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  legacy_static_date: string | null;
  publish_attempts: number;
  last_publish_error: string | null;
  next_retry_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_by: string | null;
  archived_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

const BASE_LIST_COLUMNS = [
  'id',
  'title',
  'subtitle',
  'slug',
  'excerpt',
  'featured_image_url',
  'featured_image_alt',
  'og_image_url',
  'seo_title',
  'seo_description',
  'category',
  'status',
  'is_featured',
  'reading_time',
  'author_name',
  'author_role',
  'published_at',
  'legacy_static_date',
  'created_at',
  'updated_at',
] as const;

const PUBLISHER_EXTRA_COLUMNS = [
  'approved_by',
  'approved_at',
  'published_by',
  'archived_by',
  'archived_at',
  'created_by',
  'updated_by',
  'scheduled_at',
  'publish_attempts',
  'last_publish_error',
  'next_retry_at',
] as const;

const DETAIL_BODY_COLUMNS = ['content', 'content_json', 'content_html'] as const;

function getSelectColumnsForRole(
  role: EditorialRole,
  includeBody: boolean
): string {
  const cols: string[] = [...BASE_LIST_COLUMNS];
  if (includeBody) {
    cols.push(...DETAIL_BODY_COLUMNS);
  }
  if (role === 'publisher' || role === 'admin') {
    cols.push(...PUBLISHER_EXTRA_COLUMNS);
  }
  return cols.join(', ');
}

export function projectArticleForRole(
  row: ArticleRecord,
  role: EditorialRole,
  includeBody: boolean
): Partial<ArticleRecord> {
  const projected: Record<string, unknown> = {};
  for (const key of BASE_LIST_COLUMNS) {
    projected[key] = row[key];
  }
  if (includeBody) {
    for (const key of DETAIL_BODY_COLUMNS) {
      projected[key] = row[key];
    }
  }
  if (role === 'publisher' || role === 'admin') {
    for (const key of PUBLISHER_EXTRA_COLUMNS) {
      projected[key] = row[key];
    }
  }
  return projected as Partial<ArticleRecord>;
}

function getClient(override?: SupabaseClient): SupabaseClient {
  return override ?? createServiceRoleClient();
}

export async function listEditorialArticles(
  staff: StaffProfile,
  rawQuery: Record<string, unknown>,
  clientOverride?: SupabaseClient
) {
  const parsed = ListArticlesQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid article query parameters.'
    );
  }

  const { page, pageSize, status, category, search, sortBy, sortOrder } = parsed.data;
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  const client = getClient(clientOverride);
  let query = client
    .from('articles')
    .select(getSelectColumnsForRole(staff.role, false), { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }
  if (category) {
    query = query.eq('category', category);
  }
  if (search) {
    query = query.or(
      `title.ilike.%${search}%,excerpt.ilike.%${search}%,slug.ilike.%${search}%`
    );
  }

  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(fromIdx, toIdx);

  const { data, count, error } = await query;
  if (error) {
    throw error;
  }

  const rows = ((data as unknown as ArticleRecord[]) ?? []).map((row) =>
    projectArticleForRole(row, staff.role, false)
  );

  return {
    items: rows,
    pagination: {
      page,
      pageSize,
      total: count ?? rows.length,
      totalPages: Math.max(1, Math.ceil((count ?? rows.length) / pageSize)),
    },
  };
}

export async function getEditorialArticleById(
  staff: StaffProfile,
  articleId: string,
  clientOverride?: SupabaseClient
): Promise<Partial<ArticleRecord>> {
  const client = getClient(clientOverride);
  const { data, error } = await client
    .from('articles')
    .select(getSelectColumnsForRole(staff.role, true))
    .eq('id', articleId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Article not found.');
  }

  return projectArticleForRole(data as unknown as ArticleRecord, staff.role, true);
}

export async function createEditorialDraft(
  staff: StaffProfile,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<Partial<ArticleRecord>> {
  const parsed = CreateArticleSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      issue?.message ?? 'Invalid article creation payload.'
    );
  }

  const input = parsed.data;
  const resolvedSlug = input.slug ? input.slug : generateSlug(input.title);
  if (!isValidSlug(resolvedSlug)) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      'Unable to derive a valid kebab-case slug (3-96 characters) from title.'
    );
  }

  const compiledRes = validateAndCompileTiptapContent(input.content_json);
  if (!compiledRes.ok) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', compiledRes.error);
  }

  const client = getClient(clientOverride);
  await assertReferencedMediaAssetsExist(
    {
      featured_image_url: input.featured_image_url ?? null,
      og_image_url: input.og_image_url ?? null,
      content_json: compiledRes.compiled.contentJson,
    },
    client
  );

  const { data: existingSlug, error: slugErr } = await client
    .from('articles')
    .select('id')
    .eq('slug', resolvedSlug)
    .maybeSingle();

  if (slugErr) throw slugErr;
  if (existingSlug) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      `An article with slug '${resolvedSlug}' already exists.`
    );
  }

  const insertPayload = {
    title: input.title,
    subtitle: input.subtitle ?? null,
    slug: resolvedSlug,
    category: input.category,
    excerpt: input.excerpt,
    content: compiledRes.compiled.plainText,
    content_json: compiledRes.compiled.contentJson,
    content_html: compiledRes.compiled.contentHtml,
    featured_image_url: input.featured_image_url ?? null,
    featured_image_alt: input.featured_image_alt ?? null,
    og_image_url: input.og_image_url ?? null,
    seo_title: input.seo_title ?? null,
    seo_description: input.seo_description ?? null,
    is_featured: input.is_featured ?? false,
    reading_time: compiledRes.compiled.readingTimeMinutes,
    author_name: input.author_name ?? 'Strovyn Painting Co.',
    author_role: input.author_role ?? null,
    status: 'draft' as const,
    published_at: null,
    created_by: staff.id,
    updated_by: staff.id,
  };

  const { data, error } = await client
    .from('articles')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) throw error;
  return projectArticleForRole(data as ArticleRecord, staff.role, true);
}

export async function updateEditorialArticle(
  staff: StaffProfile,
  articleId: string,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<Partial<ArticleRecord>> {
  const parsed = UpdateArticleSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      issue?.message ?? 'Invalid article update payload.'
    );
  }

  const input = parsed.data;
  const client = getClient(clientOverride);

  const { data: existingRow, error: fetchErr } = await client
    .from('articles')
    .select('*')
    .eq('id', articleId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existingRow) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Article not found.');
  }

  const existing = existingRow as ArticleRecord;

  if (!canEditArticleInStatus(staff.role, existing.status)) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      `Role '${staff.role}' cannot modify articles in '${existing.status}' status.`
    );
  }

  if (input.expected_updated_at) {
    const expectedMs = new Date(input.expected_updated_at).getTime();
    const actualMs = new Date(existing.updated_at).getTime();
    if (!Number.isFinite(expectedMs) || expectedMs !== actualMs) {
      throw new EditorialHttpError(
        409,
        'CONFLICT',
        'Concurrent modification detected. Reload the latest version before saving.'
      );
    }
  }

  if (input.slug && input.slug !== existing.slug) {
    if (existing.status === 'published') {
      throw new EditorialHttpError(
        422,
        'INVALID_TRANSITION',
        'Published article slugs cannot be changed without archiving first.'
      );
    }
    const { data: slugConflict, error: slugErr } = await client
      .from('articles')
      .select('id')
      .eq('slug', input.slug)
      .neq('id', articleId)
      .maybeSingle();

    if (slugErr) throw slugErr;
    if (slugConflict) {
      throw new EditorialHttpError(
        409,
        'CONFLICT',
        `Slug '${input.slug}' is already in use by another article.`
      );
    }
  }

  const updateFields: Record<string, unknown> = {
    updated_by: staff.id,
  };

  if (input.title !== undefined) updateFields.title = input.title;
  if (input.subtitle !== undefined) updateFields.subtitle = input.subtitle;
  if (input.slug !== undefined) updateFields.slug = input.slug;
  if (input.category !== undefined) updateFields.category = input.category;
  if (input.excerpt !== undefined) updateFields.excerpt = input.excerpt;
  if (input.featured_image_url !== undefined)
    updateFields.featured_image_url = input.featured_image_url;
  if (input.featured_image_alt !== undefined)
    updateFields.featured_image_alt = input.featured_image_alt;
  if (input.og_image_url !== undefined)
    updateFields.og_image_url = input.og_image_url;
  if (input.seo_title !== undefined) updateFields.seo_title = input.seo_title;
  if (input.seo_description !== undefined)
    updateFields.seo_description = input.seo_description;
  if (input.is_featured !== undefined) updateFields.is_featured = input.is_featured;
  if (input.author_name !== undefined) updateFields.author_name = input.author_name;
  if (input.author_role !== undefined) updateFields.author_role = input.author_role;

  if (input.content_json !== undefined) {
    const compiledRes = validateAndCompileTiptapContent(input.content_json);
    if (!compiledRes.ok) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', compiledRes.error);
    }
    updateFields.content_json = compiledRes.compiled.contentJson;
    updateFields.content_html = compiledRes.compiled.contentHtml;
    updateFields.content = compiledRes.compiled.plainText;
    updateFields.reading_time = compiledRes.compiled.readingTimeMinutes;
  }

  await assertReferencedMediaAssetsExist(
    {
      featured_image_url:
        input.featured_image_url !== undefined ? input.featured_image_url : null,
      og_image_url: input.og_image_url !== undefined ? input.og_image_url : null,
      content_json: updateFields.content_json,
    },
    client
  );

  const nextImageUrl =
    updateFields.featured_image_url !== undefined
      ? (updateFields.featured_image_url as string | null)
      : existing.featured_image_url;
  const nextImageAlt =
    updateFields.featured_image_alt !== undefined
      ? (updateFields.featured_image_alt as string | null)
      : existing.featured_image_alt;

  if (
    existing.status !== 'draft' &&
    nextImageUrl &&
    (!nextImageAlt || nextImageAlt.trim().length < 3)
  ) {
    throw new EditorialHttpError(
      422,
      'ARTICLE_INCOMPLETE',
      'Featured image alt text (minimum 3 characters) is required when a cover image is set.'
    );
  }

  let updateQuery = client
    .from('articles')
    .update(updateFields)
    .eq('id', articleId);

  // Optimistic compare-and-set on exact stored `updated_at`
  updateQuery = updateQuery.eq('updated_at', existing.updated_at);

  const { data: updatedRows, error: updateErr } = await updateQuery.select('*');
  if (updateErr) throw updateErr;

  if (!updatedRows || updatedRows.length === 0) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'Article was modified concurrently before this update could be saved.'
    );
  }

  return projectArticleForRole(updatedRows[0] as ArticleRecord, staff.role, true);
}

function assertArticlePreconditionsForTransition(
  article: ArticleRecord,
  toStatus: ArticleStatus
): void {
  if (toStatus === 'review' || toStatus === 'approved' || toStatus === 'published') {
    if (!article.title || article.title.trim().length < 5) {
      throw new EditorialHttpError(422, 'ARTICLE_INCOMPLETE', 'Title is required before advancing status.');
    }
    if (!isValidSlug(article.slug)) {
      throw new EditorialHttpError(422, 'ARTICLE_INCOMPLETE', 'Valid slug is required before advancing status.');
    }
    if (!article.excerpt || article.excerpt.trim().length < 20) {
      throw new EditorialHttpError(422, 'ARTICLE_INCOMPLETE', 'Excerpt (min 20 characters) is required before advancing status.');
    }
    if (!article.content || article.content.trim().length < 20) {
      throw new EditorialHttpError(422, 'ARTICLE_INCOMPLETE', 'Article body is incomplete.');
    }
    if (
      article.featured_image_url &&
      (!article.featured_image_alt || article.featured_image_alt.trim().length < 3)
    ) {
      throw new EditorialHttpError(
        422,
        'ARTICLE_INCOMPLETE',
        'Featured image alt text is required when a cover image is attached.'
      );
    }
  }
}

export async function transitionEditorialArticle(
  staff: StaffProfile,
  articleId: string,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<Partial<ArticleRecord>> {
  const parsed = TransitionArticleSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid transition payload.'
    );
  }

  const { toStatus, note, expected_updated_at } = parsed.data;

  // CMS-2 explicitly forbids implementing scheduled publishing or cron
  if (toStatus === 'scheduled') {
    throw new EditorialHttpError(
      422,
      'SCHEDULING_DEFERRED',
      'Scheduled publishing is deferred to CMS-4 and is disabled in CMS-2.'
    );
  }

  const client = getClient(clientOverride);
  const { data: existingRow, error: fetchErr } = await client
    .from('articles')
    .select('*')
    .eq('id', articleId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existingRow) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Article not found.');
  }

  const existing = existingRow as ArticleRecord;

  if (expected_updated_at) {
    const expectedMs = new Date(expected_updated_at).getTime();
    const actualMs = new Date(existing.updated_at).getTime();
    if (!Number.isFinite(expectedMs) || expectedMs !== actualMs) {
      throw new EditorialHttpError(
        409,
        'CONFLICT',
        'Article state changed concurrently. Refresh and retry the workflow action.'
      );
    }
  }

  const check = canTransitionArticleStatus(staff.role, existing.status, toStatus);
  if (!check.allowed) {
    if (check.requiredAction) {
      throw new EditorialHttpError(
        403,
        'FORBIDDEN',
        check.reason ?? 'Insufficient permissions for this transition.'
      );
    }
    throw new EditorialHttpError(
      422,
      'INVALID_TRANSITION',
      check.reason ?? 'Workflow transition is not permitted.'
    );
  }

  assertArticlePreconditionsForTransition(existing, toStatus);

  if (toStatus === 'review' || toStatus === 'approved' || toStatus === 'published') {
    await assertReferencedMediaAssetsExist(
      {
        featured_image_url: existing.featured_image_url,
        og_image_url: existing.og_image_url,
        content_json: existing.content_json,
      },
      client
    );
  }

  // Execute the hardened database workflow RPC passing server-verified `staff.id` ONLY.
  // Public image delivery is gated strictly on PostgreSQL `status = 'published'`; no
  // public Storage bucket upload or copy occurs before commit.
  const { data: transitioned, error: rpcErr } = await client.rpc(
    'cms_transition_article_status',
    {
      p_article_id: articleId,
      p_to_status: toStatus,
      p_actor_staff_id: staff.id,
      p_actor_type: 'staff',
      p_scheduled_at: null,
      p_note: note ?? null,
    }
  );

  if (rpcErr) {
    const msg = rpcErr.message || '';
    if (/not authorized|cannot modify|inactive/i.test(msg)) {
      throw new EditorialHttpError(403, 'FORBIDDEN', 'Role is not authorized for this transition.');
    }
    if (/prohibited|already in|not found/i.test(msg)) {
      throw new EditorialHttpError(422, 'INVALID_TRANSITION', 'Database rejected invalid workflow transition.');
    }
    throw rpcErr;
  }

  const record = (Array.isArray(transitioned) ? transitioned[0] : transitioned) as ArticleRecord;
  return projectArticleForRole(record, staff.role, true);
}

export async function getArticleAuditHistory(
  articleId: string,
  clientOverride?: SupabaseClient
) {
  const client = getClient(clientOverride);
  const { data: article, error: artErr } = await client
    .from('articles')
    .select('id, slug, title, status')
    .eq('id', articleId)
    .maybeSingle();

  if (artErr) throw artErr;
  if (!article) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Article not found.');
  }

  const { data: logs, error: logErr } = await client
    .from('article_audit_log')
    .select(
      'id, event_seq, article_id, actor_type, actor_email, actor_role, action, from_status, to_status, note, previous_snapshot, new_snapshot, metadata, created_at'
    )
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (logErr) throw logErr;

  return {
    article,
    entries: logs ?? [],
  };
}

export interface ArticlePreviewPayload {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  category: string;
  excerpt: string;
  sanitizedHtml: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  author_name: string;
  author_role: string | null;
  reading_time: number;
  status: ArticleStatus;
  updated_at: string;
  published_at: string | null;
}

/**
 * Read-only secure preview builder. Never mutates publication state, timestamps,
 * or triggers cache publication. Re-runs HTML sanitization before returning.
 */
export async function getSecureArticlePreview(
  articleId: string,
  clientOverride?: SupabaseClient
): Promise<ArticlePreviewPayload> {
  const client = getClient(clientOverride);
  const { data, error } = await client
    .from('articles')
    .select(
      'id, title, subtitle, slug, category, excerpt, content, content_json, content_html, featured_image_url, featured_image_alt, author_name, author_role, reading_time, status, updated_at, published_at'
    )
    .eq('id', articleId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Article not found.');
  }

  const row = data as ArticleRecord;
  let safeHtml = '';

  if (row.content_json) {
    const compiled = validateAndCompileTiptapContent(row.content_json);
    if (compiled.ok) {
      safeHtml = compiled.compiled.contentHtml;
    }
  }

  if (!safeHtml && row.content_html) {
    safeHtml = sanitizeEditorialHtml(row.content_html);
  }

  if (!safeHtml && row.content) {
    safeHtml = row.content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => sanitizeEditorialHtml(`<p>${escapeHtml(p)}</p>`))
      .join('');
  }

  let validatedFeaturedUrl: string | null = null;
  if (row.featured_image_url) {
    const featuredCheck = validateApprovedEditorialMediaUrl(row.featured_image_url);
    if (featuredCheck.valid) {
      validatedFeaturedUrl = featuredCheck.url;
    }
  }

  const refIds = extractMediaRefsFromArticleFields({
    featured_image_url: validatedFeaturedUrl,
    content_json: row.content_json,
  });
  const htmlImgMatches = Array.from(
    safeHtml.matchAll(/\/api\/(?:editorial-media|admin\/insights\/media)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi)
  ).map((m) => m[0]);

  const refsToResolve = [
    ...(validatedFeaturedUrl ? [validatedFeaturedUrl] : []),
    ...refIds.map((id) => buildCanonicalEditorialMediaRef(id)),
    ...htmlImgMatches,
  ];

  if (refsToResolve.length > 0) {
    const signedMap = await resolveMediaUrlsForPreview(refsToResolve, client);
    if (validatedFeaturedUrl && signedMap.has(validatedFeaturedUrl)) {
      validatedFeaturedUrl = signedMap.get(validatedFeaturedUrl) ?? validatedFeaturedUrl;
    }
    for (const [canonicalRef, deliveryUrl] of signedMap.entries()) {
      safeHtml = safeHtml.split(canonicalRef).join(escapeHtml(deliveryUrl));
    }
    safeHtml = sanitizeEditorialHtml(safeHtml, { allowSignedPreviewUrls: true });
  }

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    slug: row.slug,
    category: row.category,
    excerpt: row.excerpt,
    sanitizedHtml: safeHtml,
    featured_image_url: validatedFeaturedUrl,
    featured_image_alt: row.featured_image_alt,
    author_name: row.author_name,
    author_role: row.author_role,
    reading_time: row.reading_time,
    status: row.status,
    updated_at: row.updated_at,
    published_at: row.published_at,
  };
}
