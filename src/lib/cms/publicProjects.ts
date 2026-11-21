import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PROJECTS_DATA, type ProjectData } from '@/data/projectsData';
import {
  createPublicSupabaseClient,
  isPublicSupabaseConfigured,
} from '@/lib/supabase/public';
import type { ProjectImageRole } from './projectValidators';

export interface PublicBeforeAfterPair {
  pairKey: string;
  beforeUrl: string;
  beforeAlt: string;
  afterUrl: string;
  afterAlt: string;
}

export interface PublicProjectDetail extends ProjectData {
  id?: string;
  seoTitle: string;
  seoDescription: string;
  isFeatured: boolean;
  beforeAfterPairs: PublicBeforeAfterPair[];
}

interface PublicProjectRow {
  id: string;
  slug: string;
  title: string;
  category: ProjectData['category'];
  status: ProjectData['lifecycle'];
  visibility_status?: string;
  location: string;
  year: string | null;
  architect: string | null;
  builder: string | null;
  main_image_url: string | null;
  scope: unknown;
  finishes: string | null;
  description: string;
  short_description: string | null;
  challenges: string | null;
  sheen_levels: string | null;
  seo_title: string | null;
  seo_description: string | null;
  is_featured: boolean | null;
  is_demonstration_spec: boolean | null;
  sort_order: number | null;
}

interface PublicProjectImageRow {
  id: string;
  project_id: string;
  image_url: string;
  image_role: ProjectImageRole;
  alt_text: string | null;
  caption: string | null;
  pair_key: string | null;
  sort_order: number;
}

const PUBLIC_PROJECT_COLUMNS = [
  'id',
  'slug',
  'title',
  'category',
  'status',
  'visibility_status',
  'location',
  'year',
  'architect',
  'builder',
  'main_image_url',
  'scope',
  'finishes',
  'description',
  'short_description',
  'challenges',
  'sheen_levels',
  'seo_title',
  'seo_description',
  'is_featured',
  'is_demonstration_spec',
  'sort_order',
].join(', ');

function buildBeforeAfterPairs(images: PublicProjectImageRow[]): PublicBeforeAfterPair[] {
  const groups = new Map<string, { before?: PublicProjectImageRow; after?: PublicProjectImageRow }>();
  for (const img of images) {
    if (img.image_role !== 'before' && img.image_role !== 'after') continue;
    const key = img.pair_key?.trim() || 'default';
    const entry = groups.get(key) ?? {};
    if (img.image_role === 'before' && !entry.before) entry.before = img;
    if (img.image_role === 'after' && !entry.after) entry.after = img;
    groups.set(key, entry);
  }
  const pairs: PublicBeforeAfterPair[] = [];
  for (const [pairKey, pair] of groups.entries()) {
    if (pair.before && pair.after) {
      pairs.push({
        pairKey,
        beforeUrl: pair.before.image_url,
        beforeAlt: pair.before.alt_text || 'Before surface condition',
        afterUrl: pair.after.image_url,
        afterAlt: pair.after.alt_text || 'Completed architectural finish',
      });
    }
  }
  return pairs;
}

function mapDbProjectRow(
  row: PublicProjectRow,
  images: PublicProjectImageRow[],
  override?: { heroImage?: string; galleryImages?: string[] }
): PublicProjectDetail {
  const coverRecord = images.find((i) => i.image_role === 'cover');
  const galleryRecords = images.filter(
    (i) => i.image_role === 'gallery' || i.image_role === 'cover'
  );

  const heroImage =
    override?.heroImage ||
    row.main_image_url ||
    coverRecord?.image_url ||
    galleryRecords[0]?.image_url ||
    '/images/projects/adelaide-luxury-residence/living-dining-2.jpg';

  const dbGalleryUrls = images
    .filter((i) => i.image_role === 'gallery')
    .map((i) => i.image_url);

  const galleryImages =
    override?.galleryImages && override.galleryImages.length > 0
      ? override.galleryImages
      : dbGalleryUrls.length > 0
        ? dbGalleryUrls
        : [heroImage];

  const scopeArr = Array.isArray(row.scope)
    ? row.scope.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category || 'Architectural Residential',
    lifecycle: row.status || 'Completed',
    location: row.location,
    year: row.year || '2025',
    architect: row.architect || 'Strovyn Architectural Finishing',
    builder: row.builder || 'Strovyn Painting Co.',
    heroImage,
    galleryImages,
    scope: scopeArr,
    finishes: row.finishes || 'Architectural Finish Specification',
    description: row.description,
    challenges: row.challenges || '',
    sheenLevels: row.sheen_levels || '',
    isDemonstrationSpec: Boolean(row.is_demonstration_spec),
    seoTitle: row.seo_title?.trim() || row.title,
    seoDescription: row.seo_description?.trim() || row.short_description?.trim() || row.description,
    isFeatured: Boolean(row.is_featured),
    beforeAfterPairs: buildBeforeAfterPairs(images),
  };
}

export async function listPublishedProjectsFromDb(options?: {
  clientOverride?: SupabaseClient;
  overridesMap?: Record<string, { heroImage?: string; galleryImages?: string[] }>;
}): Promise<PublicProjectDetail[]> {
  if (!options?.clientOverride && !isPublicSupabaseConfigured()) {
    return PROJECTS_DATA.filter((p) => !p.isDemonstrationSpec).map((p) => ({
      ...p,
      seoTitle: p.title,
      seoDescription: p.description,
      isFeatured: p.slug === 'the-north-adelaide-residence',
      beforeAfterPairs: [],
    }));
  }

  const client = options?.clientOverride ?? createPublicSupabaseClient();
  const { data: rows, error } = await client
    .from('projects')
    .select(PUBLIC_PROJECT_COLUMNS)
    .eq('visibility_status', 'published')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error || !Array.isArray(rows)) {
    if (error) console.error('[CMS-4B] Failed loading public projects:', error.message);
    return [];
  }

  const publishedRows = (rows as unknown as PublicProjectRow[]).filter(
    (r) => !r.visibility_status || r.visibility_status === 'published'
  );
  if (publishedRows.length === 0) return [];

  const projectIds = publishedRows.map((r) => r.id);
  const { data: imgRows } = await client
    .from('project_images')
    .select('id, project_id, image_url, image_role, alt_text, caption, pair_key, sort_order')
    .in('project_id', projectIds)
    .order('sort_order', { ascending: true });

  const imagesByProject = new Map<string, PublicProjectImageRow[]>();
  if (Array.isArray(imgRows)) {
    for (const img of imgRows as unknown as PublicProjectImageRow[]) {
      const list = imagesByProject.get(img.project_id) ?? [];
      list.push(img);
      imagesByProject.set(img.project_id, list);
    }
  }

  return publishedRows.map((row) =>
    mapDbProjectRow(
      row,
      imagesByProject.get(row.id) ?? [],
      options?.overridesMap?.[row.slug]
    )
  );
}

export async function getPublishedProjectBySlugFromDb(
  rawSlug: string,
  options?: {
    clientOverride?: SupabaseClient;
    overridesMap?: Record<string, { heroImage?: string; galleryImages?: string[] }>;
  }
): Promise<PublicProjectDetail | null> {
  const slug = rawSlug.trim().toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 96) {
    return null;
  }

  if (!options?.clientOverride && !isPublicSupabaseConfigured()) {
    const fallback = PROJECTS_DATA.find((p) => p.slug === slug && !p.isDemonstrationSpec);
    if (!fallback) return null;
    return {
      ...fallback,
      seoTitle: fallback.title,
      seoDescription: fallback.description,
      isFeatured: true,
      beforeAfterPairs: [],
    };
  }

  const client = options?.clientOverride ?? createPublicSupabaseClient();
  const { data, error } = await client
    .from('projects')
    .select(PUBLIC_PROJECT_COLUMNS)
    .eq('slug', slug)
    .eq('visibility_status', 'published')
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as PublicProjectRow;
  if (row.visibility_status && row.visibility_status !== 'published') return null;

  const { data: imgRows } = await client
    .from('project_images')
    .select('id, project_id, image_url, image_role, alt_text, caption, pair_key, sort_order')
    .eq('project_id', row.id)
    .order('sort_order', { ascending: true });

  return mapDbProjectRow(
    row,
    (imgRows as unknown as PublicProjectImageRow[] | null) ?? [],
    options?.overridesMap?.[row.slug]
  );
}
