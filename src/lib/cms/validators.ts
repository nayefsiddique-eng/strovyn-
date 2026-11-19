import { z } from 'zod';
import { ARTICLE_STATUSES } from './roles';
import { validateApprovedEditorialMediaUrl } from './imageInspection';
import { containsUnsafeHtmlPattern } from './contentSecurity';
import { isValidSlug, MAX_SLUG_LENGTH, MIN_SLUG_LENGTH } from './slugs';

const SafeText = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`)
    .refine((val) => !containsUnsafeHtmlPattern(val), {
      message: `${label} contains unsafe markup.`,
    });

const ApprovedMediaUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .superRefine((val, ctx) => {
    const res = validateApprovedEditorialMediaUrl(val);
    if (!res.valid) {
      ctx.addIssue({
        code: 'custom',
        message: res.reason,
      });
    }
  });

export const UuidParamSchema = z.string().uuid('Invalid article or asset identifier.');

export const ListArticlesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(ARTICLE_STATUSES).optional(),
    category: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[A-Za-z0-9 &/-]+$/)
      .optional(),
    search: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .transform((s) => s.replace(/[,().%_*\\'"]/g, '').trim())
      .optional(),
    sortBy: z
      .enum(['updated_at', 'created_at', 'published_at', 'title'])
      .default('updated_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export const CreateArticleSchema = z
  .object({
    title: SafeText(5, 180, 'Title'),
    subtitle: SafeText(2, 240, 'Subtitle').nullable().optional(),
    slug: z
      .string()
      .trim()
      .min(MIN_SLUG_LENGTH)
      .max(MAX_SLUG_LENGTH)
      .refine(isValidSlug, 'Slug must be URL-safe kebab-case (3-96 chars).')
      .optional(),
    category: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[A-Za-z0-9 &/-]+$/, 'Category contains unsupported characters.'),
    excerpt: SafeText(20, 360, 'Excerpt'),
    content_json: z.unknown(),
    featured_image_url: ApprovedMediaUrlSchema.nullable().optional(),
    featured_image_alt: SafeText(3, 300, 'Featured image alt text').nullable().optional(),
    og_image_url: ApprovedMediaUrlSchema.nullable().optional(),
    seo_title: SafeText(3, 70, 'SEO title').nullable().optional(),
    seo_description: SafeText(10, 160, 'SEO description').nullable().optional(),
    is_featured: z.boolean().optional(),
    author_name: SafeText(2, 100, 'Author name').optional(),
    author_role: SafeText(2, 80, 'Author role').nullable().optional(),
  })
  .strict();

export const UpdateArticleSchema = z
  .object({
    title: SafeText(5, 180, 'Title').optional(),
    subtitle: SafeText(2, 240, 'Subtitle').nullable().optional(),
    slug: z
      .string()
      .trim()
      .min(MIN_SLUG_LENGTH)
      .max(MAX_SLUG_LENGTH)
      .refine(isValidSlug, 'Slug must be URL-safe kebab-case (3-96 chars).')
      .optional(),
    category: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[A-Za-z0-9 &/-]+$/, 'Category contains unsupported characters.')
      .optional(),
    excerpt: SafeText(20, 360, 'Excerpt').optional(),
    content_json: z.unknown().optional(),
    featured_image_url: ApprovedMediaUrlSchema.nullable().optional(),
    featured_image_alt: SafeText(3, 300, 'Featured image alt text').nullable().optional(),
    og_image_url: ApprovedMediaUrlSchema.nullable().optional(),
    seo_title: SafeText(3, 70, 'SEO title').nullable().optional(),
    seo_description: SafeText(10, 160, 'SEO description').nullable().optional(),
    is_featured: z.boolean().optional(),
    author_name: SafeText(2, 100, 'Author name').optional(),
    author_role: SafeText(2, 80, 'Author role').nullable().optional(),
    expected_updated_at: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .refine(
    (obj) => {
      const keys = Object.keys(obj).filter((k) => k !== 'expected_updated_at');
      return keys.length > 0;
    },
    { message: 'At least one editable article field must be provided.' }
  );

export const TransitionArticleSchema = z
  .object({
    toStatus: z.enum(ARTICLE_STATUSES),
    note: SafeText(1, 500, 'Transition note').optional(),
    expected_updated_at: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const DeleteMediaSchema = z
  .object({
    id: UuidParamSchema,
  })
  .strict();

export const ListMediaQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(24),
    articleId: UuidParamSchema.optional(),
  })
  .strict();
