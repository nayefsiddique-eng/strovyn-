import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import {
  CreateVacancySchema,
  UpdateVacancySchema,
  VacancyOpenStateSchema,
  VacancyPublishSchema,
  VacancyReorderSchema,
  type VacancyPublicationStatus,
} from './careerValidators';
import { EditorialHttpError } from './http';
import { isVacancyDeadlineExpired } from './publicCareers';
import { hasEditorialPermission } from './rbac';
import type { EditorialAction, StaffProfile } from './roles';

export interface VacancyRecord {
  id: string;
  slug: string;
  title: string;
  department: string;
  employment_type: string;
  location: string;
  description: string;
  requirements: string | null;
  application_deadline: string | null;
  publication_status: VacancyPublicationStatus;
  is_open: boolean;
  status: string;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  published_by: string | null;
  published_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListVacanciesFilters {
  filter?: string | null;
  search?: string | null;
}

function getClient(override?: SupabaseClient): SupabaseClient {
  return override ?? createServiceRoleClient();
}

function assertStaffPermission(staff: StaffProfile, action: EditorialAction): void {
  if (!staff.is_active) {
    throw new EditorialHttpError(403, 'FORBIDDEN', 'Staff account is inactive.');
  }
  if (!hasEditorialPermission(staff.role, action)) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      `Role ${staff.role} is not authorized to perform ${action}.`
    );
  }
}

function timestampsMatch(expected: string, actual: string): boolean {
  const a = Date.parse(expected);
  const b = Date.parse(actual);
  if (Number.isFinite(a) && Number.isFinite(b)) {
    return a === b;
  }
  return expected === actual;
}

function computeLegacyStatus(
  publicationStatus: VacancyPublicationStatus,
  isOpen: boolean,
  deadline: string | null
): 'active' | 'closed' {
  if (
    publicationStatus === 'published' &&
    isOpen &&
    !isVacancyDeadlineExpired(deadline)
  ) {
    return 'active';
  }
  return 'closed';
}

async function fetchVacancyOrThrow(
  client: SupabaseClient,
  id: string
): Promise<VacancyRecord> {
  const { data, error } = await client
    .from('job_openings')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Vacancy not found.');
  }
  return data as VacancyRecord;
}

async function assertSlugAvailable(
  client: SupabaseClient,
  slug: string,
  excludeId?: string
): Promise<void> {
  const { data, error } = await client
    .from('job_openings')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (data && (data as { id: string }).id !== excludeId) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      `A vacancy with slug "${slug}" already exists.`
    );
  }
}

export async function listVacanciesForAdmin(
  staff: StaffProfile,
  filters: ListVacanciesFilters = {},
  clientOverride?: SupabaseClient
): Promise<VacancyRecord[]> {
  assertStaffPermission(staff, 'career:read');
  const client = getClient(clientOverride);

  const { data, error } = await client
    .from('job_openings')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }

  const rows = (data ?? []) as VacancyRecord[];
  const filter = (filters.filter || 'all').trim().toLowerCase();
  const search = (filters.search || '').trim().toLowerCase();
  const nowMs = Date.now();

  return rows.filter((row) => {
    const expired = isVacancyDeadlineExpired(row.application_deadline, nowMs);
    if (filter === 'draft' && row.publication_status !== 'draft') return false;
    if (
      filter === 'published_open' &&
      !(row.publication_status === 'published' && row.is_open && !expired)
    ) {
      return false;
    }
    if (filter === 'closed' && row.is_open) return false;
    if (filter === 'expired' && !expired) return false;
    if (filter === 'archived' && row.publication_status !== 'archived') return false;

    if (!search) return true;
    return [
      row.title,
      row.slug,
      row.department,
      row.employment_type,
      row.location,
      row.description,
      row.requirements ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(search);
  });
}

export async function getVacancyByIdForAdmin(
  staff: StaffProfile,
  id: string,
  clientOverride?: SupabaseClient
): Promise<VacancyRecord> {
  assertStaffPermission(staff, 'career:read');
  const client = getClient(clientOverride);
  return fetchVacancyOrThrow(client, id);
}

export async function createVacancyDraft(
  staff: StaffProfile,
  rawInput: unknown,
  clientOverride?: SupabaseClient
): Promise<VacancyRecord> {
  assertStaffPermission(staff, 'career:create_draft');
  const parsed = CreateVacancySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid vacancy payload.'
    );
  }

  const input = parsed.data;
  const client = getClient(clientOverride);
  await assertSlugAvailable(client, input.slug);

  const isOpen = Boolean(input.is_open);
  const { data, error } = await client
    .from('job_openings')
    .insert({
      title: input.title,
      slug: input.slug,
      department: input.department,
      employment_type: input.employment_type,
      location: input.location,
      description: input.description,
      requirements: input.requirements ?? null,
      application_deadline: input.application_deadline ?? null,
      publication_status: 'draft',
      is_open: isOpen,
      status: 'closed',
      sort_order: hasEditorialPermission(staff.role, 'career:reorder')
        ? input.sort_order ?? 0
        : 0,
      created_by: staff.id,
      updated_by: staff.id,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new EditorialHttpError(
        409,
        'CONFLICT',
        `A vacancy with slug "${input.slug}" already exists.`
      );
    }
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }

  return data as VacancyRecord;
}

export async function updateVacancyRecord(
  staff: StaffProfile,
  id: string,
  rawInput: unknown,
  clientOverride?: SupabaseClient
): Promise<VacancyRecord> {
  const parsed = UpdateVacancySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid vacancy update payload.'
    );
  }

  const input = parsed.data;
  const client = getClient(clientOverride);
  const current = await fetchVacancyOrThrow(client, id);

  if (current.publication_status === 'draft') {
    assertStaffPermission(staff, 'career:edit_draft');
  } else {
    assertStaffPermission(staff, 'career:edit_published');
  }

  if (!timestampsMatch(input.expected_updated_at, current.updated_at)) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'This vacancy was modified by another session. Reload or rebase before saving.'
    );
  }

  if (input.slug && input.slug !== current.slug) {
    await assertSlugAvailable(client, input.slug, id);
  }

  const nextDeadline =
    input.application_deadline !== undefined
      ? input.application_deadline
      : current.application_deadline;

  const patch: Record<string, unknown> = {
    updated_by: staff.id,
    status: computeLegacyStatus(current.publication_status, current.is_open, nextDeadline),
  };

  if (input.title !== undefined) patch.title = input.title;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.department !== undefined) patch.department = input.department;
  if (input.employment_type !== undefined) patch.employment_type = input.employment_type;
  if (input.location !== undefined) patch.location = input.location;
  if (input.description !== undefined) patch.description = input.description;
  if (input.requirements !== undefined) patch.requirements = input.requirements;
  if (input.application_deadline !== undefined) {
    patch.application_deadline = input.application_deadline;
  }
  if (
    input.sort_order !== undefined &&
    hasEditorialPermission(staff.role, 'career:reorder')
  ) {
    patch.sort_order = input.sort_order;
  }

  const { data, error } = await client
    .from('job_openings')
    .update(patch)
    .eq('id', id)
    .eq('updated_at', current.updated_at)
    .select('*')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      throw new EditorialHttpError(
        409,
        'CONFLICT',
        'A vacancy with this slug already exists.'
      );
    }
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'Concurrent update detected while saving vacancy.'
    );
  }

  return data as VacancyRecord;
}

export async function setVacancyPublicationStatus(
  staff: StaffProfile,
  id: string,
  rawInput: unknown,
  clientOverride?: SupabaseClient
): Promise<VacancyRecord> {
  assertStaffPermission(staff, 'career:publish');
  const parsed = VacancyPublishSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid publication payload.'
    );
  }

  const input = parsed.data;
  const client = getClient(clientOverride);
  const current = await fetchVacancyOrThrow(client, id);

  if (!timestampsMatch(input.expected_updated_at, current.updated_at)) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'This vacancy was modified by another session. Reload before changing publication status.'
    );
  }

  if (input.publication_status === 'published') {
    if (!input.confirmed) {
      throw new EditorialHttpError(
        422,
        'BAD_REQUEST',
        'Explicit staff confirmation is required before publishing a vacancy.'
      );
    }
    if (isVacancyDeadlineExpired(current.application_deadline)) {
      throw new EditorialHttpError(
        422,
        'BAD_REQUEST',
        'Cannot publish a vacancy whose application deadline has already passed.'
      );
    }
  }

  const nowIso = new Date().toISOString();
  const nextPubStatus = input.publication_status;
  const patch: Record<string, unknown> = {
    publication_status: nextPubStatus,
    updated_by: staff.id,
    status: computeLegacyStatus(
      nextPubStatus,
      current.is_open,
      current.application_deadline
    ),
  };

  if (nextPubStatus === 'published') {
    patch.published_by = staff.id;
    patch.published_at = current.published_at ?? nowIso;
  }

  const { data, error } = await client
    .from('job_openings')
    .update(patch)
    .eq('id', id)
    .eq('updated_at', current.updated_at)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(409, 'CONFLICT', 'Concurrent update detected.');
  }

  return data as VacancyRecord;
}

export async function setVacancyOpenState(
  staff: StaffProfile,
  id: string,
  rawInput: unknown,
  clientOverride?: SupabaseClient
): Promise<VacancyRecord> {
  assertStaffPermission(staff, 'career:toggle_open');
  const parsed = VacancyOpenStateSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid open/close payload.'
    );
  }

  const input = parsed.data;
  const client = getClient(clientOverride);
  const current = await fetchVacancyOrThrow(client, id);

  if (!timestampsMatch(input.expected_updated_at, current.updated_at)) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'This vacancy was modified by another session. Reload before opening or closing applications.'
    );
  }

  if (input.is_open && isVacancyDeadlineExpired(current.application_deadline)) {
    throw new EditorialHttpError(
      422,
      'BAD_REQUEST',
      'Cannot reopen applications while the application deadline is in the past. Extend or clear the deadline first.'
    );
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    is_open: input.is_open,
    updated_by: staff.id,
    status: computeLegacyStatus(
      current.publication_status,
      input.is_open,
      current.application_deadline
    ),
    closed_by: input.is_open ? null : staff.id,
    closed_at: input.is_open ? null : nowIso,
  };

  const { data, error } = await client
    .from('job_openings')
    .update(patch)
    .eq('id', id)
    .eq('updated_at', current.updated_at)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(409, 'CONFLICT', 'Concurrent update detected.');
  }

  return data as VacancyRecord;
}

export async function reorderVacancies(
  staff: StaffProfile,
  rawInput: unknown,
  clientOverride?: SupabaseClient
): Promise<{ updatedCount: number }> {
  assertStaffPermission(staff, 'career:reorder');
  const parsed = VacancyReorderSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid reorder payload.'
    );
  }

  const client = getClient(clientOverride);
  const ids = parsed.data.ordered_ids;

  for (let i = 0; i < ids.length; i += 1) {
    const { error } = await client
      .from('job_openings')
      .update({
        sort_order: i + 1,
        updated_by: staff.id,
      })
      .eq('id', ids[i]);

    if (error) {
      throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
    }
  }

  return { updatedCount: ids.length };
}

export async function validateVacancyForPublicApplication(
  jobOpeningId: string,
  clientOverride?: SupabaseClient
): Promise<VacancyRecord> {
  const client = getClient(clientOverride);
  const { data, error } = await client
    .from('job_openings')
    .select('*')
    .eq('id', jobOpeningId)
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(
      404,
      'NOT_FOUND',
      'Selected vacancy does not exist.'
    );
  }

  const vacancy = data as VacancyRecord;
  if (vacancy.publication_status !== 'published' || !vacancy.is_open) {
    throw new EditorialHttpError(
      422,
      'BAD_REQUEST',
      'This vacancy is closed and no longer accepting applications.'
    );
  }

  if (isVacancyDeadlineExpired(vacancy.application_deadline)) {
    throw new EditorialHttpError(
      422,
      'BAD_REQUEST',
      'The application deadline for this vacancy has passed.'
    );
  }

  return vacancy;
}
