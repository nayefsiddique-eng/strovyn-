import 'server-only';
import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PROJECTS_DATA } from '@/data/projectsData';
import { getPhotoOverridesAsync } from '@/lib/projectPhotos';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { EditorialHttpError } from './http';
import { inspectEditorialImageUpload } from './imageInspection';
import {
  CreateProjectSchema,
  PROJECT_IMAGE_ROLES,
  UpdateProjectImagesBatchSchema,
  UpdateProjectSchema,
  type ProjectImageRole,
  type ProjectVisibilityStatus,
} from './projectValidators';
import { hasEditorialPermission } from './rbac';
import type { EditorialRole, StaffProfile } from './roles';
import { generateSlug, isValidSlug } from './slugs';

const MAX_PROJECT_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MiB (matches `project-photos` bucket)

export interface ProjectImageRecord {
  id: string;
  project_id: string;
  image_url: string;
  image_role: ProjectImageRole;
  alt_text: string | null;
  caption: string | null;
  pair_key: string | null;
  storage_path: string | null;
  sort_order: number;
  created_at?: string;
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
  visibility_status: ProjectVisibilityStatus;
  year: string | null;
  architect: string | null;
  builder: string | null;
  scope: string[];
  finishes: string | null;
  challenges: string | null;
  sheen_levels: string | null;
  seo_title: string | null;
  seo_description: string | null;
  is_featured: boolean;
  is_demonstration_spec: boolean;
  sort_order: number;
  published_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface DbProjectDetail extends DbProjectRecord {
  images: ProjectImageRecord[];
}

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

export function canStaffEditProjectInVisibility(
  role: EditorialRole,
  visibility: ProjectVisibilityStatus
): boolean {
  if (visibility === 'draft') {
    return hasEditorialPermission(role, 'project:edit_draft');
  }
  if (visibility === 'published') {
    return hasEditorialPermission(role, 'project:edit_published');
  }
  return hasEditorialPermission(role, 'project:archive');
}

function assertStaffCanMutateProject(
  staff: StaffProfile,
  currentVisibility: ProjectVisibilityStatus,
  nextVisibility?: ProjectVisibilityStatus
): void {
  if (!canStaffEditProjectInVisibility(staff.role, currentVisibility)) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      `Role '${staff.role}' cannot modify projects in '${currentVisibility}' status.`
    );
  }
  if (nextVisibility && nextVisibility !== currentVisibility) {
    if (nextVisibility === 'published' && !hasEditorialPermission(staff.role, 'project:publish')) {
      throw new EditorialHttpError(
        403,
        'FORBIDDEN',
        `Role '${staff.role}' is not authorized to publish projects.`
      );
    }
    if (
      (nextVisibility === 'archived' || currentVisibility === 'archived') &&
      !hasEditorialPermission(staff.role, 'project:archive')
    ) {
      throw new EditorialHttpError(
        403,
        'FORBIDDEN',
        `Role '${staff.role}' is not authorized to archive or restore projects.`
      );
    }
  }
}

function assertOptimisticTimestampMatch(currentIso: string, expectedIso: string): void {
  const currentMs = new Date(currentIso).getTime();
  const expectedMs = new Date(expectedIso).getTime();
  if (Number.isNaN(expectedMs) || Math.abs(currentMs - expectedMs) > 1000) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'Project was modified concurrently. Reload the latest project record before saving.'
    );
  }
}

export async function listProjectsForAdmin(
  _staff: StaffProfile,
  clientOverride?: SupabaseClient
): Promise<AdminProjectListItem[]> {
  const client = clientOverride ?? createServiceRoleClient();
  const [dbResult, imgResult, overrides] = await Promise.all([
    client
      .from('projects')
      .select(
        'id, slug, title, category, location, status, visibility_status, main_image_url, is_featured, is_demonstration_spec, sort_order, updated_at, created_at'
      )
      .order('sort_order', { ascending: true }),
    client.from('project_images').select('id, project_id'),
    clientOverride ? Promise.resolve({}) : getPhotoOverridesAsync(),
  ]);

  const dbRows = (!dbResult.error && Array.isArray(dbResult.data)
    ? dbResult.data
    : []) as unknown as DbProjectRecord[];

  const imageCounts = new Map<string, number>();
  if (!imgResult.error && Array.isArray(imgResult.data)) {
    for (const img of imgResult.data as Array<{ project_id: string }>) {
      imageCounts.set(img.project_id, (imageCounts.get(img.project_id) ?? 0) + 1);
    }
  }

  const bySlug = new Map<string, AdminProjectListItem>();
  const overrideMap = overrides as Record<
    string,
    { heroImage?: string; galleryImages?: string[]; updatedAt?: string }
  >;

  for (const row of dbRows) {
    const override = overrideMap[row.slug];
    bySlug.set(row.slug, {
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category,
      location: row.location,
      lifecycle: row.status || 'Completed',
      visibilityStatus: row.visibility_status || 'draft',
      heroImage: override?.heroImage || row.main_image_url || null,
      galleryCount: imageCounts.get(row.id) ?? override?.galleryImages?.length ?? 0,
      hasPhotoOverride: Boolean(override),
      source: 'database',
      isDemonstrationSpec: Boolean(row.is_demonstration_spec),
      updatedAt: row.updated_at,
    });
  }

  for (const cat of PROJECTS_DATA) {
    if (bySlug.has(cat.slug)) continue;
    const override = overrideMap[cat.slug];
    bySlug.set(cat.slug, {
      id: null,
      slug: cat.slug,
      title: cat.title,
      category: cat.category,
      location: cat.location,
      lifecycle: cat.lifecycle,
      visibilityStatus: cat.isDemonstrationSpec ? 'draft' : 'published',
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
): Promise<DbProjectDetail> {
  const client = clientOverride ?? createServiceRoleClient();
  const [{ data, error }, { data: imgRows, error: imgErr }] = await Promise.all([
    client.from('projects').select('*').eq('id', projectId).maybeSingle(),
    client
      .from('project_images')
      .select('id, project_id, image_url, image_role, alt_text, caption, pair_key, storage_path, sort_order, created_at')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
  ]);

  if (error) throw error;
  if (!data) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Project record not found.');
  }
  if (imgErr) throw imgErr;

  const project = data as unknown as DbProjectRecord;
  return {
    ...project,
    scope: Array.isArray(project.scope) ? project.scope : [],
    images: ((imgRows ?? []) as unknown as ProjectImageRecord[]).map((img) => ({
      ...img,
      image_role: (PROJECT_IMAGE_ROLES as readonly string[]).includes(img.image_role)
        ? img.image_role
        : 'gallery',
    })),
  };
}

export async function createProjectRecord(
  staff: StaffProfile,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<DbProjectDetail> {
  if (!hasEditorialPermission(staff.role, 'project:create_draft')) {
    throw new EditorialHttpError(403, 'FORBIDDEN', 'Role is not permitted to create projects.');
  }

  const parsed = CreateProjectSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid project payload.'
    );
  }

  const input = parsed.data;
  if (input.visibility_status === 'published' && !hasEditorialPermission(staff.role, 'project:publish')) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      `Role '${staff.role}' cannot create a project directly in published state. Create a draft instead.`
    );
  }
  if (input.visibility_status === 'archived' && !hasEditorialPermission(staff.role, 'project:archive')) {
    throw new EditorialHttpError(403, 'FORBIDDEN', `Role '${staff.role}' cannot create archived projects.`);
  }

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
      published_at: input.visibility_status === 'published' ? new Date().toISOString() : null,
      created_by: staff.id,
      updated_by: staff.id,
    })
    .select('*')
    .single();

  if (error) throw error;
  const created = data as unknown as DbProjectRecord;

  if (created.main_image_url) {
    await client.from('project_images').insert({
      project_id: created.id,
      image_url: created.main_image_url,
      image_role: 'cover',
      alt_text: created.title,
      sort_order: 0,
    });
  }

  return getProjectByIdForAdmin(staff, created.id, client);
}

export async function updateProjectRecord(
  staff: StaffProfile,
  projectId: string,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<DbProjectDetail> {
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
  assertStaffCanMutateProject(staff, current.visibility_status, fields.visibility_status);
  assertOptimisticTimestampMatch(current.updated_at, expectedUpdatedAt);

  if (fields.slug && fields.slug !== current.slug) {
    const { data: dupSlug } = await client
      .from('projects')
      .select('id')
      .eq('slug', fields.slug)
      .maybeSingle();
    if (dupSlug) {
      throw new EditorialHttpError(409, 'CONFLICT', `Slug '${fields.slug}' is already in use.`);
    }
  }

  const updatePayload: Record<string, unknown> = {
    ...fields,
    updated_by: staff.id,
  };

  if (fields.visibility_status === 'published' && current.visibility_status !== 'published') {
    updatePayload.published_at = current.published_at ?? new Date().toISOString();
  }

  const { data, error } = await client
    .from('projects')
    .update(updatePayload)
    .eq('id', projectId)
    .eq('updated_at', current.updated_at)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'Concurrent project update detected. Refresh and retry.'
    );
  }

  return getProjectByIdForAdmin(staff, projectId, client);
}

export async function uploadProjectImage(
  staff: StaffProfile,
  projectId: string,
  file: File,
  options: {
    imageRole?: ProjectImageRole;
    altText?: string;
    caption?: string;
    pairKey?: string;
    setAsCover?: boolean;
  },
  clientOverride?: SupabaseClient
): Promise<{ project: DbProjectDetail; uploadedImage: ProjectImageRecord }> {
  const client = clientOverride ?? createServiceRoleClient();
  const current = await getProjectByIdForAdmin(staff, projectId, client);
  assertStaffCanMutateProject(staff, current.visibility_status);

  if (file.size > MAX_PROJECT_IMAGE_BYTES) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Project image exceeds 10 MiB limit.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const inspected = inspectEditorialImageUpload(
    buffer,
    file.name,
    file.type,
    MAX_PROJECT_IMAGE_BYTES
  );
  if (!inspected.valid || !inspected.detectedMime) {
    throw new EditorialHttpError(
      inspected.status ?? 400,
      inspected.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
      inspected.error || 'Invalid image file.'
    );
  }

  const role: ProjectImageRole =
    options.imageRole && (PROJECT_IMAGE_ROLES as readonly string[]).includes(options.imageRole)
      ? options.imageRole
      : 'gallery';

  const ext =
    inspected.detectedMime === 'image/png'
      ? 'png'
      : inspected.detectedMime === 'image/webp'
        ? 'webp'
        : 'jpg';
  const storagePath = `projects/${projectId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

  const { error: uploadErr } = await client.storage
    .from('project-photos')
    .upload(storagePath, buffer, {
      contentType: inspected.detectedMime,
      upsert: false,
    });
  if (uploadErr) {
    throw new EditorialHttpError(500, 'STORAGE_ERROR', `Failed uploading project photo: ${uploadErr.message}`);
  }

  const { data: urlData } = client.storage.from('project-photos').getPublicUrl(storagePath);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) {
    await client.storage.from('project-photos').remove([storagePath]).catch(() => {});
    throw new EditorialHttpError(500, 'STORAGE_ERROR', 'Unable to resolve uploaded project photo URL.');
  }

  const nextSortOrder =
    current.images.length > 0
      ? Math.max(...current.images.map((i) => i.sort_order)) + 1
      : 0;

  const { data: insertedImg, error: insertErr } = await client
    .from('project_images')
    .insert({
      project_id: projectId,
      image_url: publicUrl,
      image_role: role,
      alt_text: options.altText?.trim() || current.title,
      caption: options.caption?.trim() || null,
      pair_key: options.pairKey?.trim() || null,
      storage_path: storagePath,
      sort_order: nextSortOrder,
    })
    .select('*')
    .single();

  if (insertErr || !insertedImg) {
    await client.storage.from('project-photos').remove([storagePath]).catch(() => {});
    throw insertErr ?? new Error('Failed saving project image metadata.');
  }

  const shouldSetCover = Boolean(options.setAsCover || role === 'cover' || !current.main_image_url);
  await client
    .from('projects')
    .update({
      ...(shouldSetCover ? { main_image_url: publicUrl } : {}),
      updated_by: staff.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  const updatedProject = await getProjectByIdForAdmin(staff, projectId, client);
  return {
    project: updatedProject,
    uploadedImage: insertedImg as unknown as ProjectImageRecord,
  };
}

export async function updateProjectImagesBatch(
  staff: StaffProfile,
  projectId: string,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<DbProjectDetail> {
  const parsed = UpdateProjectImagesBatchSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid project images update payload.'
    );
  }

  const { expected_updated_at: expectedUpdatedAt, coverImageId, images } = parsed.data;
  const client = clientOverride ?? createServiceRoleClient();
  const current = await getProjectByIdForAdmin(staff, projectId, client);
  assertStaffCanMutateProject(staff, current.visibility_status);
  assertOptimisticTimestampMatch(current.updated_at, expectedUpdatedAt);

  const existingById = new Map(current.images.map((img) => [img.id, img]));
  for (const item of images) {
    if (!existingById.has(item.id)) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', `Image '${item.id}' does not belong to this project.`);
    }
  }

  for (const item of images) {
    const { error } = await client
      .from('project_images')
      .update({
        image_role: item.image_role,
        alt_text: item.alt_text ?? null,
        caption: item.caption ?? null,
        pair_key: item.pair_key ?? null,
        sort_order: item.sort_order,
      })
      .eq('id', item.id)
      .eq('project_id', projectId);
    if (error) throw error;
  }

  let nextCoverUrl = current.main_image_url;
  if (coverImageId) {
    const chosen = existingById.get(coverImageId);
    if (!chosen) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Selected cover image does not belong to this project.');
    }
    nextCoverUrl = chosen.image_url;
  }

  await client
    .from('projects')
    .update({
      main_image_url: nextCoverUrl,
      updated_by: staff.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  return getProjectByIdForAdmin(staff, projectId, client);
}

export async function deleteProjectImageSafely(
  staff: StaffProfile,
  projectId: string,
  imageId: string,
  expectedUpdatedAt?: string | null,
  clientOverride?: SupabaseClient
): Promise<{ project: DbProjectDetail; storageDeleted: boolean }> {
  const client = clientOverride ?? createServiceRoleClient();
  const current = await getProjectByIdForAdmin(staff, projectId, client);
  assertStaffCanMutateProject(staff, current.visibility_status);
  if (expectedUpdatedAt) {
    assertOptimisticTimestampMatch(current.updated_at, expectedUpdatedAt);
  }

  const target = current.images.find((img) => img.id === imageId);
  if (!target) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Project image not found.');
  }

  const { error: delErr } = await client
    .from('project_images')
    .delete()
    .eq('id', imageId)
    .eq('project_id', projectId);
  if (delErr) throw delErr;

  let storageDeleted = false;
  if (target.storage_path) {
    // Verify no other project_images row or projects.main_image_url still references this file
    const [{ count: otherImgCount }, { count: otherCoverCount }] = await Promise.all([
      client
        .from('project_images')
        .select('id', { count: 'exact', head: true })
        .eq('image_url', target.image_url),
      client
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('main_image_url', target.image_url)
        .neq('id', projectId),
    ]);

    if ((otherImgCount ?? 0) === 0 && (otherCoverCount ?? 0) === 0) {
      const { error: rmErr } = await client.storage
        .from('project-photos')
        .remove([target.storage_path]);
      storageDeleted = !rmErr;
    }
  }

  const remainingImages = current.images.filter((img) => img.id !== imageId);
  const nextCoverUrl =
    current.main_image_url === target.image_url
      ? remainingImages[0]?.image_url ?? null
      : current.main_image_url;

  await client
    .from('projects')
    .update({
      main_image_url: nextCoverUrl,
      updated_by: staff.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  return {
    project: await getProjectByIdForAdmin(staff, projectId, client),
    storageDeleted,
  };
}
