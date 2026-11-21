import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createPublicSupabaseClient,
  isPublicSupabaseConfigured,
} from '@/lib/supabase/public';

export interface PublicVacancyItem {
  id: string;
  slug: string;
  title: string;
  department: string;
  employmentType: string;
  location: string;
  description: string;
  requirements: string[];
  applicationDeadline: string | null;
  publishedAt: string | null;
}

interface PublicVacancyRow {
  id: string;
  slug: string;
  title: string;
  department: string | null;
  employment_type: string | null;
  location: string | null;
  description: string;
  requirements: string | null;
  application_deadline: string | null;
  publication_status: string;
  is_open: boolean;
  sort_order: number | null;
  published_at: string | null;
}

export function parseRequirementsLines(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

export function isVacancyDeadlineExpired(
  deadline: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!deadline) return false;
  const parsed = Date.parse(deadline);
  if (!Number.isFinite(parsed)) return false;
  return parsed <= nowMs;
}

export async function getPublicOpenVacancies(
  clientOverride?: SupabaseClient
): Promise<PublicVacancyItem[]> {
  if (!clientOverride && !isPublicSupabaseConfigured()) {
    return [];
  }

  try {
    const client = clientOverride ?? createPublicSupabaseClient();
    const { data, error } = await client
      .from('job_openings')
      .select(
        'id, slug, title, department, employment_type, location, description, requirements, application_deadline, publication_status, is_open, sort_order, published_at'
      )
      .eq('publication_status', 'published')
      .eq('is_open', true)
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) {
      return [];
    }

    const nowMs = Date.now();
    return (data as PublicVacancyRow[])
      .filter(
        (row) =>
          row.publication_status === 'published' &&
          row.is_open === true &&
          !isVacancyDeadlineExpired(row.application_deadline, nowMs)
      )
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        department: row.department?.trim() || 'Architectural Finishing',
        employmentType: row.employment_type?.trim() || 'Full-time',
        location: row.location?.trim() || 'Adelaide, South Australia',
        description: row.description,
        requirements: parseRequirementsLines(row.requirements),
        applicationDeadline: row.application_deadline ?? null,
        publishedAt: row.published_at ?? null,
      }));
  } catch {
    return [];
  }
}
