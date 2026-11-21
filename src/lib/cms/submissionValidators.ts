import { z } from 'zod';

export const QUOTE_REQUEST_STATUSES = [
  'pending',
  'reviewed',
  'quoted',
  'closed',
] as const;
export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];

export const JOB_APPLICATION_STATUSES = [
  'pending',
  'reviewing',
  'interviewed',
  'rejected',
  'hired',
] as const;
export type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number];

export const CUSTOMER_FEEDBACK_STATUSES = [
  'pending',
  'reviewed',
  'approved',
  'rejected',
  'archived',
] as const;
export type CustomerFeedbackStatus = (typeof CUSTOMER_FEEDBACK_STATUSES)[number];

const ExpectedTimestampSchema = z.union([
  z.string().trim().min(1, 'expected_updated_at is required.'),
  z.date().transform((d) => d.toISOString()),
]);

const OptionalAdminNotesSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (typeof val !== 'string') return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine((val) => val === null || val.length <= 4000, {
    message: 'Internal notes must be at most 4000 characters.',
  });

export const SubmissionListQuerySchema = z.object({
  page: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 ? n : 1;
    }),
  pageSize: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) return 20;
      return Math.min(n, 50);
    }),
  status: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => (typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : 'all')),
  search: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => (typeof v === 'string' ? v.trim().slice(0, 120) : '')),
});

export type SubmissionListQuery = z.infer<typeof SubmissionListQuerySchema>;

export const UpdateQuoteSubmissionSchema = z
  .object({
    expected_updated_at: ExpectedTimestampSchema,
    status: z.enum(QUOTE_REQUEST_STATUSES).optional(),
    admin_notes: OptionalAdminNotesSchema.optional(),
  })
  .refine((d) => d.status !== undefined || d.admin_notes !== undefined, {
    message: 'At least one of status or admin_notes must be provided.',
  });

export const UpdateApplicationSubmissionSchema = z
  .object({
    expected_updated_at: ExpectedTimestampSchema,
    status: z.enum(JOB_APPLICATION_STATUSES).optional(),
    admin_notes: OptionalAdminNotesSchema.optional(),
  })
  .refine((d) => d.status !== undefined || d.admin_notes !== undefined, {
    message: 'At least one of status or admin_notes must be provided.',
  });

export const UpdateFeedbackSubmissionSchema = z
  .object({
    expected_updated_at: ExpectedTimestampSchema,
    status: z.enum(CUSTOMER_FEEDBACK_STATUSES).optional(),
    admin_notes: OptionalAdminNotesSchema.optional(),
  })
  .refine((d) => d.status !== undefined || d.admin_notes !== undefined, {
    message: 'At least one of status or admin_notes must be provided.',
  });
