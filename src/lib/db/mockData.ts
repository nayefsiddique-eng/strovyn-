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
    !url.includes('placeholder') &&
    !key.includes('placeholder') &&
    url.startsWith('https://')
  );
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
          propertyType: d.property_type ? String(d.property_type) : undefined,
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
      id: 'qt-001',
      fullName: 'Julian Vance',
      email: 'j.vance@example.com',
      phone: '+61 412 000 111',
      projectLocation: 'Toorak, VIC [Placeholder]',
      serviceRequired: 'Interior Architectural Painting',
      propertyType: 'Residential Luxury',
      description: 'Level 5 full interior repaint across a newly framed contemporary residence.',
      preferredContact: 'email',
      status: 'pending',
      adminNotes: 'Sample inquiry for testing purposes.',
      createdAt: new Date().toISOString(),
    },
  ]);
}

export async function addQuote(quote: Omit<DBQuote, 'id' | 'createdAt' | 'status'>): Promise<DBQuote> {
  const newQuote: DBQuote = {
    ...quote,
    id: randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseClient();
      const persistedDescription = newQuote.propertyType
        ? `[Property Type: ${newQuote.propertyType}]\n${newQuote.description}`
        : newQuote.description;

      // Schema (001_initial_schema.sql) grants anonymous INSERT only (no SELECT policy),
      // so do not chain .select().single() under anon RLS.
      const { error } = await supabase.from('quote_requests').insert({
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
      });
      if (!error) return newQuote;
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
          position: String(d.position || 'General Applicant'),
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
      id: 'app-001',
      fullName: 'Marcus Bell',
      email: 'marcus.bell@example.com',
      phone: '+61 433 000 222',
      position: 'Senior Architectural Spray Technician',
      yearsOfExperience: '8',
      portfolioUrl: 'https://example.com/portfolio',
      coverLetter: 'Specialist in airless spray of catalyzed polyurethanes.',
      resumeUrl: '/uploads/resumes/sample-cv.pdf',
      status: 'reviewing',
      adminNotes: 'Sample applicant for demonstration.',
      createdAt: new Date().toISOString(),
    },
  ]);
}

export async function addApplication(app: Omit<DBApplication, 'id' | 'createdAt' | 'status'>): Promise<DBApplication> {
  const newApp: DBApplication = {
    ...app,
    id: `app-${Date.now().toString(36)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseClient();
      const { data, error } = await supabase.from('job_applications').insert({
        id: newApp.id,
        applicant_name: newApp.fullName,
        email: newApp.email,
        phone: newApp.phone,
        cover_letter: newApp.coverLetter,
        cv_url: newApp.resumeUrl,
        status: newApp.status,
      }).select().single();
      if (!error && data) return newApp;
      if (error && process.env.NODE_ENV === 'production') {
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
      id: 'fb-001',
      customerName: 'Marcus Sterling [Placeholder]',
      email: 'm.sterling@example.com',
      projectReference: 'Toorak Private Estate [Placeholder]',
      rating: 5,
      message: 'Substrate preparation and dust containment met expectations. Zero dust migration.',
      permissionToPublish: true,
      status: 'approved',
      createdAt: new Date().toISOString(),
    },
  ]);
}

export async function addFeedback(fb: Omit<DBFeedback, 'id' | 'createdAt' | 'status'>): Promise<DBFeedback> {
  const newFb: DBFeedback = {
    ...fb,
    id: `fb-${Date.now().toString(36)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseClient();
      const { data, error } = await supabase.from('customer_feedback').insert({
        id: newFb.id,
        name: newFb.customerName,
        email: newFb.email,
        project_reference: newFb.projectReference,
        rating: newFb.rating,
        message: newFb.message,
        status: newFb.status,
      }).select().single();
      if (!error && data) return newFb;
      if (error && process.env.NODE_ENV === 'production') {
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
