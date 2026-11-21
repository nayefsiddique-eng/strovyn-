import { z } from 'zod';
import { isValidSlug } from './slugs';

export const PROJECT_CATEGORIES = [
  'Architectural Residential',
  'Heritage Restoration',
  'Artisanal Plasters',
  'Commercial & Hospitality',
] as const;

export const PROJECT_LIFECYCLES = [
  'Completed',
  'Active On-Site',
  'Handover Phase',
] as const;

export const PROJECT_VISIBILITY_STATUSES = [
  'draft',
  'published',
  'archived',
] as const;

export const PROJECT_IMAGE_ROLES = ['cover', 'gallery', 'before', 'after'] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];
export type ProjectLifecycle = (typeof PROJECT_LIFECYCLES)[number];
export type ProjectVisibilityStatus = (typeof PROJECT_VISIBILITY_STATUSES)[number];
export type ProjectImageRole = (typeof PROJECT_IMAGE_ROLES)[number];

const PUBLIC_PROJECT_PHOTOS_PREFIX = '/storage/v1/object/public/project-photos/';

export function isApprovedProjectImageUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 1000) return false;

  if (trimmed.startsWith('/images/')) {
    return !trimmed.includes('..') && !/[\s"'<>\\]/.test(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;

    if (parsed.hostname === 'images.unsplash.com') {
      return true;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const configuredHost = new URL(supabaseUrl).hostname;
      if (
        parsed.hostname === configuredHost &&
        parsed.pathname.startsWith(PUBLIC_PROJECT_PHOTOS_PREFIX)
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export const ProjectImageInputSchema = z
  .object({
    image_url: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .refine(isApprovedProjectImageUrl, {
        message: 'Project image URL must target /images/*, Unsplash, or project-photos storage.',
      }),
    image_role: z.enum(PROJECT_IMAGE_ROLES).default('gallery'),
    alt_text: z.string().trim().min(3).max(300).optional().nullable(),
    caption: z.string().trim().max(300).optional().nullable(),
    pair_key: z.string().trim().max(64).optional().nullable(),
    sort_order: z.number().int().min(0).max(500).default(0),
  })
  .strict();

export const CreateProjectSchema = z
  .object({
    title: z.string().trim().min(4).max(160),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .refine((s) => isValidSlug(s), {
        message: 'Project slug must be valid kebab-case (3-96 chars).',
      })
      .optional(),
    category: z.enum(PROJECT_CATEGORIES),
    location: z.string().trim().min(3).max(160),
    description: z.string().trim().min(20).max(4000),
    short_description: z.string().trim().max(360).optional().nullable(),
    status: z.enum(PROJECT_LIFECYCLES).default('Completed'),
    visibility_status: z.enum(PROJECT_VISIBILITY_STATUSES).default('draft'),
    year: z.string().trim().regex(/^\d{4}$/, 'Year must be a 4-digit value.').optional().nullable(),
    architect: z.string().trim().max(160).optional().nullable(),
    builder: z.string().trim().max(160).optional().nullable(),
    scope: z.array(z.string().trim().min(3).max(300)).max(24).optional(),
    finishes: z.string().trim().max(300).optional().nullable(),
    challenges: z.string().trim().max(2000).optional().nullable(),
    sheen_levels: z.string().trim().max(300).optional().nullable(),
    main_image_url: z
      .string()
      .trim()
      .refine(isApprovedProjectImageUrl, {
        message: 'Cover image URL must target /images/*, Unsplash, or project-photos storage.',
      })
      .optional()
      .nullable(),
    seo_title: z.string().trim().min(3).max(70).optional().nullable(),
    seo_description: z.string().trim().min(10).max(160).optional().nullable(),
    is_featured: z.boolean().optional().default(false),
    is_demonstration_spec: z.boolean().optional().default(false),
    sort_order: z.number().int().min(0).max(1000).optional().default(0),
  })
  .strict();

export const UpdateProjectSchema = z
  .object({
    expected_updated_at: z.string().datetime({ offset: true }),
    title: z.string().trim().min(4).max(160).optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .refine((s) => isValidSlug(s), {
        message: 'Project slug must be valid kebab-case (3-96 chars).',
      })
      .optional(),
    category: z.enum(PROJECT_CATEGORIES).optional(),
    location: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().min(20).max(4000).optional(),
    short_description: z.string().trim().max(360).optional().nullable(),
    status: z.enum(PROJECT_LIFECYCLES).optional(),
    visibility_status: z.enum(PROJECT_VISIBILITY_STATUSES).optional(),
    year: z.string().trim().regex(/^\d{4}$/).optional().nullable(),
    architect: z.string().trim().max(160).optional().nullable(),
    builder: z.string().trim().max(160).optional().nullable(),
    scope: z.array(z.string().trim().min(3).max(300)).max(24).optional(),
    finishes: z.string().trim().max(300).optional().nullable(),
    challenges: z.string().trim().max(2000).optional().nullable(),
    sheen_levels: z.string().trim().max(300).optional().nullable(),
    main_image_url: z
      .string()
      .trim()
      .refine(isApprovedProjectImageUrl, {
        message: 'Cover image URL must target /images/*, Unsplash, or project-photos storage.',
      })
      .optional()
      .nullable(),
    seo_title: z.string().trim().min(3).max(70).optional().nullable(),
    seo_description: z.string().trim().min(10).max(160).optional().nullable(),
    is_featured: z.boolean().optional(),
    is_demonstration_spec: z.boolean().optional(),
    sort_order: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

export const UpdateProjectImagesBatchSchema = z
  .object({
    expected_updated_at: z.string().datetime({ offset: true }),
    coverImageId: z.string().uuid().optional().nullable(),
    images: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            image_role: z.enum(PROJECT_IMAGE_ROLES),
            alt_text: z.string().trim().max(300).optional().nullable(),
            caption: z.string().trim().max(300).optional().nullable(),
            pair_key: z.string().trim().max(64).optional().nullable(),
            sort_order: z.number().int().min(0).max(500),
          })
          .strict()
      )
      .max(100),
  })
  .strict();
