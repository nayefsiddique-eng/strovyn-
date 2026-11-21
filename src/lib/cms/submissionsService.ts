import 'server-only';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { EditorialHttpError } from './http';
import { hasEditorialPermission } from './rbac';
import type { EditorialAction, StaffProfile } from './roles';
import {
  SubmissionListQuerySchema,
  UpdateApplicationSubmissionSchema,
  UpdateFeedbackSubmissionSchema,
  UpdateQuoteSubmissionSchema,
  type CustomerFeedbackStatus,
  type JobApplicationStatus,
  type QuoteRequestStatus,
} from './submissionValidators';

export interface PaginatedSubmissionList<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface QuoteListSummary {
  id: string;
  full_name: string;
  project_location: string | null;
  service_required: string;
  preferred_contact: string | null;
  status: QuoteRequestStatus;
  has_attachment: boolean;
  has_notes: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttachmentMetadataSummary {
  file_name: string;
  mime_type: string;
  byte_size: number;
  download_path: string;
}

export interface QuoteDetailRecord extends QuoteListSummary {
  email: string;
  phone: string;
  description: string;
  admin_notes: string | null;
  updated_by: string | null;
  attachment: AttachmentMetadataSummary | null;
}

export interface ApplicationListSummary {
  id: string;
  job_opening_id: string | null;
  vacancy_title: string | null;
  applicant_name: string;
  status: JobApplicationStatus;
  has_attachment: boolean;
  has_notes: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationDetailRecord extends ApplicationListSummary {
  email: string;
  phone: string;
  cover_letter: string | null;
  admin_notes: string | null;
  updated_by: string | null;
  attachment: AttachmentMetadataSummary | null;
}

export interface FeedbackListSummary {
  id: string;
  name: string;
  project_reference: string | null;
  rating: number | null;
  status: CustomerFeedbackStatus;
  has_notes: boolean;
  already_promoted: boolean;
  promoted_testimonial_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackDetailRecord extends FeedbackListSummary {
  email: string | null;
  message: string;
  admin_notes: string | null;
  updated_by: string | null;
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

function paginateArray<T>(
  allMatching: T[],
  page: number,
  pageSize: number
): PaginatedSubmissionList<T> {
  const total = allMatching.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: allMatching.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

async function recordSubmissionEvent(
  client: SupabaseClient,
  params: {
    submissionTable: 'quote_requests' | 'job_applications' | 'customer_feedback';
    submissionId: string;
    actorStaffId: string;
    action: string;
    note?: string | null;
  }
): Promise<void> {
  const { error } = await client.from('submission_access_events').insert({
    submission_table: params.submissionTable,
    submission_id: params.submissionId,
    actor_staff_id: params.actorStaffId,
    action: params.action,
    note: params.note ?? null,
  });
  if (error) {
    console.error('[CMS-Submissions] Failed to write submission access event:', error.message);
  }
}

async function resolveBoundAttachmentSummary(
  client: SupabaseClient,
  table: 'quote_requests' | 'job_applications',
  recordId: string,
  fileReference: string | null | undefined,
  routeType: 'quotes' | 'applications'
): Promise<AttachmentMetadataSummary | null> {
  if (!fileReference) return null;

  const { data, error } = await client
    .from('customer_document_uploads')
    .select('storage_path, file_reference, mime_type, byte_size, claimed_by_table, claimed_record_id, cleanup_state')
    .eq('file_reference', fileReference)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as {
    storage_path: string;
    file_reference: string;
    mime_type: string;
    byte_size: number;
    claimed_by_table: string | null;
    claimed_record_id: string | null;
    cleanup_state: string;
  };

  if (
    row.claimed_by_table !== table ||
    row.claimed_record_id !== recordId ||
    row.cleanup_state !== 'active'
  ) {
    return null;
  }

  return {
    file_name: path.posix.basename(row.storage_path),
    mime_type: row.mime_type,
    byte_size: row.byte_size,
    download_path: `/api/admin/submissions/attachments/${routeType}/${recordId}`,
  };
}

// ---------------------------------------------------------------------------
// 1. Quote Requests
// ---------------------------------------------------------------------------
export async function listQuoteRequestsForAdmin(
  staff: StaffProfile,
  rawQuery: unknown = {},
  clientOverride?: SupabaseClient
): Promise<PaginatedSubmissionList<QuoteListSummary>> {
  assertStaffPermission(staff, 'submission:read');
  const query = SubmissionListQuerySchema.parse(rawQuery ?? {});
  const client = getClient(clientOverride);

  const { data, error } = await client
    .from('quote_requests')
    .select(
      'id, full_name, project_location, service_required, preferred_contact, attachment_url, status, admin_notes, created_at, updated_at'
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    full_name: string;
    project_location: string | null;
    service_required: string;
    preferred_contact: string | null;
    attachment_url: string | null;
    status: QuoteRequestStatus;
    admin_notes: string | null;
    created_at: string;
    updated_at?: string;
  }>;

  const q = query.search.toLowerCase();
  const filtered = rows
    .filter((row) => {
      if (query.status !== 'all' && row.status !== query.status) return false;
      if (!q) return true;
      return [
        row.full_name,
        row.project_location ?? '',
        row.service_required,
        row.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    })
    .map((row): QuoteListSummary => ({
      id: row.id,
      full_name: row.full_name,
      project_location: row.project_location ?? null,
      service_required: row.service_required,
      preferred_contact: row.preferred_contact ?? null,
      status: row.status,
      has_attachment: Boolean(row.attachment_url),
      has_notes: Boolean(row.admin_notes && row.admin_notes.trim()),
      created_at: row.created_at,
      updated_at: row.updated_at ?? row.created_at,
    }));

  return paginateArray(filtered, query.page, query.pageSize);
}

export async function getQuoteRequestByIdForAdmin(
  staff: StaffProfile,
  id: string,
  clientOverride?: SupabaseClient
): Promise<QuoteDetailRecord> {
  assertStaffPermission(staff, 'submission:read');
  const client = getClient(clientOverride);

  const { data, error } = await client
    .from('quote_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Quote request not found.');
  }

  const row = data as {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    project_location: string | null;
    service_required: string;
    description: string;
    preferred_contact: string | null;
    attachment_url: string | null;
    status: QuoteRequestStatus;
    admin_notes: string | null;
    updated_by?: string | null;
    created_at: string;
    updated_at?: string;
  };

  const attachment = await resolveBoundAttachmentSummary(
    client,
    'quote_requests',
    row.id,
    row.attachment_url,
    'quotes'
  );

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    project_location: row.project_location ?? null,
    service_required: row.service_required,
    description: row.description,
    preferred_contact: row.preferred_contact ?? null,
    status: row.status,
    has_attachment: Boolean(attachment),
    has_notes: Boolean(row.admin_notes && row.admin_notes.trim()),
    admin_notes: row.admin_notes ?? null,
    updated_by: row.updated_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    attachment,
  };
}

export async function updateQuoteRequestForAdmin(
  staff: StaffProfile,
  id: string,
  rawInput: unknown,
  clientOverride?: SupabaseClient
): Promise<QuoteDetailRecord> {
  assertStaffPermission(staff, 'submission:write');
  const parsed = UpdateQuoteSubmissionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid quote update payload.'
    );
  }

  const input = parsed.data;
  const client = getClient(clientOverride);
  const current = await getQuoteRequestByIdForAdmin(staff, id, client);

  if (!timestampsMatch(input.expected_updated_at, current.updated_at)) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'This quote request was modified by another session. Reload before saving.'
    );
  }

  const patch: Record<string, unknown> = {
    updated_by: staff.id,
  };
  if (input.status !== undefined) patch.status = input.status;
  if (input.admin_notes !== undefined) patch.admin_notes = input.admin_notes;

  const { data, error } = await client
    .from('quote_requests')
    .update(patch)
    .eq('id', id)
    .eq('updated_at', current.updated_at)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(409, 'CONFLICT', 'Concurrent update detected.');
  }

  await recordSubmissionEvent(client, {
    submissionTable: 'quote_requests',
    submissionId: id,
    actorStaffId: staff.id,
    action: 'update',
    note: input.status ? `Status -> ${input.status}` : 'Updated internal notes',
  });

  return getQuoteRequestByIdForAdmin(staff, id, client);
}

// ---------------------------------------------------------------------------
// 2. Job Applications
// ---------------------------------------------------------------------------
export async function listJobApplicationsForAdmin(
  staff: StaffProfile,
  rawQuery: unknown = {},
  clientOverride?: SupabaseClient
): Promise<PaginatedSubmissionList<ApplicationListSummary>> {
  assertStaffPermission(staff, 'submission:read');
  const query = SubmissionListQuerySchema.parse(rawQuery ?? {});
  const client = getClient(clientOverride);

  const [appsRes, openingsRes] = await Promise.all([
    client
      .from('job_applications')
      .select(
        'id, job_opening_id, applicant_name, cv_url, status, admin_notes, created_at, updated_at'
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
    client.from('job_openings').select('id, title'),
  ]);

  if (appsRes.error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', appsRes.error.message);
  }

  const openingTitleMap = new Map<string, string>();
  for (const op of (openingsRes.data ?? []) as Array<{ id: string; title: string }>) {
    openingTitleMap.set(op.id, op.title);
  }

  const rows = (appsRes.data ?? []) as Array<{
    id: string;
    job_opening_id: string | null;
    applicant_name: string;
    cv_url: string | null;
    status: JobApplicationStatus;
    admin_notes: string | null;
    created_at: string;
    updated_at?: string;
  }>;

  const q = query.search.toLowerCase();
  const filtered = rows
    .filter((row) => {
      if (query.status !== 'all' && row.status !== query.status) return false;
      if (!q) return true;
      const vacTitle = row.job_opening_id
        ? openingTitleMap.get(row.job_opening_id) ?? ''
        : '';
      return [row.applicant_name, vacTitle, row.status]
        .join(' ')
        .toLowerCase()
        .includes(q);
    })
    .map((row): ApplicationListSummary => ({
      id: row.id,
      job_opening_id: row.job_opening_id ?? null,
      vacancy_title: row.job_opening_id
        ? openingTitleMap.get(row.job_opening_id) ?? null
        : null,
      applicant_name: row.applicant_name,
      status: row.status,
      has_attachment: Boolean(row.cv_url),
      has_notes: Boolean(row.admin_notes && row.admin_notes.trim()),
      created_at: row.created_at,
      updated_at: row.updated_at ?? row.created_at,
    }));

  return paginateArray(filtered, query.page, query.pageSize);
}

export async function getJobApplicationByIdForAdmin(
  staff: StaffProfile,
  id: string,
  clientOverride?: SupabaseClient
): Promise<ApplicationDetailRecord> {
  assertStaffPermission(staff, 'submission:read');
  const client = getClient(clientOverride);

  const { data, error } = await client
    .from('job_applications')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Job application not found.');
  }

  const row = data as {
    id: string;
    job_opening_id: string | null;
    applicant_name: string;
    email: string;
    phone: string;
    cover_letter: string | null;
    cv_url: string | null;
    status: JobApplicationStatus;
    admin_notes: string | null;
    updated_by?: string | null;
    created_at: string;
    updated_at?: string;
  };

  let vacancyTitle: string | null = null;
  if (row.job_opening_id) {
    const { data: op } = await client
      .from('job_openings')
      .select('title')
      .eq('id', row.job_opening_id)
      .maybeSingle();
    if (op) {
      vacancyTitle = (op as { title: string }).title;
    }
  }

  const attachment = await resolveBoundAttachmentSummary(
    client,
    'job_applications',
    row.id,
    row.cv_url,
    'applications'
  );

  return {
    id: row.id,
    job_opening_id: row.job_opening_id ?? null,
    vacancy_title: vacancyTitle,
    applicant_name: row.applicant_name,
    email: row.email,
    phone: row.phone,
    cover_letter: row.cover_letter ?? null,
    status: row.status,
    has_attachment: Boolean(attachment),
    has_notes: Boolean(row.admin_notes && row.admin_notes.trim()),
    admin_notes: row.admin_notes ?? null,
    updated_by: row.updated_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    attachment,
  };
}

export async function updateJobApplicationForAdmin(
  staff: StaffProfile,
  id: string,
  rawInput: unknown,
  clientOverride?: SupabaseClient
): Promise<ApplicationDetailRecord> {
  assertStaffPermission(staff, 'submission:write');
  const parsed = UpdateApplicationSubmissionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid application update payload.'
    );
  }

  const input = parsed.data;
  const client = getClient(clientOverride);
  const current = await getJobApplicationByIdForAdmin(staff, id, client);

  if (!timestampsMatch(input.expected_updated_at, current.updated_at)) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'This application was modified by another session. Reload before saving.'
    );
  }

  const patch: Record<string, unknown> = {
    updated_by: staff.id,
  };
  if (input.status !== undefined) patch.status = input.status;
  if (input.admin_notes !== undefined) patch.admin_notes = input.admin_notes;

  const { data, error } = await client
    .from('job_applications')
    .update(patch)
    .eq('id', id)
    .eq('updated_at', current.updated_at)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(409, 'CONFLICT', 'Concurrent update detected.');
  }

  await recordSubmissionEvent(client, {
    submissionTable: 'job_applications',
    submissionId: id,
    actorStaffId: staff.id,
    action: 'update',
    note: input.status ? `Status -> ${input.status}` : 'Updated internal notes',
  });

  return getJobApplicationByIdForAdmin(staff, id, client);
}

// ---------------------------------------------------------------------------
// 3. Customer Feedback
// ---------------------------------------------------------------------------
export async function listCustomerFeedbackForAdmin(
  staff: StaffProfile,
  rawQuery: unknown = {},
  clientOverride?: SupabaseClient
): Promise<PaginatedSubmissionList<FeedbackListSummary>> {
  assertStaffPermission(staff, 'submission:read');
  const query = SubmissionListQuerySchema.parse(rawQuery ?? {});
  const client = getClient(clientOverride);

  const [fbRes, promotedRes] = await Promise.all([
    client
      .from('customer_feedback')
      .select(
        'id, name, project_reference, rating, status, admin_notes, created_at, updated_at'
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
    client
      .from('testimonials')
      .select('id, source_feedback_id')
      .not('source_feedback_id', 'is', null),
  ]);

  if (fbRes.error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', fbRes.error.message);
  }

  const promotedMap = new Map<string, string>();
  for (const t of (promotedRes.data ?? []) as Array<{
    id: string;
    source_feedback_id: string | null;
  }>) {
    if (t.source_feedback_id) {
      promotedMap.set(t.source_feedback_id, t.id);
    }
  }

  const rows = (fbRes.data ?? []) as Array<{
    id: string;
    name: string;
    project_reference: string | null;
    rating: number | null;
    status: CustomerFeedbackStatus;
    admin_notes?: string | null;
    created_at: string;
    updated_at?: string;
  }>;

  const q = query.search.toLowerCase();
  const filtered = rows
    .filter((row) => {
      if (query.status !== 'all' && row.status !== query.status) return false;
      if (!q) return true;
      return [row.name, row.project_reference ?? '', row.status]
        .join(' ')
        .toLowerCase()
        .includes(q);
    })
    .map((row): FeedbackListSummary => {
      const tid = promotedMap.get(row.id) ?? null;
      return {
        id: row.id,
        name: row.name,
        project_reference: row.project_reference ?? null,
        rating: row.rating ?? null,
        status: row.status,
        has_notes: Boolean(row.admin_notes && row.admin_notes.trim()),
        already_promoted: Boolean(tid),
        promoted_testimonial_id: tid,
        created_at: row.created_at,
        updated_at: row.updated_at ?? row.created_at,
      };
    });

  return paginateArray(filtered, query.page, query.pageSize);
}

export async function getCustomerFeedbackByIdForAdmin(
  staff: StaffProfile,
  id: string,
  clientOverride?: SupabaseClient
): Promise<FeedbackDetailRecord> {
  assertStaffPermission(staff, 'submission:read');
  const client = getClient(clientOverride);

  const [fbRes, promRes] = await Promise.all([
    client.from('customer_feedback').select('*').eq('id', id).maybeSingle(),
    client
      .from('testimonials')
      .select('id')
      .eq('source_feedback_id', id)
      .maybeSingle(),
  ]);

  if (fbRes.error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', fbRes.error.message);
  }
  if (!fbRes.data) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Customer feedback not found.');
  }

  const row = fbRes.data as {
    id: string;
    name: string;
    email: string | null;
    project_reference: string | null;
    rating: number | null;
    message: string;
    status: CustomerFeedbackStatus;
    admin_notes?: string | null;
    updated_by?: string | null;
    created_at: string;
    updated_at?: string;
  };
  const promotedTid = promRes.data ? (promRes.data as { id: string }).id : null;

  return {
    id: row.id,
    name: row.name,
    email: row.email ?? null,
    project_reference: row.project_reference ?? null,
    rating: row.rating ?? null,
    message: row.message,
    status: row.status,
    has_notes: Boolean(row.admin_notes && row.admin_notes.trim()),
    admin_notes: row.admin_notes ?? null,
    updated_by: row.updated_by ?? null,
    already_promoted: Boolean(promotedTid),
    promoted_testimonial_id: promotedTid,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
  };
}

export async function updateCustomerFeedbackForAdmin(
  staff: StaffProfile,
  id: string,
  rawInput: unknown,
  clientOverride?: SupabaseClient
): Promise<FeedbackDetailRecord> {
  assertStaffPermission(staff, 'submission:write');
  const parsed = UpdateFeedbackSubmissionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid feedback update payload.'
    );
  }

  const input = parsed.data;
  const client = getClient(clientOverride);
  const current = await getCustomerFeedbackByIdForAdmin(staff, id, client);

  if (!timestampsMatch(input.expected_updated_at, current.updated_at)) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'This feedback record was modified by another session. Reload before saving.'
    );
  }

  const patch: Record<string, unknown> = {
    updated_by: staff.id,
  };
  if (input.status !== undefined) patch.status = input.status;
  if (input.admin_notes !== undefined) patch.admin_notes = input.admin_notes;

  const { data, error } = await client
    .from('customer_feedback')
    .update(patch)
    .eq('id', id)
    .eq('updated_at', current.updated_at)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(409, 'CONFLICT', 'Concurrent update detected.');
  }

  await recordSubmissionEvent(client, {
    submissionTable: 'customer_feedback',
    submissionId: id,
    actorStaffId: staff.id,
    action: 'update',
    note: input.status ? `Status -> ${input.status}` : 'Updated internal notes',
  });

  return getCustomerFeedbackByIdForAdmin(staff, id, client);
}

// ---------------------------------------------------------------------------
// 4. Private Attachment Download (Bound to Authorized Submission)
// ---------------------------------------------------------------------------
export async function downloadAuthorizedSubmissionAttachment(
  staff: StaffProfile,
  routeTable: 'quotes' | 'applications',
  submissionId: string,
  clientOverride?: SupabaseClient
): Promise<{
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}> {
  assertStaffPermission(staff, 'submission:download_attachment');
  const client = getClient(clientOverride);

  const dbTable =
    routeTable === 'quotes' ? 'quote_requests' : 'job_applications';
  const expectedCategory = routeTable === 'quotes' ? 'documents' : 'resumes';
  const fileColumn = routeTable === 'quotes' ? 'attachment_url' : 'cv_url';

  const { data: subRow, error: subErr } = await client
    .from(dbTable)
    .select(`id, ${fileColumn}`)
    .eq('id', submissionId)
    .maybeSingle();

  if (subErr) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', subErr.message);
  }
  if (!subRow) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Submission record not found.');
  }

  const fileReference = (subRow as Record<string, unknown>)[fileColumn] as
    | string
    | null;
  if (!fileReference || typeof fileReference !== 'string') {
    throw new EditorialHttpError(
      404,
      'NOT_FOUND',
      'No attachment is bound to this submission.'
    );
  }

  if (
    fileReference.includes('..') ||
    !fileReference.startsWith(`supabase://customer-documents/${expectedCategory}/`)
  ) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      'Invalid or unauthorized attachment reference.'
    );
  }

  const { data: uploadRow, error: upErr } = await client
    .from('customer_document_uploads')
    .select(
      'id, bucket_id, category, storage_path, file_reference, mime_type, byte_size, claimed_by_table, claimed_record_id, cleanup_state'
    )
    .eq('file_reference', fileReference)
    .maybeSingle();

  if (upErr) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', upErr.message);
  }
  if (!uploadRow) {
    throw new EditorialHttpError(
      404,
      'NOT_FOUND',
      'Bound attachment metadata not found.'
    );
  }

  const upload = uploadRow as {
    id: string;
    bucket_id: string;
    category: string;
    storage_path: string;
    file_reference: string;
    mime_type: string;
    byte_size: number;
    claimed_by_table: string | null;
    claimed_record_id: string | null;
    cleanup_state: string;
  };

  if (
    upload.bucket_id !== 'customer-documents' ||
    upload.category !== expectedCategory ||
    upload.claimed_by_table !== dbTable ||
    upload.claimed_record_id !== submissionId ||
    upload.cleanup_state !== 'active' ||
    !upload.storage_path ||
    upload.storage_path.includes('..') ||
    !upload.storage_path.startsWith(`${expectedCategory}/`)
  ) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      'Attachment ownership verification failed.'
    );
  }

  const { data: blob, error: dlErr } = await client.storage
    .from('customer-documents')
    .download(upload.storage_path);

  if (dlErr || !blob) {
    throw new EditorialHttpError(
      404,
      'STORAGE_ERROR',
      'Unable to retrieve private document from storage.'
    );
  }

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const safeFileName = path.posix
    .basename(upload.storage_path)
    .replace(/[^a-zA-Z0-9._-]/g, '_');

  await recordSubmissionEvent(client, {
    submissionTable: dbTable,
    submissionId,
    actorStaffId: staff.id,
    action: 'download_attachment',
    note: `Downloaded ${safeFileName} (${bytes.byteLength} bytes)`,
  });

  return {
    bytes,
    mimeType: upload.mime_type,
    fileName: safeFileName,
  };
}
