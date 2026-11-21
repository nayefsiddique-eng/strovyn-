import 'server-only';
import fs from 'fs';
import path from 'path';
import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from '@/lib/supabase/serviceRole';

export interface DBQuote {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  projectLocation: string;
  serviceRequired: string;
  propertyType?: string;
  description: string;
  preferredContact: string;
  attachmentUrl?: string;
  status: 'pending' | 'reviewed' | 'quoted' | 'closed';
  adminNotes?: string;
  createdAt: string;
}

export interface DBApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  yearsOfExperience: string;
  portfolioUrl?: string;
  coverLetter?: string;
  resumeUrl?: string;
  status: 'pending' | 'reviewing' | 'interviewed' | 'rejected' | 'hired';
  adminNotes?: string;
  createdAt: string;
}

export interface DBFeedback {
  id: string;
  customerName: string;
  email?: string;
  projectReference?: string;
  rating: number;
  message: string;
  permissionToPublish: boolean;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface DBProject {
  id: string;
  slug: string;
  title: string;
  category: string;
  lifecycle: string;
  location: string;
  year: string;
  architect: string;
  builder: string;
  heroImage: string;
  finishes: string;
  description: string;
  createdAt: string;
}

export interface DBArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  readTime: string;
  date: string;
  author: string;
  coverImage: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataFile<T>(filename: string, defaultData: T[]): T[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return defaultData;
  }
}

function writeDataFile<T>(filename: string, data: T[]) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Check if live Supabase instance is configured with non-placeholder values
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      url.startsWith('https://') &&
      !url.includes('placeholder') &&
      !key.includes('placeholder')
  );
}

export class AttachmentClaimError extends Error {
  readonly status: 400 | 404 | 409 | 422 | 503;

  constructor(status: 400 | 404 | 409 | 422 | 503, message: string) {
    super(message);
    this.name = 'AttachmentClaimError';
    this.status = status;
  }
}

function hashClaimToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

const LOCAL_UPLOAD_CLAIMS_FILE = path.join(
  process.cwd(),
  'private_storage',
  'security',
  'upload_claims.json'
);

interface LocalUploadClaim {
  fileReference: string;
  category: 'documents' | 'resumes';
  claimTokenHash: string;
  claimedByTable: string | null;
  claimedRecordId: string | null;
  expiresAt: string;
}

const CUSTOMER_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;

function readLocalUploadClaims(): LocalUploadClaim[] {
  try {
    if (!fs.existsSync(LOCAL_UPLOAD_CLAIMS_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(LOCAL_UPLOAD_CLAIMS_FILE, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalUploadClaims(claims: LocalUploadClaim[]): void {
  const dir = path.dirname(LOCAL_UPLOAD_CLAIMS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(LOCAL_UPLOAD_CLAIMS_FILE, JSON.stringify(claims, null, 2), 'utf-8');
}

/**
 * Registers a newly uploaded private customer document and returns a random
 * one-time claim token that binds the file to a single submission.
 */
export async function registerCustomerDocumentUpload(params: {
  category: 'documents' | 'resumes';
  storagePath: string;
  fileReference: string;
  mimeType: string;
  byteSize: number;
}): Promise<{ ok: true; uploadToken: string } | { ok: false; error: unknown }> {
  const uploadToken = randomBytes(24).toString('hex');
  const claimTokenHash = hashClaimToken(uploadToken);
  const expiresAt = new Date(Date.now() + CUSTOMER_UPLOAD_TTL_MS).toISOString();

  if (isServiceRoleConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { error } = await supabase.from('customer_document_uploads').insert({
        bucket_id: 'customer-documents',
        category: params.category,
        storage_path: params.storagePath,
        file_reference: params.fileReference,
        mime_type: params.mimeType,
        byte_size: params.byteSize,
        claim_token_hash: claimTokenHash,
        expires_at: expiresAt,
        cleanup_state: 'active',
      });
      if (error) {
        return { ok: false, error };
      }
      return { ok: true, uploadToken };
    } catch (error) {
      return { ok: false, error };
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return { ok: false, error: new Error('Supabase service role is required in production.') };
  }

  const claims = readLocalUploadClaims();
  claims.push({
    fileReference: params.fileReference,
    category: params.category,
    claimTokenHash,
    claimedByTable: null,
    claimedRecordId: null,
    expiresAt,
  });
  writeLocalUploadClaims(claims);
  return { ok: true, uploadToken };
}

function prepareSupabaseAttachmentParams(params: {
  fileReference?: string;
  claimToken?: string;
  expectedCategory: 'documents' | 'resumes';
}): { fileReference: string | null; claimTokenHash: string | null } {
  if (!params.fileReference) {
    return { fileReference: null, claimTokenHash: null };
  }
  const expectedPrefix = `supabase://customer-documents/${params.expectedCategory}/`;
  if (!params.fileReference.startsWith(expectedPrefix)) {
    throw new AttachmentClaimError(400, 'Invalid attachment reference category.');
  }
  if (!params.claimToken || params.claimToken.trim().length < 32) {
    throw new AttachmentClaimError(400, 'Missing or invalid attachment verification token.');
  }
  return {
    fileReference: params.fileReference,
    claimTokenHash: hashClaimToken(params.claimToken),
  };
}

function mapAtomicSubmissionRpcError(error: unknown): never {
  const errObj = error as { message?: unknown; details?: unknown } | null;
  const raw = `${String(errObj?.message || '')} ${String(errObj?.details || '')}`.trim();

  if (raw.includes('ATTACHMENT_IDEMPOTENCY_MISMATCH:')) {
    throw new AttachmentClaimError(
      409,
      'This idempotency key has already been used with a different submission payload.'
    );
  }
  if (raw.includes('ATTACHMENT_EXPIRED:')) {
    throw new AttachmentClaimError(
      400,
      'Attachment upload window has expired. Please upload the document again.'
    );
  }
  if (raw.includes('ATTACHMENT_CLEANED_UP:')) {
    throw new AttachmentClaimError(
      400,
      'Attachment upload is no longer available. Please upload the document again.'
    );
  }
  if (
    raw.includes('ATTACHMENT_WRONG_CATEGORY:') ||
    raw.includes('ATTACHMENT_TOKEN_INVALID:') ||
    raw.includes('ATTACHMENT_NOT_FOUND:') ||
    raw.includes('ATTACHMENT_UNAUTHORIZED:') ||
    raw.includes('ATTACHMENT_ALREADY_CLAIMED:')
  ) {
    throw new AttachmentClaimError(
      400,
      'Attachment reference is invalid, unauthorized, or already attached to another submission.'
    );
  }
  if (raw.includes('VACANCY_NOT_FOUND:')) {
    throw new AttachmentClaimError(404, 'Selected vacancy does not exist.');
  }
  if (raw.includes('VACANCY_CLOSED:')) {
    throw new AttachmentClaimError(
      422,
      'This vacancy is closed and no longer accepting applications.'
    );
  }
  if (raw.includes('VACANCY_DEADLINE_PASSED:')) {
    throw new AttachmentClaimError(
      422,
      'The application deadline for this vacancy has passed.'
    );
  }

  throw error instanceof Error ? error : new Error(raw || 'Atomic submission failed');
}

export interface CustomerUploadCleanupSummary {
  ok: boolean;
  skipped?: boolean;
  reserved: number;
  deleted: number;
  failed: number;
  errors: Array<{ id: string; storagePath: string; message: string }>;
}

/**
 * Reserves expired, unclaimed customer uploads via `cms_reserve_expired_customer_uploads`,
 * removes their Storage objects, and updates cleanup tracking state. Bound submissions and
 * grace-window rows are skipped inside PostgreSQL.
 */
export async function cleanupExpiredCustomerDocumentUploads(options?: {
  graceSeconds?: number;
  limit?: number;
}): Promise<CustomerUploadCleanupSummary> {
  const graceSeconds = Math.max(0, Math.floor(options?.graceSeconds ?? 900));
  const limit = Math.min(500, Math.max(1, Math.floor(options?.limit ?? 50)));

  if (!isServiceRoleConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        reserved: 0,
        deleted: 0,
        failed: 0,
        errors: [{ id: '', storagePath: '', message: 'Supabase service role is required.' }],
      };
    }
    const cutoff = Date.now() - graceSeconds * 1000;
    const claims = readLocalUploadClaims();
    const kept = claims.filter((c) => {
      if (c.claimedRecordId !== null) return true;
      const exp = c.expiresAt ? new Date(c.expiresAt).getTime() : 0;
      return exp >= cutoff;
    });
    const pruned = claims.length - kept.length;
    if (pruned > 0) {
      writeLocalUploadClaims(kept);
    }
    return { ok: true, skipped: true, reserved: pruned, deleted: pruned, failed: 0, errors: [] };
  }

  const supabase = createServiceRoleClient();
  const { data: reservedRows, error: reserveErr } = await supabase.rpc(
    'cms_reserve_expired_customer_uploads',
    {
      p_limit: limit,
      p_grace_seconds: graceSeconds,
    }
  );

  if (reserveErr) {
    return {
      ok: false,
      reserved: 0,
      deleted: 0,
      failed: 0,
      errors: [{ id: '', storagePath: '', message: reserveErr.message }],
    };
  }

  const rows = (
    Array.isArray(reservedRows) ? reservedRows : reservedRows ? [reservedRows] : []
  ) as Array<{ id: string; bucket_id?: string; storage_path: string; file_reference?: string }>;

  let deleted = 0;
  let failed = 0;
  const errors: Array<{ id: string; storagePath: string; message: string }> = [];

  for (const row of rows) {
    const bucketId = row.bucket_id || 'customer-documents';
    const storagePath = String(row.storage_path || '');
    if (!storagePath || storagePath.includes('..')) {
      const msg = 'Invalid reserved storage path';
      await supabase
        .from('customer_document_uploads')
        .update({ cleanup_state: 'cleanup_failed', cleanup_error: msg })
        .eq('id', row.id)
        .is('claimed_at', null)
        .eq('cleanup_state', 'pending_cleanup');
      failed += 1;
      errors.push({ id: row.id, storagePath, message: msg });
      continue;
    }

    const { error: removeErr } = await supabase.storage.from(bucketId).remove([storagePath]);
    if (removeErr) {
      const msg = removeErr.message.slice(0, 500);
      await supabase
        .from('customer_document_uploads')
        .update({ cleanup_state: 'cleanup_failed', cleanup_error: msg })
        .eq('id', row.id)
        .is('claimed_at', null)
        .eq('cleanup_state', 'pending_cleanup');
      failed += 1;
      errors.push({ id: row.id, storagePath, message: msg });
      continue;
    }

    const { error: finalizeErr } = await supabase
      .from('customer_document_uploads')
      .update({
        cleanup_state: 'deleted',
        cleaned_at: new Date().toISOString(),
        cleanup_error: null,
      })
      .eq('id', row.id)
      .is('claimed_at', null)
      .eq('cleanup_state', 'pending_cleanup');

    if (finalizeErr) {
      failed += 1;
      errors.push({ id: row.id, storagePath, message: finalizeErr.message });
    } else {
      deleted += 1;
    }
  }

  return {
    ok: failed === 0,
    reserved: rows.length,
    deleted,
    failed,
    errors,
  };
}

/**
 * Inserts a row into Supabase strictly through the server service-role client
 * with `idempotency_key` deduplication (browser roles have zero direct DML grants).
 */
async function insertSupabaseRowWithIdempotency(
  table: 'quote_requests' | 'job_applications' | 'customer_feedback',
  rowWithoutKey: Record<string, unknown>,
  idempotencyKey?: string
): Promise<{ ok: boolean; deduplicated?: boolean; error?: unknown }> {
  const supabase = createServiceRoleClient();
  const payload = idempotencyKey
    ? { ...rowWithoutKey, idempotency_key: idempotencyKey }
    : rowWithoutKey;

  const { error } = await supabase.from(table).insert(payload);
  if (!error) {
    return { ok: true };
  }

  const errCode = (error as { code?: string }).code;
  const errMessage = (error as { message?: string }).message || '';

  if (errCode === '23505' || errMessage.toLowerCase().includes('duplicate key')) {
    return { ok: true, deduplicated: true };
  }

  if (
    idempotencyKey &&
    (errCode === '42703' ||
      errCode === 'PGRST204' ||
      errMessage.includes('idempotency_key'))
  ) {
    const retry = await supabase.from(table).insert(rowWithoutKey);
    if (!retry.error) {
      return { ok: true };
    }
    return { ok: false, error: retry.error };
  }

  return { ok: false, error };
}

// ----------------- QUOTES -----------------
export async function getQuotes(): Promise<DBQuote[]> {
  if (isServiceRoleConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from('quote_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return (data as Record<string, unknown>[]).map((d) => ({
          id: String(d.id || ''),
          fullName: String(d.full_name || ''),
          email: String(d.email || ''),
          phone: String(d.phone || ''),
          projectLocation: String(d.project_location || ''),
          serviceRequired: String(d.service_required || ''),
          description: String(d.description || ''),
          preferredContact: String(d.preferred_contact || 'email'),
          attachmentUrl: d.attachment_url ? String(d.attachment_url) : undefined,
          status: (d.status as DBQuote['status']) || 'pending',
          adminNotes: d.admin_notes ? String(d.admin_notes) : undefined,
          createdAt: String(d.created_at || new Date().toISOString()),
        }));
      }
    } catch (e) {
      console.error('Supabase getQuotes fallback:', e);
    }
  }

  return ensureDataFile<DBQuote>('quotes.json', [
    {
      id: 'q-sample-001',
      fullName: 'Sample Client [Demo]',
      email: 'sample@example.com',
      phone: '+61 400 000 000',
      projectLocation: 'Adelaide, SA [Sample Record]',
      serviceRequired: 'Interior Precision Painting',
      propertyType: 'Residential Home',
      description: 'Sample quotation inquiry record for development preview.',
      preferredContact: 'email',
      status: 'pending',
      adminNotes: 'Sample inquiry for testing purposes.',
      createdAt: new Date().toISOString(),
    },
  ]);
}

function claimLocalCustomerDocument(params: {
  fileReference: string;
  claimToken: string | undefined;
  expectedCategory: 'documents' | 'resumes';
  targetTable: 'quote_requests' | 'job_applications';
  targetRecordId: string;
}): void {
  const expectedPrefix = `private://${params.expectedCategory}/`;
  if (!params.fileReference.startsWith(expectedPrefix)) {
    throw new AttachmentClaimError(400, 'Invalid local attachment reference category.');
  }
  if (!params.claimToken || params.claimToken.trim().length < 32) {
    throw new AttachmentClaimError(400, 'Missing or invalid attachment verification token.');
  }
  const tokenHash = hashClaimToken(params.claimToken);
  const claims = readLocalUploadClaims();
  const idx = claims.findIndex(
    (c) =>
      c.fileReference === params.fileReference &&
      c.category === params.expectedCategory &&
      c.claimTokenHash === tokenHash &&
      c.claimedRecordId === null
  );
  if (idx === -1) {
    throw new AttachmentClaimError(
      400,
      'Attachment reference is invalid, unauthorized, or already attached to another submission.'
    );
  }
  if (claims[idx].expiresAt && new Date(claims[idx].expiresAt).getTime() <= Date.now()) {
    throw new AttachmentClaimError(
      400,
      'Attachment upload window has expired. Please upload the document again.'
    );
  }
  claims[idx] = {
    ...claims[idx],
    claimedByTable: params.targetTable,
    claimedRecordId: params.targetRecordId,
  };
  writeLocalUploadClaims(claims);
}

export async function addQuote(
  quote: Omit<DBQuote, 'id' | 'createdAt' | 'status'> & {
    idempotencyKey?: string;
    attachmentToken?: string;
  }
): Promise<DBQuote & { deduplicated?: boolean }> {
  const { idempotencyKey, attachmentToken, ...quoteData } = quote;
  const newQuote: DBQuote = {
    ...quoteData,
    id: randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (isServiceRoleConfigured()) {
    try {
      const attachment = prepareSupabaseAttachmentParams({
        fileReference: newQuote.attachmentUrl,
        claimToken: attachmentToken,
        expectedCategory: 'documents',
      });

      const persistedDescription = newQuote.propertyType
        ? `[Property Type: ${newQuote.propertyType}]\n${newQuote.description}`
        : newQuote.description;

      const supabase = createServiceRoleClient();
      const { data, error } = await supabase.rpc('cms_submit_quote_with_attachment', {
        p_quote_id: newQuote.id,
        p_full_name: newQuote.fullName,
        p_email: newQuote.email,
        p_phone: newQuote.phone,
        p_project_location: newQuote.projectLocation,
        p_service_required: newQuote.serviceRequired,
        p_description: persistedDescription,
        p_preferred_contact: newQuote.preferredContact,
        p_status: newQuote.status,
        p_attachment_url: attachment.fileReference,
        p_claim_token_hash: attachment.claimTokenHash,
        p_idempotency_key: idempotencyKey ?? null,
      });

      if (error) {
        mapAtomicSubmissionRpcError(error);
      }

      const row = (Array.isArray(data) ? data[0] : data) as
        | { record_id?: string; created_at?: string; deduplicated?: boolean }
        | null;

      if (row && row.record_id) {
        return {
          ...newQuote,
          id: String(row.record_id),
          createdAt: row.created_at ? String(row.created_at) : newQuote.createdAt,
          ...(row.deduplicated ? { deduplicated: true } : {}),
        };
      }

      if (process.env.NODE_ENV === 'production') {
        throw new Error('Database persistence failed');
      }
    } catch (e) {
      if (e instanceof AttachmentClaimError) {
        throw e;
      }
      console.error('Supabase addQuote error:', e);
      if (process.env.NODE_ENV === 'production') {
        throw e;
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Supabase database is required in production environment.');
  }

  if (newQuote.attachmentUrl) {
    claimLocalCustomerDocument({
      fileReference: newQuote.attachmentUrl,
      claimToken: attachmentToken,
      expectedCategory: 'documents',
      targetTable: 'quote_requests',
      targetRecordId: newQuote.id,
    });
  }

  const current = ensureDataFile<DBQuote>('quotes.json', []);
  current.unshift(newQuote);
  writeDataFile('quotes.json', current);
  return newQuote;
}

// ----------------- APPLICATIONS -----------------
export async function getApplications(): Promise<DBApplication[]> {
  if (isServiceRoleConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return (data as Record<string, unknown>[]).map((d) => ({
          id: String(d.id || ''),
          fullName: String(d.applicant_name || ''),
          email: String(d.email || ''),
          phone: String(d.phone || ''),
          position: String(d.position || 'Expression of Interest'),
          yearsOfExperience: String(d.years_of_experience || '1+'),
          portfolioUrl: d.portfolio_url ? String(d.portfolio_url) : undefined,
          coverLetter: d.cover_letter ? String(d.cover_letter) : undefined,
          resumeUrl: d.cv_url ? String(d.cv_url) : undefined,
          status: (d.status as DBApplication['status']) || 'pending',
          adminNotes: d.admin_notes ? String(d.admin_notes) : undefined,
          createdAt: String(d.created_at || new Date().toISOString()),
        }));
      }
    } catch (e) {
      console.error('Supabase getApplications fallback:', e);
    }
  }

  return ensureDataFile<DBApplication>('applications.json', [
    {
      id: 'app-sample-001',
      fullName: 'Sample Applicant [Demo]',
      email: 'applicant@example.com',
      phone: '+61 400 000 000',
      position: 'Precision Architectural Painter',
      yearsOfExperience: '5+',
      coverLetter: 'Sample application record for development testing.',
      status: 'pending',
      adminNotes: 'Sample applicant for demonstration.',
      createdAt: new Date().toISOString(),
    },
  ]);
}

export async function addApplication(
  app: Omit<DBApplication, 'id' | 'createdAt' | 'status'> & {
    idempotencyKey?: string;
    resumeToken?: string;
    jobOpeningId?: string;
  }
): Promise<DBApplication & { deduplicated?: boolean }> {
  const { idempotencyKey, resumeToken, jobOpeningId, ...appData } = app;
  const newApp: DBApplication = {
    ...appData,
    id: randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (isServiceRoleConfigured()) {
    try {
      const attachment = prepareSupabaseAttachmentParams({
        fileReference: newApp.resumeUrl,
        claimToken: resumeToken,
        expectedCategory: 'resumes',
      });

      const metadataLines = [
        `[Position: ${newApp.position}]`,
        `[Experience: ${newApp.yearsOfExperience}]`,
        newApp.portfolioUrl ? `[Portfolio: ${newApp.portfolioUrl}]` : null,
      ].filter(Boolean);
      const persistedCoverLetter = newApp.coverLetter
        ? `${metadataLines.join('\n')}\n\n${newApp.coverLetter}`
        : metadataLines.join('\n');

      const supabase = createServiceRoleClient();
      const rpcArgs: Record<string, unknown> = {
        p_application_id: newApp.id,
        p_applicant_name: newApp.fullName,
        p_email: newApp.email,
        p_phone: newApp.phone,
        p_cover_letter: persistedCoverLetter,
        p_status: newApp.status,
        p_cv_url: attachment.fileReference,
        p_claim_token_hash: attachment.claimTokenHash,
        p_idempotency_key: idempotencyKey ?? null,
      };
      if (jobOpeningId) {
        rpcArgs.p_job_opening_id = jobOpeningId;
      }
      const { data, error } = await supabase.rpc(
        'cms_submit_application_with_attachment',
        rpcArgs
      );

      if (error) {
        mapAtomicSubmissionRpcError(error);
      }

      const row = (Array.isArray(data) ? data[0] : data) as
        | { record_id?: string; created_at?: string; deduplicated?: boolean }
        | null;

      if (row && row.record_id) {
        return {
          ...newApp,
          id: String(row.record_id),
          createdAt: row.created_at ? String(row.created_at) : newApp.createdAt,
          ...(row.deduplicated ? { deduplicated: true } : {}),
        };
      }

      if (process.env.NODE_ENV === 'production') {
        throw new Error('Database persistence failed');
      }
    } catch (e) {
      if (e instanceof AttachmentClaimError) {
        throw e;
      }
      console.error('Supabase addApplication error:', e);
      if (process.env.NODE_ENV === 'production') {
        throw e;
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Supabase database is required in production environment.');
  }

  if (newApp.resumeUrl) {
    claimLocalCustomerDocument({
      fileReference: newApp.resumeUrl,
      claimToken: resumeToken,
      expectedCategory: 'resumes',
      targetTable: 'job_applications',
      targetRecordId: newApp.id,
    });
  }

  const current = ensureDataFile<DBApplication>('applications.json', []);
  current.unshift(newApp);
  writeDataFile('applications.json', current);
  return newApp;
}

// ----------------- FEEDBACK -----------------
export async function getFeedback(): Promise<DBFeedback[]> {
  if (isServiceRoleConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from('customer_feedback')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return (data as Record<string, unknown>[]).map((d) => ({
          id: String(d.id || ''),
          customerName: String(d.name || ''),
          email: d.email ? String(d.email) : undefined,
          projectReference: d.project_reference ? String(d.project_reference) : undefined,
          rating: typeof d.rating === 'number' ? d.rating : 5,
          message: String(d.message || ''),
          permissionToPublish: true,
          status: (d.status as DBFeedback['status']) || 'pending',
          createdAt: String(d.created_at || new Date().toISOString()),
        }));
      }
    } catch (e) {
      console.error('Supabase getFeedback fallback:', e);
    }
  }

  return ensureDataFile<DBFeedback>('feedback.json', [
    {
      id: 'fb-sample-001',
      customerName: 'Sample Client [Demo]',
      email: 'client@example.com',
      projectReference: 'Adelaide Residence [Sample Record]',
      rating: 5,
      message: 'Sample client evaluation record for development testing.',
      permissionToPublish: true,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ]);
}

export async function addFeedback(
  fb: Omit<DBFeedback, 'id' | 'createdAt' | 'status'> & { idempotencyKey?: string }
): Promise<DBFeedback & { deduplicated?: boolean }> {
  const { idempotencyKey, ...fbData } = fb;
  const newFb: DBFeedback = {
    ...fbData,
    id: randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (isServiceRoleConfigured()) {
    try {
      const persistedMessage = newFb.permissionToPublish
        ? newFb.message
        : `[Internal / Do Not Publish]\n${newFb.message}`;

      const res = await insertSupabaseRowWithIdempotency(
        'customer_feedback',
        {
          id: newFb.id,
          name: newFb.customerName,
          email: newFb.email,
          project_reference: newFb.projectReference,
          rating: newFb.rating,
          message: persistedMessage,
          status: newFb.status,
        },
        idempotencyKey
      );

      if (res.ok) {
        return { ...newFb, ...(res.deduplicated ? { deduplicated: true } : {}) };
      }

      if (process.env.NODE_ENV === 'production') {
        throw new Error('Database persistence failed');
      }
    } catch (e) {
      console.error('Supabase addFeedback error:', e);
      if (process.env.NODE_ENV === 'production') {
        throw e;
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Supabase database is required in production environment.');
  }

  const current = ensureDataFile<DBFeedback>('feedback.json', []);
  current.unshift(newFb);
  writeDataFile('feedback.json', current);
  return newFb;
}
