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
  readonly status: 400 | 409 | 503;

  constructor(status: 400 | 409 | 503, message: string) {
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
}

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
  });
  writeLocalUploadClaims(claims);
  return { ok: true, uploadToken };
}

async function verifyAndClaimSupabaseAttachment(params: {
  fileReference: string;
  claimToken: string | undefined;
  expectedCategory: 'documents' | 'resumes';
  targetTable: 'quote_requests' | 'job_applications';
  targetRecordId: string;
  idempotencyKey?: string;
}): Promise<{ alreadyPersisted?: boolean }> {
  const expectedPrefix = `supabase://customer-documents/${params.expectedCategory}/`;
  if (!params.fileReference.startsWith(expectedPrefix)) {
    throw new AttachmentClaimError(400, 'Invalid attachment reference category.');
  }
  if (!params.claimToken || params.claimToken.trim().length < 32) {
    throw new AttachmentClaimError(400, 'Missing or invalid attachment verification token.');
  }

  const supabase = createServiceRoleClient();

  if (params.idempotencyKey) {
    const refCol = params.targetTable === 'quote_requests' ? 'attachment_url' : 'cv_url';
    const { data: existingRow } = await supabase
      .from(params.targetTable)
      .select(`id, ${refCol}`)
      .eq('idempotency_key', params.idempotencyKey)
      .maybeSingle();
    if (
      existingRow &&
      (existingRow as Record<string, unknown>)[refCol] === params.fileReference
    ) {
      return { alreadyPersisted: true };
    }
  }

  const tokenHash = hashClaimToken(params.claimToken);
  const { data: claimedRows, error: claimErr } = await supabase
    .from('customer_document_uploads')
    .update({
      claimed_by_table: params.targetTable,
      claimed_record_id: params.targetRecordId,
      claimed_at: new Date().toISOString(),
    })
    .eq('file_reference', params.fileReference)
    .eq('category', params.expectedCategory)
    .eq('claim_token_hash', tokenHash)
    .is('claimed_at', null)
    .select('id');

  if (claimErr) {
    throw claimErr;
  }

  if (!claimedRows || claimedRows.length === 0) {
    throw new AttachmentClaimError(
      400,
      'Attachment reference is invalid, unauthorized, or already attached to another submission.'
    );
  }

  return {};
}

async function releaseSupabaseAttachmentClaim(
  fileReference: string,
  targetRecordId: string
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    await supabase
      .from('customer_document_uploads')
      .update({
        claimed_by_table: null,
        claimed_record_id: null,
        claimed_at: null,
      })
      .eq('file_reference', fileReference)
      .eq('claimed_record_id', targetRecordId);
  } catch {
    // Best-effort compensation
  }
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
    let claimed = false;
    try {
      if (newQuote.attachmentUrl) {
        const claimRes = await verifyAndClaimSupabaseAttachment({
          fileReference: newQuote.attachmentUrl,
          claimToken: attachmentToken,
          expectedCategory: 'documents',
          targetTable: 'quote_requests',
          targetRecordId: newQuote.id,
          idempotencyKey,
        });
        if (claimRes.alreadyPersisted) {
          return { ...newQuote, deduplicated: true };
        }
        claimed = true;
      }

      const persistedDescription = newQuote.propertyType
        ? `[Property Type: ${newQuote.propertyType}]\n${newQuote.description}`
        : newQuote.description;

      const res = await insertSupabaseRowWithIdempotency(
        'quote_requests',
        {
          id: newQuote.id,
          full_name: newQuote.fullName,
          email: newQuote.email,
          phone: newQuote.phone,
          project_location: newQuote.projectLocation,
          service_required: newQuote.serviceRequired,
          description: persistedDescription,
          preferred_contact: newQuote.preferredContact,
          attachment_url: newQuote.attachmentUrl,
          status: newQuote.status,
        },
        idempotencyKey
      );

      if (res.ok) {
        return { ...newQuote, ...(res.deduplicated ? { deduplicated: true } : {}) };
      }

      if (claimed && newQuote.attachmentUrl) {
        await releaseSupabaseAttachmentClaim(newQuote.attachmentUrl, newQuote.id);
      }

      if (process.env.NODE_ENV === 'production') {
        throw new Error('Database persistence failed');
      }
    } catch (e) {
      if (claimed && newQuote.attachmentUrl) {
        await releaseSupabaseAttachmentClaim(newQuote.attachmentUrl, newQuote.id);
      }
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
  }
): Promise<DBApplication & { deduplicated?: boolean }> {
  const { idempotencyKey, resumeToken, ...appData } = app;
  const newApp: DBApplication = {
    ...appData,
    id: randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (isServiceRoleConfigured()) {
    let claimed = false;
    try {
      if (newApp.resumeUrl) {
        const claimRes = await verifyAndClaimSupabaseAttachment({
          fileReference: newApp.resumeUrl,
          claimToken: resumeToken,
          expectedCategory: 'resumes',
          targetTable: 'job_applications',
          targetRecordId: newApp.id,
          idempotencyKey,
        });
        if (claimRes.alreadyPersisted) {
          return { ...newApp, deduplicated: true };
        }
        claimed = true;
      }

      const metadataLines = [
        `[Position: ${newApp.position}]`,
        `[Experience: ${newApp.yearsOfExperience}]`,
        newApp.portfolioUrl ? `[Portfolio: ${newApp.portfolioUrl}]` : null,
      ].filter(Boolean);
      const persistedCoverLetter = newApp.coverLetter
        ? `${metadataLines.join('\n')}\n\n${newApp.coverLetter}`
        : metadataLines.join('\n');

      const res = await insertSupabaseRowWithIdempotency(
        'job_applications',
        {
          id: newApp.id,
          applicant_name: newApp.fullName,
          email: newApp.email,
          phone: newApp.phone,
          cover_letter: persistedCoverLetter,
          cv_url: newApp.resumeUrl,
          status: newApp.status,
        },
        idempotencyKey
      );

      if (res.ok) {
        return { ...newApp, ...(res.deduplicated ? { deduplicated: true } : {}) };
      }

      if (claimed && newApp.resumeUrl) {
        await releaseSupabaseAttachmentClaim(newApp.resumeUrl, newApp.id);
      }

      if (process.env.NODE_ENV === 'production') {
        throw new Error('Database persistence failed');
      }
    } catch (e) {
      if (claimed && newApp.resumeUrl) {
        await releaseSupabaseAttachmentClaim(newApp.resumeUrl, newApp.id);
      }
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
