import 'server-only';
import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServiceRoleClient,
  isCmsSupabaseConfigured,
  isServiceRoleConfigured,
} from '@/lib/supabase/serviceRole';
import { sendNotificationEmail } from '@/lib/resend/client';
import { escapeHtml } from '@/lib/security/escapeHtml';
import { validateUploadFile } from '@/lib/security/fileValidation';
import { hasEditorialPermission } from './rbac';
import { EditorialHttpError } from './http';
import type { EditorialAction, StaffProfile } from './roles';
import {
  APPROVED_PUBLIC_STATEMENT,
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  INSURANCE_ENQUIRY_STATUSES,
  INSURANCE_REQUEST_TYPES,
  INSURANCE_REQUEST_TYPE_LABELS,
  type AdminInsuranceWorkspaceSnapshot,
  type IncidentCategory,
  type InsuranceEnquiryAuditEvent,
  type InsuranceEnquiryCounts,
  type InsuranceEnquiryDetail,
  type InsuranceEnquiryKind,
  type InsuranceEnquiryStatus,
  type InsuranceEnquirySummary,
  type InsuranceIncidentAttachmentSummary,
  type InsuranceRecord,
  type InsuranceRequestType,
  type PublicInsuranceStatus,
  type UpdateInsuranceInput,
} from './insuranceTypes';

export * from './insuranceTypes';

const INCIDENT_PHOTO_ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_INCIDENT_PHOTOS = 3;
const MAX_INCIDENT_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MiB per photo
const MAX_TOTAL_INCIDENT_BYTES = 20 * 1024 * 1024; // 20 MiB combined
const INCIDENT_RETENTION_DAYS = 365;

function getTodayUtcString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getClient(override?: SupabaseClient): SupabaseClient {
  return override ?? createServiceRoleClient();
}

function assertInsurancePermission(staff: StaffProfile, action: EditorialAction): void {
  if (!staff.is_active) {
    throw new EditorialHttpError(403, 'FORBIDDEN', 'Staff account is inactive.');
  }
  if (!hasEditorialPermission(staff.role, action)) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      `Role "${staff.role}" is not authorized to perform "${action}".`
    );
  }
}

function isValidEmail(email: string): boolean {
  if (!email || email.length < 5 || email.length > 160) return false;
  if (/[\r\n\0<>]/.test(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === dateStr;
}

function sanitizeDisplayFilename(rawName: string): string {
  const base = rawName
    .split(/[/\\]/)
    .pop()
    ?.replace(/[^\w.\- ()]/g, '_')
    .trim()
    .slice(0, 100);
  return base && base.length > 0 ? base : 'incident-photo.jpg';
}

export function generateInsuranceReferenceCode(kind: InsuranceEnquiryKind): string {
  const prefix = kind === 'incident_report' ? 'INC' : 'INS';
  const dateCompact = getTodayUtcString().replace(/-/g, '');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${dateCompact}-${suffix}`;
}

export interface PublicInsuranceSubmissionInput {
  enquiry_kind: string;
  full_name: string;
  email: string;
  phone?: string | null;
  project_location?: string | null;
  request_type?: string | null;
  message?: string | null;
  incident_date?: string | null;
  incident_category?: string | null;
  incident_description?: string | null;
  disclaimer_acknowledged?: boolean;
  idempotency_key?: string | null;
  website?: string | null;
}

export interface UploadedPhotoBuffer {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface PublicInsuranceSubmissionResult {
  id: string;
  referenceCode: string;
  enquiryKind: InsuranceEnquiryKind;
  isUrgent: boolean;
  attachmentCount: number;
  createdAt: string;
  deduplicated?: boolean;
}

async function recordEnquiryAuditEvent(
  client: SupabaseClient,
  params: {
    enquiryId: string | null;
    actorStaffId: string | null;
    action:
      | 'created'
      | 'viewed'
      | 'marked_reviewed'
      | 'status_changed'
      | 'notes_updated'
      | 'urgent_toggled'
      | 'closed'
      | 'attachment_downloaded'
      | 'exported';
    fromStatus?: string | null;
    toStatus?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await client.from('insurance_enquiry_audit_log').insert({
      enquiry_id: params.enquiryId,
      actor_staff_id: params.actorStaffId,
      action: params.action,
      from_status: params.fromStatus ?? null,
      to_status: params.toStatus ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.warn(
      '[CMS-Insurance] Audit log write warning:',
      err instanceof Error ? err.message : 'Unknown error'
    );
  }
}

function buildAdminZeroPiiAlertEmail(params: {
  referenceCode: string;
  enquiryKind: InsuranceEnquiryKind;
  subCategoryLabel: string;
  isUrgent: boolean;
  attachmentCount: number;
}): { subject: string; html: string } {
  const baseOrigin = (() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || '';
    try {
      return raw ? new URL(raw).origin : '';
    } catch {
      return '';
    }
  })();

  const adminHref = baseOrigin ? `${baseOrigin}/admin/insurance` : '/admin/insurance';
  const safeRef = escapeHtml(params.referenceCode);
  const safeCategory = escapeHtml(params.subCategoryLabel);
  const kindTitle =
    params.enquiryKind === 'incident_report'
      ? 'Incident Report Notification'
      : 'Insurance Information Request';

  const subject = params.isUrgent
    ? `[URGENT INCIDENT] Strovyn Notification — Ref ${params.referenceCode}`
    : params.enquiryKind === 'incident_report'
      ? `[INCIDENT REPORT] Strovyn Notification — Ref ${params.referenceCode}`
      : `Strovyn Insurance Enquiry — Ref ${params.referenceCode}`;

  const html = `
    <h2>${escapeHtml(kindTitle)}</h2>
    <p><strong>Reference:</strong> ${safeRef}</p>
    <p><strong>Category:</strong> ${safeCategory}</p>
    <p><strong>Priority:</strong> ${params.isUrgent ? 'URGENT — Prompt Admin Review Required' : 'Standard'}</p>
    <p><strong>Private Supporting Photos:</strong> ${params.attachmentCount}</p>
    <p>For privacy and security, customer contact details and incident descriptions are omitted from email transit and URLs. Sign in to the restricted Admin Portal to review the record:</p>
    <p><a href="${escapeHtml(adminHref)}">Open Insurance &amp; Enquiries in Strovyn Admin</a></p>
  `;

  return { subject, html };
}

/**
 * Public submission handler for both Option A (Request Insurance Information)
 * and Option B (Report an Incident).
 * Never requires active policy publication; validates all inputs and magic-byte image headers
 * before touching storage so the endpoint can never act as an open file uploader.
 */
export async function submitPublicInsuranceEnquiry(
  rawInput: PublicInsuranceSubmissionInput,
  photos: UploadedPhotoBuffer[] = [],
  options?: {
    clientOverride?: SupabaseClient;
    skipEmailNotification?: boolean;
  }
): Promise<PublicInsuranceSubmissionResult> {
  // 1. Honeypot check
  if (rawInput.website && String(rawInput.website).trim().length > 0) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid form submission.');
  }

  const kind = String(rawInput.enquiry_kind || '').trim() as InsuranceEnquiryKind;
  if (kind !== 'information_request' && kind !== 'incident_report') {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      'Select either Request Insurance Information or Report an Incident.'
    );
  }

  const fullName = String(rawInput.full_name || '').trim();
  if (fullName.length < 2 || fullName.length > 120) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      'Please enter your full name (2 to 120 characters).'
    );
  }

  const email = String(rawInput.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      'Please enter a valid email address.'
    );
  }

  const phoneRaw = rawInput.phone ? String(rawInput.phone).trim() : '';
  if (phoneRaw && (phoneRaw.length > 40 || !/^[0-9+\-() \t]{6,40}$/.test(phoneRaw))) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      'Please enter a valid contact phone number.'
    );
  }

  const locationRaw = rawInput.project_location
    ? String(rawInput.project_location).trim()
    : '';
  if (locationRaw.length > 200) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      'Project address or suburb must be 200 characters or fewer.'
    );
  }

  const idempotencyKey = rawInput.idempotency_key
    ? String(rawInput.idempotency_key).trim().slice(0, 120)
    : null;
  if (idempotencyKey !== null && (idempotencyKey.length < 8 || /[^\w\-:.]/.test(idempotencyKey))) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid submission key.');
  }

  let requestType: InsuranceRequestType | null = null;
  let message: string | null = null;
  let incidentDate: string | null = null;
  let incidentCategory: IncidentCategory | null = null;
  let incidentDescription: string | null = null;
  let disclaimerAcknowledged = false;

  if (kind === 'information_request') {
    if (photos.length > 0) {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        'File attachments are only accepted on incident reports.'
      );
    }

    const reqType = String(rawInput.request_type || '').trim() as InsuranceRequestType;
    if (!(INSURANCE_REQUEST_TYPES as readonly string[]).includes(reqType)) {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        'Please select a valid insurance request type.'
      );
    }
    requestType = reqType;

    const msgRaw = rawInput.message ? String(rawInput.message).trim() : '';
    if (msgRaw.length > 3000) {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        'Message must be 3,000 characters or fewer.'
      );
    }
    message = msgRaw || null;
  } else {
    // Option B — Report an Incident
    if (!phoneRaw || phoneRaw.length < 6) {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        'A contact phone number is required when reporting an incident.'
      );
    }
    if (!locationRaw || locationRaw.length < 2) {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        'Project location or suburb is required when reporting an incident.'
      );
    }

    const incDate = String(rawInput.incident_date || '').trim();
    const today = getTodayUtcString();
    // Allow +1 day tolerance for Australian UTC+10:30 timezone vs UTC midnight
    const maxAllowedDate = new Date(Date.now() + 14 * 3600 * 1000).toISOString().slice(0, 10);
    if (!isValidCalendarDate(incDate) || incDate > maxAllowedDate || incDate < '2020-01-01') {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        `Please provide a valid incident date on or before today (${today}).`
      );
    }
    incidentDate = incDate;

    const cat = String(rawInput.incident_category || '').trim() as IncidentCategory;
    if (!(INCIDENT_CATEGORIES as readonly string[]).includes(cat)) {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        'Please select a valid incident category (Property damage, Injury, or Other).'
      );
    }
    incidentCategory = cat;

    const desc = String(rawInput.incident_description || '').trim();
    if (desc.length < 15 || desc.length > 4000) {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        'Please provide a brief factual description (at least 15 characters).'
      );
    }
    incidentDescription = desc;

    if (rawInput.disclaimer_acknowledged !== true) {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        'Please acknowledge the incident notification statement before submitting.'
      );
    }
    disclaimerAcknowledged = true;
  }

  // 2. Strictly validate supporting photographs in memory BEFORE database/storage writes
  if (photos.length > MAX_INCIDENT_PHOTOS) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      `You may attach at most ${MAX_INCIDENT_PHOTOS} supporting photographs.`
    );
  }

  let totalBytes = 0;
  const validatedPhotos: Array<{
    buffer: Buffer;
    detectedMime: string;
    sanitizedFilename: string;
    originalLabel: string;
  }> = [];

  for (const photo of photos) {
    totalBytes += photo.buffer.byteLength;
    if (totalBytes > MAX_TOTAL_INCIDENT_BYTES) {
      throw new EditorialHttpError(
        413,
        'PAYLOAD_TOO_LARGE',
        'Combined photograph size exceeds the 20 MB limit.'
      );
    }

    const validation = validateUploadFile(
      photo.buffer,
      photo.originalName,
      photo.mimeType,
      INCIDENT_PHOTO_ALLOWED_MIMES,
      MAX_INCIDENT_PHOTO_BYTES
    );

    if (!validation.valid || !validation.detectedType || !validation.sanitizedFilename) {
      throw new EditorialHttpError(
        400,
        'UNSUPPORTED_MEDIA_TYPE',
        validation.error ||
          'Supporting attachments must be valid JPEG, PNG, or WebP photographs (max 8 MB each).'
      );
    }

    validatedPhotos.push({
      buffer: photo.buffer,
      detectedMime: validation.detectedType,
      sanitizedFilename: validation.sanitizedFilename,
      originalLabel: sanitizeDisplayFilename(photo.originalName),
    });
  }

  if (!options?.clientOverride && !isServiceRoleConfigured()) {
    throw new EditorialHttpError(
      503,
      'INTERNAL_ERROR',
      'Enquiry service is temporarily unavailable. Please contact our Adelaide team on WhatsApp (+61 406 646 061).'
    );
  }

  const client = getClient(options?.clientOverride);

  // 3. Idempotency check
  if (idempotencyKey) {
    const { data: existing } = await client
      .from('insurance_enquiries')
      .select('id, reference_code, enquiry_kind, is_urgent, created_at')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existing) {
      const { count } = await client
        .from('insurance_incident_attachments')
        .select('id', { count: 'exact', head: true })
        .eq('enquiry_id', existing.id);

      return {
        id: existing.id as string,
        referenceCode: existing.reference_code as string,
        enquiryKind: existing.enquiry_kind as InsuranceEnquiryKind,
        isUrgent: Boolean(existing.is_urgent),
        attachmentCount: Number(count ?? 0),
        createdAt: existing.created_at as string,
        deduplicated: true,
      };
    }
  }

  const referenceCode = generateInsuranceReferenceCode(kind);
  const isUrgent = kind === 'incident_report' && incidentCategory === 'injury';

  const { data: inserted, error: insertErr } = await client
    .from('insurance_enquiries')
    .insert({
      reference_code: referenceCode,
      enquiry_kind: kind,
      status: 'new',
      is_urgent: isUrgent,
      full_name: fullName,
      email,
      phone: phoneRaw || null,
      project_location: locationRaw || null,
      request_type: requestType,
      message,
      incident_date: incidentDate,
      incident_category: incidentCategory,
      incident_description: incidentDescription,
      disclaimer_acknowledged: disclaimerAcknowledged,
      idempotency_key: idempotencyKey,
    })
    .select('id, reference_code, enquiry_kind, is_urgent, created_at')
    .single();

  if (insertErr || !inserted) {
    throw new EditorialHttpError(
      500,
      'INTERNAL_ERROR',
      'Unable to record insurance submission at this time.'
    );
  }

  const enquiryId = inserted.id as string;
  const uploadedPaths: string[] = [];

  // 4. Upload validated photographs into private `incident-attachments` bucket and bind rows
  if (validatedPhotos.length > 0) {
    const retentionUntil = new Date(
      Date.now() + INCIDENT_RETENTION_DAYS * 86_400_000
    ).toISOString();

    try {
      for (const photo of validatedPhotos) {
        const storagePath = `incidents/${enquiryId}/${photo.sanitizedFilename}`;
        const { error: upErr } = await client.storage
          .from('incident-attachments')
          .upload(storagePath, photo.buffer, {
            contentType: photo.detectedMime,
            upsert: false,
          });

        if (upErr) {
          throw new Error(`Storage upload failed: ${upErr.message}`);
        }
        uploadedPaths.push(storagePath);

        const { error: bindErr } = await client
          .from('insurance_incident_attachments')
          .insert({
            enquiry_id: enquiryId,
            bucket_id: 'incident-attachments',
            storage_path: storagePath,
            original_label: photo.originalLabel,
            mime_type: photo.detectedMime,
            byte_size: photo.buffer.byteLength,
            retention_until: retentionUntil,
          });

        if (bindErr) {
          throw new Error(`Attachment binding failed: ${bindErr.message}`);
        }
      }
    } catch (attErr) {
      // Atomic compensation: remove any uploaded files and roll back the enquiry row
      if (uploadedPaths.length > 0) {
        try {
          await client.storage.from('incident-attachments').remove(uploadedPaths);
        } catch {
          // Ignore cleanup errors during rollback
        }
      }
      try {
        await client.from('insurance_enquiries').delete().eq('id', enquiryId);
      } catch {
        // Ignore cleanup errors during rollback
      }
      console.error(
        '[CMS-Insurance] Incident photo persistence rolled back:',
        attErr instanceof Error ? attErr.message : 'Unknown error'
      );
      throw new EditorialHttpError(
        503,
        'STORAGE_ERROR',
        'Unable to securely store supporting photographs. Please retry without attachments or contact us directly.'
      );
    }
  }

  await recordEnquiryAuditEvent(client, {
    enquiryId,
    actorStaffId: null,
    action: 'created',
    toStatus: 'new',
    metadata: {
      enquiry_kind: kind,
      is_urgent: isUrgent,
      attachment_count: validatedPhotos.length,
    },
  });

  // 5. Non-blocking zero-PII Admin email alert
  if (!options?.skipEmailNotification) {
    const subCategoryLabel =
      kind === 'incident_report' && incidentCategory
        ? INCIDENT_CATEGORY_LABELS[incidentCategory]
        : requestType
          ? INSURANCE_REQUEST_TYPE_LABELS[requestType]
          : 'General';

    const emailPayload = buildAdminZeroPiiAlertEmail({
      referenceCode,
      enquiryKind: kind,
      subCategoryLabel,
      isUrgent,
      attachmentCount: validatedPhotos.length,
    });

    await sendNotificationEmail({
      subject: emailPayload.subject,
      html: emailPayload.html,
      idempotencyKey: `ins-enq:${enquiryId}`,
    }).catch(() => {});
  }

  return {
    id: enquiryId,
    referenceCode: inserted.reference_code as string,
    enquiryKind: inserted.enquiry_kind as InsuranceEnquiryKind,
    isUrgent: Boolean(inserted.is_urgent),
    attachmentCount: validatedPhotos.length,
    createdAt: inserted.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Admin Insurance Enquiries Workflow (Restricted to Admin Role)
// ---------------------------------------------------------------------------
export interface ListInsuranceEnquiriesFilter {
  search?: string;
  kind?: 'all' | 'information_request' | 'incident_report' | 'urgent';
  status?: 'all' | InsuranceEnquiryStatus;
}

export async function listAdminInsuranceEnquiries(
  staff: StaffProfile,
  filter: ListInsuranceEnquiriesFilter = {},
  clientOverride?: SupabaseClient
): Promise<{ items: InsuranceEnquirySummary[]; counts: InsuranceEnquiryCounts }> {
  assertInsurancePermission(staff, 'insurance:read');

  if (!clientOverride && !isCmsSupabaseConfigured()) {
    return {
      items: [],
      counts: {
        total: 0,
        openCount: 0,
        urgentOpenCount: 0,
        infoRequestCount: 0,
        incidentReportCount: 0,
      },
    };
  }

  const client = getClient(clientOverride);
  const { data: rowsData, error } = await client
    .from('insurance_enquiries')
    .select(
      'id, reference_code, enquiry_kind, status, is_urgent, full_name, email, phone, project_location, request_type, incident_date, incident_category, reviewed_at, closed_at, created_at, updated_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    // Graceful empty fallback if migration hasn't been applied in an isolated dev environment
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return {
        items: [],
        counts: {
          total: 0,
          openCount: 0,
          urgentOpenCount: 0,
          infoRequestCount: 0,
          incidentReportCount: 0,
        },
      };
    }
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', error.message);
  }

  const { data: attRows } = await client
    .from('insurance_incident_attachments')
    .select('enquiry_id');

  const attCountByEnquiry = new Map<string, number>();
  for (const r of (attRows ?? []) as Array<{ enquiry_id: string }>) {
    attCountByEnquiry.set(r.enquiry_id, (attCountByEnquiry.get(r.enquiry_id) ?? 0) + 1);
  }

  const allItems: InsuranceEnquirySummary[] = ((rowsData ?? []) as Array<Record<string, unknown>>).map(
    (row) => ({
      id: String(row.id),
      reference_code: String(row.reference_code),
      enquiry_kind: row.enquiry_kind as InsuranceEnquiryKind,
      status: row.status as InsuranceEnquiryStatus,
      is_urgent: Boolean(row.is_urgent),
      full_name: String(row.full_name),
      email: String(row.email),
      phone: (row.phone as string | null) ?? null,
      project_location: (row.project_location as string | null) ?? null,
      request_type: (row.request_type as InsuranceRequestType | null) ?? null,
      incident_date: (row.incident_date as string | null) ?? null,
      incident_category: (row.incident_category as IncidentCategory | null) ?? null,
      reviewed_at: (row.reviewed_at as string | null) ?? null,
      closed_at: (row.closed_at as string | null) ?? null,
      attachment_count: attCountByEnquiry.get(String(row.id)) ?? 0,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    })
  );

  const counts: InsuranceEnquiryCounts = {
    total: allItems.length,
    openCount: allItems.filter((i) => i.status !== 'closed').length,
    urgentOpenCount: allItems.filter(
      (i) => i.status !== 'closed' && (i.is_urgent || (i.enquiry_kind === 'incident_report' && i.status === 'new'))
    ).length,
    infoRequestCount: allItems.filter((i) => i.enquiry_kind === 'information_request').length,
    incidentReportCount: allItems.filter((i) => i.enquiry_kind === 'incident_report').length,
  };

  const q = (filter.search ?? '').trim().toLowerCase();
  const filtered = allItems.filter((item) => {
    if (filter.kind === 'information_request' && item.enquiry_kind !== 'information_request') {
      return false;
    }
    if (filter.kind === 'incident_report' && item.enquiry_kind !== 'incident_report') {
      return false;
    }
    if (filter.kind === 'urgent' && !item.is_urgent) {
      return false;
    }
    if (filter.status && filter.status !== 'all' && item.status !== filter.status) {
      return false;
    }
    if (!q) return true;
    return [
      item.reference_code,
      item.full_name,
      item.email,
      item.phone ?? '',
      item.project_location ?? '',
      item.status,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  return { items: filtered, counts };
}

export async function getAdminInsuranceEnquiryDetail(
  staff: StaffProfile,
  enquiryId: string,
  clientOverride?: SupabaseClient
): Promise<InsuranceEnquiryDetail> {
  assertInsurancePermission(staff, 'insurance:read');
  const client = getClient(clientOverride);

  const { data: row, error } = await client
    .from('insurance_enquiries')
    .select('*')
    .eq('id', enquiryId)
    .maybeSingle();

  if (error || !row) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Insurance enquiry record not found.');
  }

  const [{ data: attData }, { data: auditData }] = await Promise.all([
    client
      .from('insurance_incident_attachments')
      .select('id, original_label, mime_type, byte_size, retention_until, created_at')
      .eq('enquiry_id', enquiryId)
      .order('created_at', { ascending: true }),
    client
      .from('insurance_enquiry_audit_log')
      .select('id, enquiry_id, actor_staff_id, action, from_status, to_status, metadata, created_at')
      .eq('enquiry_id', enquiryId)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const attachments = ((attData ?? []) as InsuranceIncidentAttachmentSummary[]);
  const audit_log = ((auditData ?? []) as InsuranceEnquiryAuditEvent[]);

  return {
    id: String(row.id),
    reference_code: String(row.reference_code),
    enquiry_kind: row.enquiry_kind as InsuranceEnquiryKind,
    status: row.status as InsuranceEnquiryStatus,
    is_urgent: Boolean(row.is_urgent),
    full_name: String(row.full_name),
    email: String(row.email),
    phone: (row.phone as string | null) ?? null,
    project_location: (row.project_location as string | null) ?? null,
    request_type: (row.request_type as InsuranceRequestType | null) ?? null,
    message: (row.message as string | null) ?? null,
    incident_date: (row.incident_date as string | null) ?? null,
    incident_category: (row.incident_category as IncidentCategory | null) ?? null,
    incident_description: (row.incident_description as string | null) ?? null,
    disclaimer_acknowledged: Boolean(row.disclaimer_acknowledged),
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    reviewed_by: (row.reviewed_by as string | null) ?? null,
    internal_notes: (row.internal_notes as string | null) ?? null,
    follow_up_actions: (row.follow_up_actions as string | null) ?? null,
    closed_at: (row.closed_at as string | null) ?? null,
    closed_by: (row.closed_by as string | null) ?? null,
    attachment_count: attachments.length,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    attachments,
    audit_log,
  };
}

export interface UpdateAdminInsuranceEnquiryPatch {
  status?: InsuranceEnquiryStatus;
  mark_reviewed?: boolean;
  is_urgent?: boolean;
  internal_notes?: string | null;
  follow_up_actions?: string | null;
}

export async function updateAdminInsuranceEnquiry(
  staff: StaffProfile,
  enquiryId: string,
  patch: UpdateAdminInsuranceEnquiryPatch,
  clientOverride?: SupabaseClient
): Promise<InsuranceEnquiryDetail> {
  assertInsurancePermission(staff, 'insurance:manage');
  const client = getClient(clientOverride);

  const { data: existing, error: selErr } = await client
    .from('insurance_enquiries')
    .select('*')
    .eq('id', enquiryId)
    .maybeSingle();

  if (selErr || !existing) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Insurance enquiry record not found.');
  }

  const prevStatus = existing.status as InsuranceEnquiryStatus;
  let nextStatus = prevStatus;

  if (patch.status !== undefined) {
    if (!(INSURANCE_ENQUIRY_STATUSES as readonly string[]).includes(patch.status)) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid enquiry workflow status.');
    }
    nextStatus = patch.status;
  } else if (patch.mark_reviewed && prevStatus === 'new') {
    nextStatus = 'under_review';
  }

  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    updated_at: nowIso,
  };

  if (patch.mark_reviewed || (prevStatus === 'new' && nextStatus !== 'new' && !existing.reviewed_at)) {
    updatePayload.reviewed_at = existing.reviewed_at || nowIso;
    updatePayload.reviewed_by = existing.reviewed_by || staff.id;
  }

  if (nextStatus === 'closed') {
    updatePayload.closed_at = existing.closed_at || nowIso;
    updatePayload.closed_by = existing.closed_by || staff.id;
  } else if (prevStatus === 'closed') {
    updatePayload.closed_at = null;
    updatePayload.closed_by = null;
  }

  if (typeof patch.is_urgent === 'boolean') {
    updatePayload.is_urgent = patch.is_urgent;
  }

  if (patch.internal_notes !== undefined) {
    const notes = patch.internal_notes ? String(patch.internal_notes).trim() : '';
    if (notes.length > 5000) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Internal notes must be 5,000 characters or fewer.');
    }
    updatePayload.internal_notes = notes || null;
  }

  if (patch.follow_up_actions !== undefined) {
    const actions = patch.follow_up_actions ? String(patch.follow_up_actions).trim() : '';
    if (actions.length > 5000) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Follow-up actions must be 5,000 characters or fewer.');
    }
    updatePayload.follow_up_actions = actions || null;
  }

  const { error: updErr } = await client
    .from('insurance_enquiries')
    .update(updatePayload)
    .eq('id', enquiryId);

  if (updErr) {
    throw new EditorialHttpError(500, 'INTERNAL_ERROR', updErr.message);
  }

  // Record granular audit trail
  if (patch.mark_reviewed) {
    await recordEnquiryAuditEvent(client, {
      enquiryId,
      actorStaffId: staff.id,
      action: 'marked_reviewed',
      fromStatus: prevStatus,
      toStatus: nextStatus,
    });
  } else if (nextStatus !== prevStatus) {
    await recordEnquiryAuditEvent(client, {
      enquiryId,
      actorStaffId: staff.id,
      action: nextStatus === 'closed' ? 'closed' : 'status_changed',
      fromStatus: prevStatus,
      toStatus: nextStatus,
    });
  }

  if (typeof patch.is_urgent === 'boolean' && patch.is_urgent !== Boolean(existing.is_urgent)) {
    await recordEnquiryAuditEvent(client, {
      enquiryId,
      actorStaffId: staff.id,
      action: 'urgent_toggled',
      metadata: { is_urgent: patch.is_urgent },
    });
  }

  if (patch.internal_notes !== undefined || patch.follow_up_actions !== undefined) {
    await recordEnquiryAuditEvent(client, {
      enquiryId,
      actorStaffId: staff.id,
      action: 'notes_updated',
      metadata: {
        updated_internal_notes: patch.internal_notes !== undefined,
        updated_follow_up_actions: patch.follow_up_actions !== undefined,
      },
    });
  }

  return getAdminInsuranceEnquiryDetail(staff, enquiryId, client);
}

export async function downloadAdminIncidentAttachment(
  staff: StaffProfile,
  attachmentId: string,
  clientOverride?: SupabaseClient
): Promise<{ bytes: Uint8Array; mimeType: string; fileName: string }> {
  assertInsurancePermission(staff, 'insurance:read');
  const client = getClient(clientOverride);

  const { data: att, error: selErr } = await client
    .from('insurance_incident_attachments')
    .select('id, enquiry_id, bucket_id, storage_path, original_label, mime_type')
    .eq('id', attachmentId)
    .maybeSingle();

  if (selErr || !att) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Incident attachment not found.');
  }

  const storagePath = String(att.storage_path);
  if (!storagePath || storagePath.includes('..')) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid storage path.');
  }

  const { data: blob, error: dlErr } = await client.storage
    .from(String(att.bucket_id || 'incident-attachments'))
    .download(storagePath);

  if (dlErr || !blob) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Attachment file unavailable in private storage.');
  }

  await recordEnquiryAuditEvent(client, {
    enquiryId: String(att.enquiry_id),
    actorStaffId: staff.id,
    action: 'attachment_downloaded',
    metadata: { attachment_id: attachmentId },
  });

  const arrayBuf = await blob.arrayBuffer();
  return {
    bytes: new Uint8Array(arrayBuf),
    mimeType: String(att.mime_type || 'image/jpeg'),
    fileName: sanitizeDisplayFilename(String(att.original_label || 'incident-photo.jpg')),
  };
}

function escapeCsvCell(raw: string | number | boolean | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Prevent spreadsheet formula injection (=, +, -, @, tab)
  if (/^[=+\-@\t]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportAdminInsuranceEnquiriesCsv(
  staff: StaffProfile,
  filter: ListInsuranceEnquiriesFilter = {},
  clientOverride?: SupabaseClient
): Promise<{ csv: string; filename: string; rowCount: number }> {
  assertInsurancePermission(staff, 'insurance:export');
  const client = getClient(clientOverride);

  const { items } = await listAdminInsuranceEnquiries(staff, filter, client);
  const ids = items.map((i) => i.id);

  let detailMap = new Map<string, Record<string, unknown>>();
  if (ids.length > 0) {
    const { data: fullRows } = await client
      .from('insurance_enquiries')
      .select('*')
      .in('id', ids);
    detailMap = new Map(((fullRows ?? []) as Array<Record<string, unknown>>).map((r) => [String(r.id), r]));
  }

  const headers = [
    'reference_code',
    'enquiry_kind',
    'status',
    'is_urgent',
    'created_at',
    'full_name',
    'email',
    'phone',
    'project_location',
    'request_type',
    'message',
    'incident_date',
    'incident_category',
    'incident_description',
    'attachment_count',
    'reviewed_at',
    'internal_notes',
    'follow_up_actions',
    'closed_at',
  ];

  const lines = [headers.join(',')];
  for (const summary of items) {
    const full = detailMap.get(summary.id) ?? {};
    lines.push(
      [
        escapeCsvCell(summary.reference_code),
        escapeCsvCell(summary.enquiry_kind),
        escapeCsvCell(summary.status),
        escapeCsvCell(summary.is_urgent ? 'yes' : 'no'),
        escapeCsvCell(summary.created_at),
        escapeCsvCell(summary.full_name),
        escapeCsvCell(summary.email),
        escapeCsvCell(summary.phone),
        escapeCsvCell(summary.project_location),
        escapeCsvCell(summary.request_type),
        escapeCsvCell((full.message as string | null) ?? ''),
        escapeCsvCell(summary.incident_date),
        escapeCsvCell(summary.incident_category),
        escapeCsvCell((full.incident_description as string | null) ?? ''),
        escapeCsvCell(summary.attachment_count),
        escapeCsvCell(summary.reviewed_at),
        escapeCsvCell((full.internal_notes as string | null) ?? ''),
        escapeCsvCell((full.follow_up_actions as string | null) ?? ''),
        escapeCsvCell(summary.closed_at),
      ].join(',')
    );
  }

  await recordEnquiryAuditEvent(client, {
    enquiryId: null,
    actorStaffId: staff.id,
    action: 'exported',
    metadata: { row_count: items.length, filter_kind: filter.kind ?? 'all', filter_status: filter.status ?? 'all' },
  });

  const filename = `strovyn-insurance-enquiries-${getTodayUtcString()}.csv`;
  return {
    csv: lines.join('\r\n'),
    filename,
    rowCount: items.length,
  };
}

// ---------------------------------------------------------------------------
// Policy & Certificate Governance (Compatible with Existing Compliance Module)
// ---------------------------------------------------------------------------
export async function getPublicInsuranceStatus(
  clientOverride?: SupabaseClient
): Promise<PublicInsuranceStatus> {
  if (!clientOverride && !isCmsSupabaseConfigured()) {
    return { isPublished: false };
  }

  try {
    const supabase = getClient(clientOverride);
    const { data, error } = await supabase
      .from('public_liability_insurance')
      .select('is_published, public_statement, policy_expiry_date, verified_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data || !data.is_published) {
      return { isPublished: false };
    }

    const today = getTodayUtcString();
    if (String(data.policy_expiry_date) < today) {
      return { isPublished: false };
    }

    return {
      isPublished: true,
      statement: String(data.public_statement || APPROVED_PUBLIC_STATEMENT),
      lastVerified: String(data.verified_at || data.updated_at),
    };
  } catch {
    return { isPublished: false };
  }
}

export async function getAdminInsuranceRecord(
  staff: StaffProfile,
  clientOverride?: SupabaseClient
): Promise<InsuranceRecord | null> {
  assertInsurancePermission(staff, 'insurance:read');

  if (!clientOverride && !isCmsSupabaseConfigured()) {
    return null;
  }

  const supabase = getClient(clientOverride);
  const { data, error } = await supabase
    .from('public_liability_insurance')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const today = getTodayUtcString();
  return {
    ...(data as Omit<InsuranceRecord, 'coverage_limit_aud' | 'is_expired'>),
    coverage_limit_aud: Number(data.coverage_limit_aud),
    is_expired: String(data.policy_expiry_date) < today,
  };
}

export async function getAdminInsuranceWorkspaceSnapshot(
  staff: StaffProfile,
  clientOverride?: SupabaseClient
): Promise<AdminInsuranceWorkspaceSnapshot> {
  assertInsurancePermission(staff, 'insurance:read');
  const [{ items, counts }, policyRecord] = await Promise.all([
    listAdminInsuranceEnquiries(staff, {}, clientOverride),
    getAdminInsuranceRecord(staff, clientOverride),
  ]);

  return {
    enquiries: items,
    counts,
    policyRecord,
  };
}

export async function saveAdminInsuranceRecord(
  staff: StaffProfile,
  input: UpdateInsuranceInput,
  clientOverride?: SupabaseClient
): Promise<InsuranceRecord> {
  assertInsurancePermission(staff, 'insurance:manage');

  const provider_name = (input.provider_name || '').trim();
  const named_insured = (input.named_insured || '').trim();
  const policy_number = (input.policy_number || '').trim();
  const coverage_limit_aud = Number(input.coverage_limit_aud) || 0;
  const policy_commencement_date = (input.policy_commencement_date || '').trim();
  const policy_expiry_date = (input.policy_expiry_date || '').trim();
  const certificate_storage_path = input.certificate_storage_path
    ? input.certificate_storage_path.trim()
    : null;
  const exclusions_summary = input.exclusions_summary ? input.exclusions_summary.trim() : null;
  const public_statement = (input.public_statement || APPROVED_PUBLIC_STATEMENT).trim();
  const is_published = Boolean(input.is_published);

  if (!isValidCalendarDate(policy_commencement_date)) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      'Valid commencement date (YYYY-MM-DD) is required.'
    );
  }
  if (!isValidCalendarDate(policy_expiry_date)) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      'Valid expiry date (YYYY-MM-DD) is required.'
    );
  }
  if (policy_expiry_date < policy_commencement_date) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      'Policy expiry date cannot precede commencement date.'
    );
  }

  const today = getTodayUtcString();
  if (is_published) {
    if (!provider_name) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Insurer / provider name is required to publish.');
    }
    if (!named_insured) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Named insured is required to publish.');
    }
    if (!policy_number) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Policy number is required to publish.');
    }
    if (coverage_limit_aud <= 0) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Coverage limit must be greater than $0 AUD.');
    }
    if (!certificate_storage_path) {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        'A verified Certificate of Currency document must be uploaded before publishing.'
      );
    }
    if (policy_expiry_date < today) {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        `Cannot publish an expired insurance policy (expired on ${policy_expiry_date}).`
      );
    }
  }

  const supabase = getClient(clientOverride);
  const { data: existing } = await supabase
    .from('public_liability_insurance')
    .select('id, created_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const recordPayload = {
    provider_name,
    named_insured,
    policy_number,
    coverage_limit_aud,
    policy_commencement_date,
    policy_expiry_date,
    certificate_storage_path,
    exclusions_summary,
    public_statement: public_statement || APPROVED_PUBLIC_STATEMENT,
    is_published,
    verified_at: is_published ? nowIso : null,
    verified_by: is_published ? staff.id : null,
    updated_at: nowIso,
  };

  let savedId = existing?.id as string | undefined;
  let createdAt = (existing?.created_at as string | undefined) ?? nowIso;

  if (savedId) {
    const { error: updateError } = await supabase
      .from('public_liability_insurance')
      .update(recordPayload)
      .eq('id', savedId);

    if (updateError) {
      throw new EditorialHttpError(
        500,
        'INTERNAL_ERROR',
        `Failed to update insurance policy record: ${updateError.message}`
      );
    }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('public_liability_insurance')
      .insert({
        ...recordPayload,
        created_at: nowIso,
      })
      .select('id, created_at')
      .single();

    if (insertError || !inserted) {
      throw new EditorialHttpError(
        500,
        'INTERNAL_ERROR',
        `Failed to insert insurance policy record: ${insertError?.message}`
      );
    }
    savedId = String(inserted.id);
    createdAt = String(inserted.created_at);
  }

  return {
    id: savedId,
    ...recordPayload,
    created_at: createdAt,
    is_expired: policy_expiry_date < today,
  };
}

export async function uploadComplianceCertificate(
  staff: StaffProfile,
  file: { buffer: Buffer; fileName: string; mimeType: string },
  clientOverride?: SupabaseClient
): Promise<{ storagePath: string; fileName: string }> {
  assertInsurancePermission(staff, 'insurance:manage');

  const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  const validation = validateUploadFile(
    file.buffer,
    file.fileName,
    file.mimeType,
    allowedMimes,
    15 * 1024 * 1024
  );

  if (!validation.valid || !validation.detectedType || !validation.sanitizedFilename) {
    throw new EditorialHttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      validation.error || 'Certificate must be a valid PDF, JPEG, PNG, or WebP file (max 15 MiB).'
    );
  }

  const storagePath = `certificates/${validation.sanitizedFilename}`;
  const supabase = getClient(clientOverride);
  const { error } = await supabase.storage
    .from('compliance-documents')
    .upload(storagePath, file.buffer, {
      contentType: validation.detectedType,
      upsert: false,
    });

  if (error) {
    throw new EditorialHttpError(
      500,
      'STORAGE_ERROR',
      `Failed to upload certificate document: ${error.message}`
    );
  }

  return { storagePath, fileName: sanitizeDisplayFilename(file.fileName) };
}

export async function downloadComplianceCertificate(
  staff: StaffProfile,
  storagePath: string,
  clientOverride?: SupabaseClient
): Promise<{ bytes: Uint8Array; mimeType: string; fileName: string }> {
  assertInsurancePermission(staff, 'insurance:read');

  if (!storagePath || storagePath.includes('..')) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid certificate storage path.');
  }

  const supabase = getClient(clientOverride);
  const { data, error } = await supabase.storage
    .from('compliance-documents')
    .download(storagePath);

  if (error || !data) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Compliance certificate document not found.');
  }

  const buffer = await data.arrayBuffer();
  const fileName = storagePath.split('/').pop() || 'certificate.pdf';
  const mimeType = data.type || 'application/pdf';

  return {
    bytes: new Uint8Array(buffer),
    mimeType,
    fileName,
  };
}
