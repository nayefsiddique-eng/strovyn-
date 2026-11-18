import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

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

/**
 * Inserts a row into Supabase with optional `idempotency_key` support.
 * - Handles unique index violations (`23505`) as safe idempotent duplicates.
 * - Automatically retries without `idempotency_key` if migration `002_idempotency_and_hardening.sql`
 *   has not yet been applied to the remote Supabase database.
 */
async function insertSupabaseRowWithIdempotency(
  table: 'quote_requests' | 'job_applications' | 'customer_feedback',
  rowWithoutKey: Record<string, unknown>,
  idempotencyKey?: string
): Promise<{ ok: boolean; deduplicated?: boolean; error?: unknown }> {
  const supabase = await createSupabaseClient();
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
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseClient();
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

export async function addQuote(
  quote: Omit<DBQuote, 'id' | 'createdAt' | 'status'> & { idempotencyKey?: string }
): Promise<DBQuote & { deduplicated?: boolean }> {
  const { idempotencyKey, ...quoteData } = quote;
  const newQuote: DBQuote = {
    ...quoteData,
    id: randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
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

      if (process.env.NODE_ENV === 'production') {
        throw new Error('Database persistence failed');
      }
    } catch (e) {
      console.error('Supabase addQuote error:', e);
      if (process.env.NODE_ENV === 'production') {
        throw e;
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Supabase database is required in production environment.');
  }

  const current = ensureDataFile<DBQuote>('quotes.json', []);
  current.unshift(newQuote);
  writeDataFile('quotes.json', current);
  return newQuote;
}

// ----------------- APPLICATIONS -----------------
export async function getApplications(): Promise<DBApplication[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseClient();
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
  app: Omit<DBApplication, 'id' | 'createdAt' | 'status'> & { idempotencyKey?: string }
): Promise<DBApplication & { deduplicated?: boolean }> {
  const { idempotencyKey, ...appData } = app;
  const newApp: DBApplication = {
    ...appData,
    id: randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      const metadataLines = [
        `[Position: ${newApp.position}]`,
        `[Experience: ${newApp.yearsOfExperience}]`,
        newApp.portfolioUrl ? `[Portfolio: ${newApp.portfolioUrl}]` : null,
      ].filter(Boolean);
      const persistedCoverLetter = newApp.coverLetter
        ? `${metadataLines.join('\n')}\n\n${newApp.coverLetter}`
        : metadataLines.join('\n');

      // Schema 001 grants anonymous INSERT only (no SELECT policy), and id is UUID.
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

      if (process.env.NODE_ENV === 'production') {
        throw new Error('Database persistence failed');
      }
    } catch (e) {
      console.error('Supabase addApplication error:', e);
      if (process.env.NODE_ENV === 'production') {
        throw e;
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Supabase database is required in production environment.');
  }

  const current = ensureDataFile<DBApplication>('applications.json', []);
  current.unshift(newApp);
  writeDataFile('applications.json', current);
  return newApp;
}

// ----------------- FEEDBACK -----------------
export async function getFeedback(): Promise<DBFeedback[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseClient();
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

  if (isSupabaseConfigured()) {
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
