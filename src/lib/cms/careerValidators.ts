import { z } from 'zod';
import { generateSlug, isValidSlug } from './slugs';

export const VACANCY_PUBLICATION_STATUSES = [
  'draft',
  'published',
  'archived',
] as const;

export type VacancyPublicationStatus =
  (typeof VACANCY_PUBLICATION_STATUSES)[number];

export const EMPLOYMENT_TYPES = [
  'Full-time',
  'Part-time',
  'Contract',
  'Subcontract / Trade Partner',
  'Apprenticeship',
  'Expression of Interest',
] as const;

export type VacancyEmploymentType = (typeof EMPLOYMENT_TYPES)[number];

const ExpectedTimestampSchema = z.union([
  z.string().trim().min(1, 'expected_updated_at is required.'),
  z.date().transform((d) => d.toISOString()),
]);

const OptionalDeadlineSchema = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return val.toISOString();
    const trimmed = val.trim();
    if (!trimmed) return null;
    const ms = Date.parse(trimmed);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : 'INVALID_DATE';
  })
  .refine((val) => val !== 'INVALID_DATE', {
    message: 'Application deadline must be a valid ISO date or datetime.',
  });

const OptionalRequirementsSchema = z
  .union([z.string(), z.array(z.string()), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined) return null;
    if (Array.isArray(val)) {
      const cleaned = val.map((item) => item.trim()).filter(Boolean);
      return cleaned.length > 0 ? cleaned.join('\n') : null;
    }
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine((val) => val === null || val.length <= 4000, {
    message: 'Requirements must be at most 4000 characters.',
  });

export const CreateVacancySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Vacancy title must be at least 3 characters.')
      .max(140, 'Vacancy title must be at most 140 characters.'),
    slug: z
      .string()
      .trim()
      .max(140, 'Slug must be at most 140 characters.')
      .optional(),
    department: z
      .string()
      .trim()
      .min(2, 'Department/category must be at least 2 characters.')
      .max(100, 'Department/category must be at most 100 characters.')
      .optional()
      .default('Architectural Finishing'),
    employment_type: z
      .enum(EMPLOYMENT_TYPES)
      .optional()
      .default('Full-time'),
    location: z
      .string()
      .trim()
      .min(2, 'Location must be at least 2 characters.')
      .max(120, 'Location must be at most 120 characters.')
      .optional()
      .default('Adelaide, South Australia'),
    description: z
      .string()
      .trim()
      .min(15, 'Job description must be at least 15 characters.')
      .max(6000, 'Job description must be at most 6000 characters.'),
    requirements: OptionalRequirementsSchema.optional(),
    application_deadline: OptionalDeadlineSchema.optional(),
    is_open: z.boolean().optional().default(true),
    sort_order: z.number().int().min(0).max(10000).optional().default(0),
  })
  .transform((data) => {
    const resolvedSlug =
      data.slug && data.slug.length > 0 ? generateSlug(data.slug) : generateSlug(data.title);
    return {
      ...data,
      slug: resolvedSlug,
    };
  })
  .refine((data) => isValidSlug(data.slug), {
    path: ['slug'],
    message: 'Vacancy slug must contain lowercase letters, numbers, and hyphens.',
  });

export type CreateVacancyInput = z.infer<typeof CreateVacancySchema>;

export const UpdateVacancySchema = z
  .object({
    expected_updated_at: ExpectedTimestampSchema,
    title: z
      .string()
      .trim()
      .min(3, 'Vacancy title must be at least 3 characters.')
      .max(140, 'Vacancy title must be at most 140 characters.')
      .optional(),
    slug: z
      .string()
      .trim()
      .min(2, 'Slug must be at least 2 characters.')
      .max(140, 'Slug must be at most 140 characters.')
      .transform((s) => generateSlug(s))
      .refine((s) => isValidSlug(s), {
        message: 'Vacancy slug must contain lowercase letters, numbers, and hyphens.',
      })
      .optional(),
    department: z
      .string()
      .trim()
      .min(2, 'Department/category must be at least 2 characters.')
      .max(100, 'Department/category must be at most 100 characters.')
      .optional(),
    employment_type: z.enum(EMPLOYMENT_TYPES).optional(),
    location: z
      .string()
      .trim()
      .min(2, 'Location must be at least 2 characters.')
      .max(120, 'Location must be at most 120 characters.')
      .optional(),
    description: z
      .string()
      .trim()
      .min(15, 'Job description must be at least 15 characters.')
      .max(6000, 'Job description must be at most 6000 characters.')
      .optional(),
    requirements: OptionalRequirementsSchema.optional(),
    application_deadline: OptionalDeadlineSchema.optional(),
    sort_order: z.number().int().min(0).max(10000).optional(),
  });

export type UpdateVacancyInput = z.infer<typeof UpdateVacancySchema>;

export const VacancyPublishSchema = z.object({
  expected_updated_at: ExpectedTimestampSchema,
  publication_status: z.enum(VACANCY_PUBLICATION_STATUSES),
  confirmed: z.boolean().optional(),
});

export const VacancyOpenStateSchema = z.object({
  expected_updated_at: ExpectedTimestampSchema,
  is_open: z.boolean(),
});

export const VacancyReorderSchema = z.object({
  ordered_ids: z
    .array(z.string().uuid('Each vacancy ID must be a valid UUID.'))
    .min(1, 'At least one vacancy ID is required.')
    .max(200, 'Cannot reorder more than 200 vacancies at once.'),
});
