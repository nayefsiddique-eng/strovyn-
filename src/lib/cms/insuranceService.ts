import 'server-only';
import { createServiceRoleClient, isCmsSupabaseConfigured } from '@/lib/supabase/serviceRole';
import { hasEditorialPermission } from './rbac';
import { EditorialHttpError } from './http';
import type { StaffProfile } from './roles';
import {
  APPROVED_PUBLIC_STATEMENT,
  type InsuranceRecord,
  type PublicInsuranceStatus,
  type UpdateInsuranceInput,
} from './insuranceTypes';

export * from './insuranceTypes';

function getTodayUtcString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Public query for website visitors.
 * Strictly guarantees:
 * 1. Returns { isPublished: false } if unconfigured, missing table, unverified, unpublished, or expired.
 * 2. NEVER leaks policy number, provider name, named insured, certificate paths, or coverage amounts.
 */
export async function getPublicInsuranceStatus(): Promise<PublicInsuranceStatus> {
  if (!isCmsSupabaseConfigured()) {
    return { isPublished: false };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('public_liability_insurance')
      .select('is_published, public_statement, policy_expiry_date, verified_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return { isPublished: false };
    }

    if (!data.is_published) {
      return { isPublished: false };
    }

    const today = getTodayUtcString();
    if (data.policy_expiry_date < today) {
      // Auto-suppress public section if policy has lapsed or expired
      return { isPublished: false };
    }

    return {
      isPublished: true,
      statement: data.public_statement || APPROVED_PUBLIC_STATEMENT,
      lastVerified: data.verified_at || data.updated_at,
    };
  } catch {
    return { isPublished: false };
  }
}

/**
 * Admin query for compliance review. Restricted to admin role.
 */
export async function getAdminInsuranceRecord(
  staff: StaffProfile
): Promise<InsuranceRecord | null> {
  if (!hasEditorialPermission(staff.role, 'insurance:read')) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      `Role "${staff.role}" is not authorized to inspect insurance compliance records.`
    );
  }

  if (!isCmsSupabaseConfigured()) {
    return null;
  }

  const supabase = createServiceRoleClient();
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
  const is_expired = data.policy_expiry_date < today;

  return {
    ...data,
    coverage_limit_aud: Number(data.coverage_limit_aud),
    is_expired,
  };
}

/**
 * Admin update for public liability insurance credentials.
 * Enforces rigorous verification rules before publishing:
 * - Requires non-empty provider, named insured, and policy number
 * - Requires coverage limit AUD > 0
 * - Requires valid commencement and expiry dates (commencement <= expiry)
 * - Requires policy to NOT be expired if publishing
 * - Requires an uploaded Certificate of Currency if publishing
 */
export async function saveAdminInsuranceRecord(
  staff: StaffProfile,
  input: UpdateInsuranceInput
): Promise<InsuranceRecord> {
  if (!hasEditorialPermission(staff.role, 'insurance:manage')) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      `Role "${staff.role}" is not authorized to modify insurance compliance records.`
    );
  }

  const provider_name = (input.provider_name || '').trim();
  const named_insured = (input.named_insured || '').trim();
  const policy_number = (input.policy_number || '').trim();
  const coverage_limit_aud = Number(input.coverage_limit_aud) || 0;
  const policy_commencement_date = (input.policy_commencement_date || '').trim();
  const policy_expiry_date = (input.policy_expiry_date || '').trim();
  const certificate_storage_path = input.certificate_storage_path ? input.certificate_storage_path.trim() : null;
  const exclusions_summary = input.exclusions_summary ? input.exclusions_summary.trim() : null;
  const public_statement = (input.public_statement || APPROVED_PUBLIC_STATEMENT).trim();
  const is_published = Boolean(input.is_published);

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(policy_commencement_date)) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Valid commencement date (YYYY-MM-DD) is required.');
  }
  if (!dateRegex.test(policy_expiry_date)) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Valid expiry date (YYYY-MM-DD) is required.');
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

  const supabase = createServiceRoleClient();

  // Find existing record
  const { data: existing } = await supabase
    .from('public_liability_insurance')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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
    verified_at: is_published ? new Date().toISOString() : null,
    verified_by: is_published ? staff.id : null,
    updated_at: new Date().toISOString(),
  };

  let savedId = existing?.id;

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('public_liability_insurance')
      .update(recordPayload)
      .eq('id', existing.id);

    if (updateError) {
      throw new EditorialHttpError(500, 'INTERNAL_ERROR', `Failed to update insurance record: ${updateError.message}`);
    }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('public_liability_insurance')
      .insert({
        ...recordPayload,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      throw new EditorialHttpError(500, 'INTERNAL_ERROR', `Failed to insert insurance record: ${insertError?.message}`);
    }
    savedId = inserted.id;
  }

  const is_expired = policy_expiry_date < today;

  return {
    id: savedId!,
    ...recordPayload,
    created_at: new Date().toISOString(),
    is_expired,
  };
}

/**
 * Uploads a Certificate of Currency document to the private compliance-documents bucket.
 */
export async function uploadComplianceCertificate(
  staff: StaffProfile,
  file: { buffer: Buffer; fileName: string; mimeType: string }
): Promise<{ storagePath: string; fileName: string }> {
  if (!hasEditorialPermission(staff.role, 'insurance:manage')) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      `Role "${staff.role}" is not authorized to upload compliance certificates.`
    );
  }

  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(file.mimeType)) {
    throw new EditorialHttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Certificate must be a PDF document or image (PDF, JPG, PNG, WebP).'
    );
  }

  const maxBytes = 15 * 1024 * 1024;
  if (file.buffer.byteLength > maxBytes) {
    throw new EditorialHttpError(
      413,
      'PAYLOAD_TOO_LARGE',
      'Certificate file exceeds maximum limit of 15 MiB.'
    );
  }

  const ext = file.fileName.split('.').pop()?.toLowerCase() || 'pdf';
  const cleanExt = ['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'pdf';
  const timestamp = Date.now();
  const safeBase = file.fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 32);
  const storagePath = `certificates/${timestamp}-${safeBase}.${cleanExt}`;

  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage
    .from('compliance-documents')
    .upload(storagePath, file.buffer, {
      contentType: file.mimeType,
      upsert: false,
    });

  if (error) {
    throw new EditorialHttpError(
      500,
      'STORAGE_ERROR',
      `Failed to upload certificate document: ${error.message}`
    );
  }

  return { storagePath, fileName: file.fileName };
}

/**
 * Downloads a Certificate of Currency document from private storage. Restricted to admin.
 */
export async function downloadComplianceCertificate(
  staff: StaffProfile,
  storagePath: string
): Promise<{ bytes: Uint8Array; mimeType: string; fileName: string }> {
  if (!hasEditorialPermission(staff.role, 'insurance:read')) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      `Role "${staff.role}" is not authorized to download compliance certificates.`
    );
  }

  if (!storagePath || storagePath.includes('..')) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid certificate storage path.');
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from('compliance-documents')
    .download(storagePath);

  if (error || !data) {
    throw new EditorialHttpError(
      404,
      'NOT_FOUND',
      'Compliance certificate document not found.'
    );
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
