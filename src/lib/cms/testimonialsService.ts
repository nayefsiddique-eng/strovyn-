import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { EditorialHttpError } from './http';
import { hasEditorialPermission } from './rbac';
import type { EditorialAction, StaffProfile } from './roles';
import {
  CreateTestimonialSchema,
  PromoteFeedbackSchema,
  TestimonialFeatureSchema,
  TestimonialReorderSchema,
  TestimonialTransitionSchema,
  UpdateTestimonialSchema,
  type TestimonialModerationStatus,
} from './testimonialValidators';

export type TestimonialModerationAction =
  | 'submit_review'
  | 'approve'
  | 'reject'
  | 'publish'
  | 'unpublish';

export interface TestimonialRecord {
  id: string;
  customer_name: string;
  content: string;
  customer_role: string | null;
  location: string | null;
  specification: string | null;
  project_reference: string | null;
  related_project_id: string | null;
  source_feedback_id: string | null;
  rating: number | null;
  status: string;
  moderation_status: TestimonialModerationStatus;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
  consent_verified: boolean;
  consent_evidence: string | null;
  consent_verified_by: string | null;
  consent_verified_at: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  updated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestimonialModerationEventRecord {
  id: string;
  testimonial_id: string;
  actor_staff_id: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
  actor_name?: string | null;
}

export interface PromotableFeedbackRecord {
  id: string;
  name: string;
  project_reference: string | null;
  rating: number | null;
  message: string;
  status: string;
  created_at: string;
  already_promoted: boolean;
  promoted_testimonial_id: string | null;
}

export interface ListTestimonialsFilters {
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

function mapLegacyStatus(moderationStatus: TestimonialModerationStatus): string {
  switch (moderationStatus) {
    case 'approved':
      return 'approved';
    case 'rejected':
    case 'hidden':
      return 'rejected';
    case 'draft':
    case 'pending_review':
    default:
      return 'pending';
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

async function recordModerationEvent(
  client: SupabaseClient,
  params: {
    testimonialId: string;
    actorStaffId: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    note?: string | null;
  }
): Promise<void> {
  const { error } = await client.from('testimonial_moderation_events').insert({
    testimonial_id: params.testimonialId,
    actor_staff_id: params.actorStaffId,
    action: params.action,
    from_status: params.fromStatus,
    to_status: params.toStatus,
    note: params.note ?? null,
  });

  if (error) {
    console.error('[CMS-Testimonials] Failed to write moderation event:', error.message);
  }
}

async function fetchTestimonialOrThrow(
  client: SupabaseClient,
  id: string
): Promise<TestimonialRecord> {
  const { data, error } = await client
    .from('testimonials')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Testimonial not found.');
  }
  return data as TestimonialRecord;
}

export async function listTestimonialsForAdmin(
  staff: StaffProfile,
  filters: ListTestimonialsFilters = {},
  clientOverride?: SupabaseClient
): Promise<TestimonialRecord[]> {
  assertStaffPermission(staff, 'testimonial:read');
  const client = getClient(clientOverride);

  let query = client
    .from('testimonials')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });

  const filter = (filters.filter || 'all').trim().toLowerCase();
  if (filter === 'published') {
    query = query.eq('is_published', true);
  } else if (
    filter === 'draft' ||
    filter === 'pending_review' ||
    filter === 'approved' ||
    filter === 'rejected' ||
    filter === 'hidden'
  ) {
    query = query.eq('moderation_status', filter);
    if (filter === 'approved') {
      query = query.eq('is_published', false);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }

  const rows = (data ?? []) as TestimonialRecord[];
  const search = (filters.search || '').trim().toLowerCase();
  if (!search) {
    return rows;
  }

  return rows.filter((row) =>
    [
      row.customer_name,
      row.content,
      row.customer_role ?? '',
      row.location ?? '',
      row.project_reference ?? '',
      row.specification ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(search)
  );
}

export async function getTestimonialByIdForAdmin(
  staff: StaffProfile,
  id: string,
  clientOverride?: SupabaseClient
): Promise<{
  testimonial: TestimonialRecord;
  events: TestimonialModerationEventRecord[];
}> {
  assertStaffPermission(staff, 'testimonial:read');
  const client = getClient(clientOverride);

  const testimonial = await fetchTestimonialOrThrow(client, id);
  const { data: eventsData, error: eventsErr } = await client
    .from('testimonial_moderation_events')
    .select('*')
    .eq('testimonial_id', id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (eventsErr) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', eventsErr.message);
  }

  return {
    testimonial,
    events: (eventsData ?? []) as TestimonialModerationEventRecord[],
  };
}

export async function createTestimonialDraft(
  staff: StaffProfile,
  rawInput: unknown,
  clientOverride?: SupabaseClient
): Promise<TestimonialRecord> {
  assertStaffPermission(staff, 'testimonial:create_draft');
  const parsed = CreateTestimonialSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid testimonial payload.'
    );
  }

  const input = parsed.data;
  const client = getClient(clientOverride);
  const nowIso = new Date().toISOString();

  const consentVerified = Boolean(
    input.consent_verified && input.consent_evidence && input.consent_evidence.trim().length >= 4
  );

  const { data, error } = await client
    .from('testimonials')
    .insert({
      customer_name: input.customer_name,
      content: input.content,
      rating: input.rating ?? null,
      customer_role: input.customer_role ?? null,
      location: input.location ?? null,
      specification: input.specification ?? null,
      project_reference: input.project_reference ?? null,
      related_project_id: input.related_project_id ?? null,
      consent_verified: consentVerified,
      consent_evidence: input.consent_evidence ?? null,
      consent_verified_by: consentVerified ? staff.id : null,
      consent_verified_at: consentVerified ? nowIso : null,
      moderation_status: 'draft',
      status: 'pending',
      is_published: false,
      is_featured: hasEditorialPermission(staff.role, 'testimonial:feature')
        ? Boolean(input.is_featured)
        : false,
      sort_order: hasEditorialPermission(staff.role, 'testimonial:feature')
        ? input.sort_order ?? 0
        : 0,
      created_by: staff.id,
      updated_by: staff.id,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new EditorialHttpError(
      500,
      'INTERNAL_ERROR',
      error?.message ?? 'Failed to create testimonial draft.'
    );
  }

  const created = data as TestimonialRecord;
  await recordModerationEvent(client, {
    testimonialId: created.id,
    actorStaffId: staff.id,
    action: 'create_draft',
    fromStatus: null,
    toStatus: 'draft',
    note: consentVerified ? 'Created with verified consent evidence.' : 'Created as draft.',
  });

  return created;
}

export async function updateTestimonialRecord(
  staff: StaffProfile,
  id: string,
  rawInput: unknown,
  clientOverride?: SupabaseClient
): Promise<TestimonialRecord> {
  const parsed = UpdateTestimonialSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid testimonial update payload.'
    );
  }

  const input = parsed.data;
  const client = getClient(clientOverride);
  const current = await fetchTestimonialOrThrow(client, id);

  if (current.is_published || current.moderation_status === 'approved') {
    assertStaffPermission(staff, 'testimonial:edit_published');
  } else {
    assertStaffPermission(staff, 'testimonial:edit_draft');
  }

  if (!timestampsMatch(input.expected_updated_at, current.updated_at)) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'This testimonial was modified by another session. Reload or rebase before saving.'
    );
  }

  const nextConsentEvidence =
    input.consent_evidence !== undefined ? input.consent_evidence : current.consent_evidence;
  const requestedConsentVerified =
    input.consent_verified !== undefined ? input.consent_verified : current.consent_verified;

  if (requestedConsentVerified && (!nextConsentEvidence || nextConsentEvidence.trim().length < 4)) {
    throw new EditorialHttpError(
      422,
      'BAD_REQUEST',
      'Publication consent evidence (e.g. written email or signed form reference) is required before marking consent verified.'
    );
  }

  if (current.is_published && !requestedConsentVerified) {
    throw new EditorialHttpError(
      422,
      'BAD_REQUEST',
      'Published testimonials must retain verified customer consent. Unpublish first before revoking consent.'
    );
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    updated_by: staff.id,
  };

  if (input.customer_name !== undefined) patch.customer_name = input.customer_name;
  if (input.content !== undefined) patch.content = input.content;
  if (input.rating !== undefined) patch.rating = input.rating;
  if (input.customer_role !== undefined) patch.customer_role = input.customer_role;
  if (input.location !== undefined) patch.location = input.location;
  if (input.specification !== undefined) patch.specification = input.specification;
  if (input.project_reference !== undefined) patch.project_reference = input.project_reference;
  if (input.related_project_id !== undefined) patch.related_project_id = input.related_project_id;
  if (input.consent_evidence !== undefined) patch.consent_evidence = input.consent_evidence;
  if (input.consent_verified !== undefined) {
    patch.consent_verified = input.consent_verified;
    patch.consent_verified_by = input.consent_verified ? staff.id : null;
    patch.consent_verified_at = input.consent_verified ? nowIso : null;
  }

  const { data, error } = await client
    .from('testimonials')
    .update(patch)
    .eq('id', id)
    .eq('updated_at', current.updated_at)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'Concurrent update detected while saving testimonial.'
    );
  }

  await recordModerationEvent(client, {
    testimonialId: id,
    actorStaffId: staff.id,
    action: 'update',
    fromStatus: current.moderation_status,
    toStatus: current.moderation_status,
    note: 'Updated testimonial details.',
  });

  return data as TestimonialRecord;
}

export async function transitionTestimonialModeration(
  staff: StaffProfile,
  id: string,
  action: TestimonialModerationAction,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<TestimonialRecord> {
  const parsed = TestimonialTransitionSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid transition payload.'
    );
  }

  const payload = parsed.data;
  const client = getClient(clientOverride);
  const current = await fetchTestimonialOrThrow(client, id);

  if (!timestampsMatch(payload.expected_updated_at, current.updated_at)) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'This testimonial was modified by another session. Reload before moderating.'
    );
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    updated_by: staff.id,
  };
  let nextStatus: TestimonialModerationStatus = current.moderation_status;
  let eventNote: string | null = payload.note ?? payload.reason ?? null;

  switch (action) {
    case 'submit_review': {
      assertStaffPermission(staff, 'testimonial:edit_draft');
      if (current.moderation_status !== 'draft' && current.moderation_status !== 'rejected') {
        throw new EditorialHttpError(
          422,
          'INVALID_TRANSITION',
          `Cannot submit testimonial in "${current.moderation_status}" status for review.`
        );
      }
      nextStatus = 'pending_review';
      patch.moderation_status = nextStatus;
      patch.status = mapLegacyStatus(nextStatus);
      patch.is_published = false;
      break;
    }

    case 'approve': {
      assertStaffPermission(staff, 'testimonial:review');
      if (current.moderation_status === 'approved') {
        return current;
      }
      nextStatus = 'approved';
      patch.moderation_status = nextStatus;
      patch.status = mapLegacyStatus(nextStatus);
      patch.approved_by = staff.id;
      patch.approved_at = nowIso;
      patch.rejection_reason = null;
      break;
    }

    case 'reject': {
      assertStaffPermission(staff, 'testimonial:review');
      nextStatus = 'rejected';
      patch.moderation_status = nextStatus;
      patch.status = mapLegacyStatus(nextStatus);
      patch.is_published = false;
      patch.rejection_reason = payload.reason ?? payload.note ?? 'Rejected by reviewer.';
      eventNote = patch.rejection_reason as string;
      break;
    }

    case 'publish': {
      assertStaffPermission(staff, 'testimonial:publish');
      if (!payload.confirmed) {
        throw new EditorialHttpError(
          422,
          'BAD_REQUEST',
          'Explicit staff confirmation is required before publishing a testimonial.'
        );
      }
      if (!current.consent_verified || !current.consent_evidence?.trim()) {
        throw new EditorialHttpError(
          422,
          'BAD_REQUEST',
          'Verified customer consent and documented evidence are required before publication.'
        );
      }
      if (current.moderation_status !== 'approved') {
        throw new EditorialHttpError(
          422,
          'INVALID_TRANSITION',
          'Testimonial must be approved before it can be published.'
        );
      }
      nextStatus = 'approved';
      patch.moderation_status = 'approved';
      patch.status = 'approved';
      patch.is_published = true;
      patch.published_by = staff.id;
      patch.published_at = current.published_at ?? nowIso;
      break;
    }

    case 'unpublish': {
      assertStaffPermission(staff, 'testimonial:publish');
      nextStatus = 'hidden';
      patch.moderation_status = nextStatus;
      patch.status = mapLegacyStatus(nextStatus);
      patch.is_published = false;
      break;
    }
  }

  const { data, error } = await client
    .from('testimonials')
    .update(patch)
    .eq('id', id)
    .eq('updated_at', current.updated_at)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!data) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'Concurrent update detected during moderation transition.'
    );
  }

  await recordModerationEvent(client, {
    testimonialId: id,
    actorStaffId: staff.id,
    action,
    fromStatus: current.moderation_status,
    toStatus: nextStatus,
    note: eventNote,
  });

  return data as TestimonialRecord;
}

export async function setTestimonialFeatured(
  staff: StaffProfile,
  id: string,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<TestimonialRecord> {
  assertStaffPermission(staff, 'testimonial:feature');
  const parsed = TestimonialFeatureSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid featured update payload.'
    );
  }

  const payload = parsed.data;
  const client = getClient(clientOverride);
  const current = await fetchTestimonialOrThrow(client, id);

  if (!timestampsMatch(payload.expected_updated_at, current.updated_at)) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'This testimonial was modified by another session. Reload before updating featured status.'
    );
  }

  const { data, error } = await client
    .from('testimonials')
    .update({
      is_featured: payload.is_featured,
      updated_by: staff.id,
    })
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

  await recordModerationEvent(client, {
    testimonialId: id,
    actorStaffId: staff.id,
    action: payload.is_featured ? 'feature' : 'unfeature',
    fromStatus: current.moderation_status,
    toStatus: current.moderation_status,
    note: payload.is_featured ? 'Marked as featured endorsement.' : 'Removed featured flag.',
  });

  return data as TestimonialRecord;
}

export async function reorderTestimonials(
  staff: StaffProfile,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<{ updatedCount: number }> {
  assertStaffPermission(staff, 'testimonial:feature');
  const parsed = TestimonialReorderSchema.safeParse(rawPayload);
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
      .from('testimonials')
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

export async function listPromotableFeedback(
  staff: StaffProfile,
  clientOverride?: SupabaseClient
): Promise<PromotableFeedbackRecord[]> {
  assertStaffPermission(staff, 'testimonial:promote_feedback');
  const client = getClient(clientOverride);

  const [feedbackRes, promotedRes] = await Promise.all([
    client
      .from('customer_feedback')
      .select('id, name, project_reference, rating, message, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    client
      .from('testimonials')
      .select('id, source_feedback_id')
      .not('source_feedback_id', 'is', null),
  ]);

  if (feedbackRes.error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', feedbackRes.error.message);
  }
  if (promotedRes.error) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', promotedRes.error.message);
  }

  const promotedMap = new Map<string, string>();
  for (const row of (promotedRes.data ?? []) as Array<{
    id: string;
    source_feedback_id: string | null;
  }>) {
    if (row.source_feedback_id) {
      promotedMap.set(row.source_feedback_id, row.id);
    }
  }

  return ((feedbackRes.data ?? []) as Array<{
    id: string;
    name: string;
    project_reference: string | null;
    rating: number | null;
    message: string;
    status: string;
    created_at: string;
  }>).map((fb) => {
    const existingTid = promotedMap.get(fb.id) ?? null;
    return {
      id: fb.id,
      name: fb.name,
      project_reference: fb.project_reference,
      rating: fb.rating,
      message: fb.message,
      status: fb.status,
      created_at: fb.created_at,
      already_promoted: Boolean(existingTid),
      promoted_testimonial_id: existingTid,
    };
  });
}

export async function promoteFeedbackToTestimonialDraft(
  staff: StaffProfile,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<TestimonialRecord> {
  assertStaffPermission(staff, 'testimonial:promote_feedback');
  const parsed = PromoteFeedbackSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid feedback promotion payload.'
    );
  }

  const input = parsed.data;
  const client = getClient(clientOverride);

  const { data: existing, error: existingErr } = await client
    .from('testimonials')
    .select('id')
    .eq('source_feedback_id', input.feedback_id)
    .maybeSingle();

  if (existingErr) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', existingErr.message);
  }
  if (existing) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'This customer feedback record has already been promoted to a testimonial draft.'
    );
  }

  const { data: feedback, error: fbErr } = await client
    .from('customer_feedback')
    .select('id, name, project_reference, rating, message')
    .eq('id', input.feedback_id)
    .maybeSingle();

  if (fbErr) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', fbErr.message);
  }
  if (!feedback) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Source customer feedback not found.');
  }

  const fb = feedback as {
    id: string;
    name: string;
    project_reference: string | null;
    rating: number | null;
    message: string;
  };

  // Never auto-publish and never assume consent from legacy customer_feedback rows.
  // Private contact fields (email) are intentionally excluded.
  const { data: inserted, error: insErr } = await client
    .from('testimonials')
    .insert({
      customer_name: fb.name,
      content: fb.message,
      project_reference: fb.project_reference ?? null,
      rating:
        typeof fb.rating === 'number' && fb.rating >= 1 && fb.rating <= 5
          ? fb.rating
          : null,
      customer_role: input.customer_role ?? null,
      location: input.location ?? null,
      source_feedback_id: fb.id,
      consent_verified: false,
      consent_evidence: null,
      moderation_status: 'draft',
      status: 'pending',
      is_published: false,
      is_featured: false,
      created_by: staff.id,
      updated_by: staff.id,
    })
    .select('*')
    .single();

  if (insErr) {
    if (insErr.code === '23505') {
      throw new EditorialHttpError(
        409,
        'CONFLICT',
        'This customer feedback record has already been promoted to a testimonial draft.'
      );
    }
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', insErr.message);
  }

  const created = inserted as TestimonialRecord;
  await recordModerationEvent(client, {
    testimonialId: created.id,
    actorStaffId: staff.id,
    action: 'promote_feedback',
    fromStatus: null,
    toStatus: 'draft',
    note: `Promoted from customer_feedback ${fb.id}. Manual consent verification required before publication.`,
  });

  return created;
}
