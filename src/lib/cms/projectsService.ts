import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PROJECTS_DATA } from '@/data/projectsData';
import { getPhotoOverridesAsync } from '@/lib/projectPhotos';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { EditorialHttpError } from './http';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  type ProjectVisibilityStatus,
} from './projectValidators';
import type { StaffProfile } from './roles';
import { generateSlug, isValidSlug } from './slugs';

export interface AdminProjectListItem {
  id: string | null;
  slug: string;
  title: string;
  category: string;
  location: string;
  lifecycle: string;
  visibilityStatus: ProjectVisibilityStatus;
  heroImage: string | null;
  galleryCount: number;
  hasPhotoOverride: boolean;
  source: 'database' | 'catalog';
  isDemonstrationSpec: boolean;
  updatedAt: string | null;
}

export interface DbProjectRecord {
  id: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  description: string;
  short_description: string | null;
  main_image_url: string | null;
  status: string;
  visibility_status?: ProjectVisibilityStatus;
  is_featured: boolean;
  updated_at: string;
  created_at: string;
}

export async function listProjectsForAdmin(
  _staff: StaffProfile,
  clientOverride?: SupabaseClient
): Promise<AdminProjectListItem[]> {
  const client = clientOverride ?? createServiceRoleClient();
  const [dbResult, overrides] = await Promise.all([
    client
      .from('projects')
      .select('id, slug, title, category, location, status, main_image_url, is_featured, updated_at, created_at')
      .order('created_at', { ascending: false }),
    clientOverride ? Promise.resolve({}) : getPhotoOverridesAsync(),
  ]);

  const dbRows = (!dbResult.error && Array.isArray(dbResult.data)
    ? dbResult.data
    : []) as unknown as DbProjectRecord[];

  const bySlug = new Map<string, AdminProjectListItem>();

  for (const row of dbRows) {
    const override = (overrides as Record<string, { heroImage?: string; galleryImages?: string[]; updatedAt?: string }>)[row.slug];
    bySlug.set(row.slug, {
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category,
      location: row.location,
      lifecycle: row.status || 'Completed',
      visibilityStatus: row.visibility_status || 'published',
      heroImage: override?.heroImage || row.main_image_url || null,
      galleryCount: override?.galleryImages?.length ?? 0,
      hasPhotoOverride: Boolean(override),
      source: 'database',
      isDemonstrationSpec: false,
      updatedAt: row.updated_at,
    });
  }

  for (const cat of PROJECTS_DATA) {
    if (bySlug.has(cat.slug)) continue;
    const override = (overrides as Record<string, { heroImage?: string; galleryImages?: string[]; updatedAt?: string }>)[cat.slug];
    bySlug.set(cat.slug, {
      id: null,
      slug: cat.slug,
      title: cat.title,
      category: cat.category,
      location: cat.location,
      lifecycle: cat.lifecycle,
      visibilityStatus: 'published',
      heroImage: override?.heroImage || cat.heroImage,
      galleryCount: (override?.galleryImages || cat.galleryImages).length,
      hasPhotoOverride: Boolean(override),
      source: 'catalog',
      isDemonstrationSpec: Boolean(cat.isDemonstrationSpec),
      updatedAt: override?.updatedAt || null,
    });
  }

  return Array.from(bySlug.values());
}

export async function getProjectByIdForAdmin(
  _staff: StaffProfile,
  projectId: string,
  clientOverride?: SupabaseClient
): Promise<DbProjectRecord> {
  const client = clientOverride ?? createServiceRoleClient();
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Project record not found.');
  }
  return data as unknown as DbProjectRecord;
}

export async function createProjectRecord(
  staff: StaffProfile,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<DbProjectRecord> {
  const parsed = CreateProjectSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid project payload.'
    );
  }

  const input = parsed.data;
  const resolvedSlug = input.slug ? input.slug : generateSlug(input.title);
  if (!isValidSlug(resolvedSlug)) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      'Unable to derive a valid kebab-case project slug.'
    );
  }

  const client = clientOverride ?? createServiceRoleClient();
  const { data: existingSlug, error: slugErr } = await client
    .from('projects')
    .select('id')
    .eq('slug', resolvedSlug)
    .maybeSingle();
  if (slugErr) throw slugErr;
  if (existingSlug) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      `A project with slug '${resolvedSlug}' already exists.`
    );
  }

  const { data, error } = await client
    .from('projects')
    .insert({
      title: input.title,
      slug: resolvedSlug,
      category: input.category,
      location: input.location,
      description: input.description,
      short_description: input.short_description ?? null,
      main_image_url: input.main_image_url ?? null,
      status: input.status,
      visibility_status: input.visibility_status,
      year: input.year ?? null,
      architect: input.architect ?? null,
      builder: input.builder ?? null,
      scope: input.scope ?? [],
      finishes: input.finishes ?? null,
      challenges: input.challenges ?? null,
      sheen_levels: input.sheen_levels ?? null,
      seo_title: input.seo_title ?? null,
      seo_description: input.seo_description ?? null,
      is_featured: input.is_featured ?? false,
      is_demonstration_spec: input.is_demonstration_spec ?? false,
      sort_order: input.sort_order ?? 0,
      created_by: staff.id,
      updated_by: staff.id,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as unknown as DbProjectRecord;
}

export async function updateProjectRecord(
  staff: StaffProfile,
  projectId: string,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<DbProjectRecord> {
  const parsed = UpdateProjectSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid project update payload.'
    );
  }

  const { expected_updated_at: expectedUpdatedAt, ...fields } = parsed.data;
  const client = clientOverride ?? createServiceRoleClient();

  const current = await getProjectByIdForAdmin(staff, projectId, client);
  const currentUpdatedMs = new Date(current.updated_at).getTime();
  const expectedMs = new Date(expectedUpdatedAt).getTime();
  if (Number.isNaN(expectedMs) || Math.abs(currentUpdatedMs - expectedMs) > 1000) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'Project was modified concurrently. Reload the latest project record before saving.'
    );
  }

  const updatePayload: Record<string, unknown> = {
    ...fields,
    updated_by: staff.id,
  };

  if (fields.visibility_status === 'published' && !current.visibility_status?.includes('published')) {
    updatePayload.published_at = new Date().toISOString();
  }

  const { data, error } = await client
    .from('projects')
    .update(updatePayload)
    .eq('id', projectId)
    .eq('updated_at', current.updated_at)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'Concurrent project update detected. Refresh and retry.'
    );
  }

  return data as unknown as DbProjectRecord;
}
