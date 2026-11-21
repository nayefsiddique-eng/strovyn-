import { z } from 'zod';

export const TESTIMONIAL_MODERATION_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'hidden',
] as const;

export type TestimonialModerationStatus =
  (typeof TESTIMONIAL_MODERATION_STATUSES)[number];

const OptionalTrimmedString = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (typeof val !== 'string') return null;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .refine((val) => val === null || val.length <= max, {
      message: `Must be at most ${max} characters.`,
    });

const OptionalRatingSchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = typeof val === 'number' ? val : Number(val);
    return Number.isFinite(num) ? num : NaN;
  })
  .refine(
    (val) => val === null || (Number.isInteger(val) && val >= 1 && val <= 5),
    { message: 'Rating must be an integer between 1 and 5 when provided.' }
  );

const OptionalUuidSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (typeof val !== 'string') return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine(
    (val) => val === null || z.string().uuid().safeParse(val).success,
    { message: 'Invalid UUID reference.' }
  );

export const CreateTestimonialSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(2, 'Customer display name must be at least 2 characters.')
    .max(120, 'Customer display name must be at most 120 characters.'),
  content: z
    .string()
    .trim()
    .min(10, 'Testimonial text must be at least 10 characters.')
    .max(2500, 'Testimonial text must be at most 2500 characters.'),
  rating: OptionalRatingSchema.optional(),
  customer_role: OptionalTrimmedString(160).optional(),
  location: OptionalTrimmedString(160).optional(),
  specification: OptionalTrimmedString(180).optional(),
  project_reference: OptionalTrimmedString(180).optional(),
  related_project_id: OptionalUuidSchema.optional(),
  consent_verified: z.boolean().optional().default(false),
  consent_evidence: OptionalTrimmedString(500).optional(),
  is_featured: z.boolean().optional().default(false),
  sort_order: z.number().int().min(0).max(10000).optional().default(0),
});

export type CreateTestimonialInput = z.infer<typeof CreateTestimonialSchema>;

const ExpectedTimestampSchema = z
  .union([
    z.string().trim().min(1, 'expected_updated_at is required.'),
    z.date().transform((d) => d.toISOString()),
  ]);

export const UpdateTestimonialSchema = z.object({
  expected_updated_at: ExpectedTimestampSchema,
  customer_name: z
    .string()
    .trim()
    .min(2, 'Customer display name must be at least 2 characters.')
    .max(120, 'Customer display name must be at most 120 characters.')
    .optional(),
  content: z
    .string()
    .trim()
    .min(10, 'Testimonial text must be at least 10 characters.')
    .max(2500, 'Testimonial text must be at most 2500 characters.')
    .optional(),
  rating: OptionalRatingSchema.optional(),
  customer_role: OptionalTrimmedString(160).optional(),
  location: OptionalTrimmedString(160).optional(),
  specification: OptionalTrimmedString(180).optional(),
  project_reference: OptionalTrimmedString(180).optional(),
  related_project_id: OptionalUuidSchema.optional(),
  consent_verified: z.boolean().optional(),
  consent_evidence: OptionalTrimmedString(500).optional(),
});

export type UpdateTestimonialInput = z.infer<typeof UpdateTestimonialSchema>;

export const TestimonialTransitionSchema = z.object({
  expected_updated_at: ExpectedTimestampSchema,
  note: OptionalTrimmedString(500).optional(),
  reason: OptionalTrimmedString(500).optional(),
  confirmed: z.boolean().optional(),
});

export const TestimonialFeatureSchema = z.object({
  expected_updated_at: ExpectedTimestampSchema,
  is_featured: z.boolean(),
});

export const TestimonialReorderSchema = z.object({
  ordered_ids: z
    .array(z.string().uuid('Each testimonial ID must be a valid UUID.'))
    .min(1, 'At least one testimonial ID is required.')
    .max(200, 'Cannot reorder more than 200 testimonials at once.'),
});

export const PromoteFeedbackSchema = z.object({
  feedback_id: z.string().uuid('Valid feedback ID is required.'),
  customer_role: OptionalTrimmedString(160).optional(),
  location: OptionalTrimmedString(160).optional(),
});
