import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .max(150, 'Email address is too long')
  .pipe(z.email('Invalid email address'));

const optionalPrivateFileReference = z
  .string()
  .trim()
  .max(500, 'Attachment reference is too long')
  .refine(
    (val) => {
      if (!val) return true;
      if (val.includes('..')) return false;
      if (val.startsWith('supabase://customer-documents/')) return val.length > 'supabase://customer-documents/'.length;
      if (val.startsWith('private://')) return val.length > 'private://'.length;
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Invalid attachment reference format' }
  )
  .transform((val) => (val === '' ? undefined : val))
  .optional();

// Quotes Schema
export const quoteRequestSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  email: emailSchema,
  phone: z.string().trim().min(6, 'Valid phone number is required').max(30),
  projectLocation: z
    .string()
    .trim()
    .max(150)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : 'Metro Adelaide, SA')),
  serviceRequired: z.string().trim().min(2, 'Please specify a service required').max(100),
  propertyType: z.string().trim().max(100).optional(),
  approximateAreaM2: z.number().positive().max(100000).optional(),
  storeys: z.number().int().min(1).max(50).optional(),
  isInterior: z.boolean().optional(),
  isExterior: z.boolean().optional(),
  isOccupied: z.boolean().optional(),
  targetTimeline: z.string().trim().max(100).optional(),
  budgetRange: z.string().trim().max(100).optional(),
  description: z.string().trim().min(10, 'Scope description must be at least 10 characters').max(3000),
  preferredContact: z.enum(['email', 'phone', 'whatsapp']).default('email'),
  attachmentUrl: optionalPrivateFileReference,
});

// Feedback Schema
export const feedbackSchema = z.object({
  customerName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.union([z.literal(''), emailSchema]).transform((v) => (v === '' ? undefined : v)).optional(),
  projectReference: z.string().trim().max(150).optional(),
  rating: z.number().int().min(1, 'Rating must be between 1 and 5').max(5, 'Rating must be between 1 and 5'),
  message: z.string().trim().min(5, 'Feedback message must be at least 5 characters').max(2000),
  permissionToPublish: z.boolean().default(false),
});

// Job Application Schema
export const applicationSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  email: emailSchema,
  phone: z.string().trim().min(6, 'Valid phone number is required').max(30),
  position: z.string().trim().min(2, 'Position is required').max(100),
  yearsOfExperience: z.string().trim().max(50).optional().default('1+'),
  portfolioUrl: z
    .string()
    .trim()
    .max(300)
    .refine(
      (val) => {
        if (!val) return true;
        try {
          const parsed = new URL(val);
          return parsed.protocol === 'https:' || parsed.protocol === 'http:';
        } catch {
          return false;
        }
      },
      { message: 'Portfolio URL must be a valid http/https address' }
    )
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
  coverLetter: z.string().trim().max(4000).optional(),
  resumeUrl: optionalPrivateFileReference,
});

// AI Assistant Schema
export const aiAssistantMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().trim().min(1).max(1000),
});

export const aiAssistantSchema = z.object({
  message: z.string().trim().min(1, 'Query message cannot be empty').max(800),
  history: z.array(aiAssistantMessageSchema).max(10).optional(),
});

// Admin Auth Schema
export const adminLoginSchema = z.object({
  action: z.literal('login'),
  key: z.string().min(1, 'Admin key required').max(200),
});

export const adminLogoutSchema = z.object({
  action: z.literal('logout'),
});
