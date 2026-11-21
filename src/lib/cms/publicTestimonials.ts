import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createPublicSupabaseClient,
  isPublicSupabaseConfigured,
} from '@/lib/supabase/public';

export interface PublicTestimonialItem {
  id: string;
  quote: string;
  author: string;
  role: string | null;
  project: string | null;
  location: string | null;
  specification: string | null;
  rating: number | null;
  isFeatured: boolean;
}

interface PublicTestimonialRow {
  id: string;
  customer_name: string;
  content: string;
  customer_role: string | null;
  project_reference: string | null;
  location: string | null;
  specification: string | null;
  rating: number | null;
  is_featured: boolean | null;
  sort_order: number | null;
  published_at: string | null;
}

export function mapPublicTestimonialRow(
  row: PublicTestimonialRow
): PublicTestimonialItem {
  return {
    id: row.id,
    quote: row.content,
    author: row.customer_name,
    role: row.customer_role?.trim() || null,
    project: row.project_reference?.trim() || null,
    location: row.location?.trim() || null,
    specification: row.specification?.trim() || null,
    rating:
      typeof row.rating === 'number' && row.rating >= 1 && row.rating <= 5
        ? row.rating
        : null,
    isFeatured: Boolean(row.is_featured),
  };
}

export async function getPublicTestimonials(
  clientOverride?: SupabaseClient
): Promise<PublicTestimonialItem[]> {
  if (!clientOverride && !isPublicSupabaseConfigured()) {
    return [];
  }

  try {
    const client = clientOverride ?? createPublicSupabaseClient();
    const { data, error } = await client
      .from('testimonials')
      .select(
        'id, customer_name, content, customer_role, project_reference, location, specification, rating, is_featured, sort_order, published_at'
      )
      .eq('is_published', true)
      .eq('moderation_status', 'approved')
      .eq('consent_verified', true)
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) {
      return [];
    }

    return (data as PublicTestimonialRow[]).map(mapPublicTestimonialRow);
  } catch {
    return [];
  }
}
