import { z } from 'zod';
import { containsUnsafeHtmlPattern } from './contentSecurity';
import { isValidSlug } from './slugs';

export const AI_STUDIO_MODES = [
  'article_writer',
  'project_description',
  'seo_assistant',
  'social_assistant',
] as const;

export type AiStudioMode = (typeof AI_STUDIO_MODES)[number];

export const APPROVED_INTERNAL_ROUTES = [
  '/',
  '/about',
  '/services',
  '/services/interior-architectural-painting',
  '/services/exterior-facade-restoration',
  '/services/fine-cabinetry-millwork',
  '/services/artisanal-plasters-lime-washes',
  '/services/historic-heritage-conservation',
  '/services/commercial-hospitality-finishes',
  '/projects',
  '/insights',
  '/careers',
  '/contact',
  '/visualiser',
  '/feedback',
] as const;

export type ApprovedInternalRoute = (typeof APPROVED_INTERNAL_ROUTES)[number];

const PROMPT_INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions|rules|prompts|directives)/i,
  /disregard\s+(all\s+)?(previous|prior|system)\s+(instructions|rules|prompts)/i,
  /override\s+(system|security|governance|safety)\s+(rules|instructions|policy)/i,
  /you\s+are\s+now\s+(an?\s+)?(autonomous|unrestricted|jailbroken)/i,
  /publish\s+(this\s+)?(automatically|immediately|directly)\s+without\s+(review|approval)/i,
  /fabricate\s+(a\s+)?(testimonial|client\s+endorsement|customer\s+review|licence|insurance)/i,
  /supabase:\/\/customer-documents\//i,
];

const PROHIBITED_CLAIM_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\$\s?\d[\d,]*(?:\.\d{2})?(?:\s*(?:per|\/)\s*(?:sqm|m2|hour|day|room))?/i,
    reason: 'Output contains specific pricing or dollar rate claims.',
  },
  {
    pattern: /\b\d+\s*(?:aud|dollars)\s*(?:per|\/)\s*(?:sqm|m2|hour)\b/i,
    reason: 'Output contains unverified rate or pricing figures.',
  },
  {
    pattern: /\b(?:builders?\s+licen[cs]e|abn|acn|policy)\s*(?:number|no\.?|#)\s*[:#]?\s*\d{4,}/i,
    reason: 'Output contains unverified licence, ABN, or insurance policy numbers.',
  },
  {
    pattern: /\b(?:iso\s*9001|master\s+painters\s+certified|100%\s+lifetime\s+warranty|\d+-year\s+unconditional\s+guarantee)\b/i,
    reason: 'Output contains unverified certification or guarantee claims.',
  },
];

export function detectPromptInjectionAttempt(text: string): {
  detected: boolean;
  reason?: string;
} {
  for (const regex of PROMPT_INJECTION_PATTERNS) {
    if (regex.test(text)) {
      return {
        detected: true,
        reason:
          'Input contains disallowed prompt-override or private customer document directives.',
      };
    }
  }
  return { detected: false };
}

export function scanForProhibitedUnverifiedClaims(text: string): {
  clean: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  for (const rule of PROHIBITED_CLAIM_PATTERNS) {
    if (rule.pattern.test(text)) {
      violations.push(rule.reason);
    }
  }
  return {
    clean: violations.length === 0,
    violations,
  };
}

export function sanitizeUntrustedGroundingText(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .trim();
}

const SafeInputString = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`)
    .refine((val) => !containsUnsafeHtmlPattern(val), {
      message: `${label} contains unsafe markup.`,
    })
    .superRefine((val, ctx) => {
      const check = detectPromptInjectionAttempt(val);
      if (check.detected) {
        ctx.addIssue({
          code: 'custom',
          message: check.reason ?? `${label} contains disallowed instructions.`,
        });
      }
    });

const OptionalSafeInputString = (max: number, label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((val) => (typeof val === 'string' && val.trim() ? val.trim() : null))
    .refine((val) => val === null || val.length <= max, {
      message: `${label} must be at most ${max} characters.`,
    })
    .refine((val) => val === null || !containsUnsafeHtmlPattern(val), {
      message: `${label} contains unsafe markup.`,
    })
    .superRefine((val, ctx) => {
      if (!val) return;
      const check = detectPromptInjectionAttempt(val);
      if (check.detected) {
        ctx.addIssue({
          code: 'custom',
          message: check.reason ?? `${label} contains disallowed instructions.`,
        });
      }
    });

// ---------------------------------------------------------------------------
// Input Schemas for the 4 Modes
// ---------------------------------------------------------------------------
export const ArticleWriterInputSchema = z.object({
  mode: z.literal('article_writer'),
  topic: SafeInputString(4, 160, 'Topic'),
  targetAudience: SafeInputString(3, 120, 'Target audience')
    .optional()
    .default('Adelaide architects, builders, and residential estate owners'),
  primaryKeyword: SafeInputString(2, 100, 'Primary SEO keyword'),
  serviceCategory: SafeInputString(2, 60, 'Service category')
    .optional()
    .default('Surface Engineering'),
  sourceNotes: SafeInputString(10, 3000, 'Verified source notes'),
  desiredLength: z
    .enum(['concise', 'standard', 'comprehensive'])
    .optional()
    .default('standard'),
});

export const ProjectDescriptionInputSchema = z.object({
  mode: z.literal('project_description'),
  projectId: z.string().uuid().nullable().optional(),
  title: SafeInputString(3, 140, 'Project title'),
  location: SafeInputString(2, 120, 'Location'),
  category: SafeInputString(2, 80, 'Category')
    .optional()
    .default('Residential Commissions'),
  workPerformed: SafeInputString(10, 2000, 'Work performed'),
  materialsAndFinishes: SafeInputString(3, 400, 'Materials and finishes'),
  clientApprovedNotes: OptionalSafeInputString(2000, 'Client-approved notes'),
});

export const SeoAssistantInputSchema = z.object({
  mode: z.literal('seo_assistant'),
  targetType: z.enum(['article', 'project']),
  targetId: z.string().uuid().nullable().optional(),
  currentTitle: SafeInputString(3, 180, 'Current title'),
  currentContentOrSummary: SafeInputString(15, 3500, 'Current content or summary'),
  primaryKeyword: SafeInputString(2, 100, 'Primary SEO keyword'),
  locationOrService: OptionalSafeInputString(120, 'Location or service'),
});

export const SocialAssistantInputSchema = z.object({
  mode: z.literal('social_assistant'),
  subjectTitle: SafeInputString(3, 160, 'Subject title'),
  serviceOrCategory: SafeInputString(2, 100, 'Service or category'),
  location: SafeInputString(2, 120, 'Location')
    .optional()
    .default('Adelaide, South Australia'),
  verifiedHighlights: SafeInputString(10, 2000, 'Verified highlights'),
  callToActionRoute: z
    .enum(APPROVED_INTERNAL_ROUTES)
    .optional()
    .default('/contact'),
});

export const AiStudioGenerateRequestSchema = z.discriminatedUnion('mode', [
  ArticleWriterInputSchema,
  ProjectDescriptionInputSchema,
  SeoAssistantInputSchema,
  SocialAssistantInputSchema,
]);

export type AiStudioGenerateRequest = z.infer<
  typeof AiStudioGenerateRequestSchema
>;

// ---------------------------------------------------------------------------
// Output Schemas for the 4 Modes (Strict Structured-Output Validation)
// ---------------------------------------------------------------------------
export const SuggestedInternalLinkSchema = z.object({
  label: z.string().trim().min(2).max(100),
  href: z.enum(APPROVED_INTERNAL_ROUTES),
  reason: z.string().trim().min(4).max(220),
});

export const ArticleWriterOutputSchema = z.object({
  mode: z.literal('article_writer'),
  headline: z.string().trim().min(5).max(180),
  subtitle: z.string().trim().min(2).max(240),
  excerpt: z.string().trim().min(20).max(360),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(96)
    .refine(isValidSlug, 'Suggested slug must be valid kebab-case.'),
  category: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[A-Za-z0-9 &/-]+$/),
  seoTitle: z.string().trim().min(3).max(70),
  seoDescription: z.string().trim().min(10).max(160),
  bodySections: z
    .array(
      z.object({
        heading: z.string().trim().min(3).max(140),
        paragraphs: z.array(z.string().trim().min(15).max(1200)).min(1).max(6),
      })
    )
    .min(2)
    .max(8),
  contentJson: z.object({
    type: z.literal('doc'),
    content: z.array(z.record(z.string(), z.unknown())).min(2),
  }),
  suggestedInternalLinks: z.array(SuggestedInternalLinkSchema).min(1).max(5),
  verificationChecklist: z.array(z.string().trim().min(5).max(260)).min(1).max(8),
});

export type ArticleWriterOutput = z.infer<typeof ArticleWriterOutputSchema>;

export const ProjectDescriptionOutputSchema = z.object({
  mode: z.literal('project_description'),
  projectOverview: z.string().trim().min(20).max(5000),
  shortDescription: z.string().trim().min(10).max(320),
  workmanshipDescription: z.string().trim().min(15).max(3000),
  finishesSummary: z.string().trim().min(3).max(400),
  beforeAfterCaptions: z.object({
    beforeCaption: z.string().trim().min(5).max(240),
    afterCaption: z.string().trim().min(5).max(240),
  }),
  imageAltSuggestions: z.array(z.string().trim().min(5).max(180)).min(2).max(6),
  seoTitle: z.string().trim().min(3).max(70),
  seoDescription: z.string().trim().min(10).max(160),
  verificationChecklist: z.array(z.string().trim().min(5).max(260)).min(1).max(8),
});

export type ProjectDescriptionOutput = z.infer<
  typeof ProjectDescriptionOutputSchema
>;

export const SeoAssistantOutputSchema = z.object({
  mode: z.literal('seo_assistant'),
  seoTitle: z.string().trim().min(3).max(70),
  metaDescription: z.string().trim().min(10).max(160),
  headingImprovements: z.array(z.string().trim().min(5).max(220)).min(1).max(6),
  internalLinkingOpportunities: z
    .array(SuggestedInternalLinkSchema)
    .min(1)
    .max(5),
  readabilityImprovements: z
    .array(z.string().trim().min(5).max(240))
    .min(1)
    .max(6),
  missingVerificationItems: z
    .array(z.string().trim().min(5).max(260))
    .min(1)
    .max(8),
});

export type SeoAssistantOutput = z.infer<typeof SeoAssistantOutputSchema>;

export const SocialAssistantOutputSchema = z.object({
  mode: z.literal('social_assistant'),
  instagramCaption: z.string().trim().min(20).max(1200),
  facebookPost: z.string().trim().min(20).max(1500),
  linkedinUpdate: z.string().trim().min(20).max(1800),
  projectShowcaseCaption: z.string().trim().min(15).max(800),
  verificationChecklist: z.array(z.string().trim().min(5).max(260)).min(1).max(8),
});

export type SocialAssistantOutput = z.infer<typeof SocialAssistantOutputSchema>;

export type AiStudioOutput =
  | ArticleWriterOutput
  | ProjectDescriptionOutput
  | SeoAssistantOutput
  | SocialAssistantOutput;

// ---------------------------------------------------------------------------
// Save-to-Draft & Apply-to-Project Action Schemas
// ---------------------------------------------------------------------------
export const SaveAiArticleDraftSchema = z.object({
  headline: SafeInputString(5, 180, 'Headline'),
  subtitle: OptionalSafeInputString(240, 'Subtitle'),
  excerpt: SafeInputString(20, 360, 'Excerpt'),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(96)
    .refine(isValidSlug, 'Slug must be URL-safe kebab-case (3-96 chars).')
    .optional(),
  category: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[A-Za-z0-9 &/-]+$/, 'Invalid category.')
    .default('Surface Engineering'),
  seoTitle: OptionalSafeInputString(70, 'SEO title'),
  seoDescription: OptionalSafeInputString(160, 'SEO description'),
  bodySections: z
    .array(
      z.object({
        heading: SafeInputString(3, 140, 'Section heading'),
        paragraphs: z
          .array(SafeInputString(10, 1200, 'Paragraph'))
          .min(1)
          .max(8),
      })
    )
    .min(1)
    .max(10),
});

export const ApplyAiProjectSuggestionsSchema = z
  .object({
    projectId: z.string().uuid('Valid project ID is required.'),
    expected_updated_at: z.union([
      z.string().trim().min(1, 'expected_updated_at is required.'),
      z.date().transform((d) => d.toISOString()),
    ]),
    description: OptionalSafeInputString(5000, 'Project overview'),
    short_description: OptionalSafeInputString(320, 'Short description'),
    challenges: OptionalSafeInputString(3000, 'Workmanship description'),
    finishes: OptionalSafeInputString(400, 'Finishes summary'),
    seo_title: OptionalSafeInputString(70, 'SEO title'),
    seo_description: OptionalSafeInputString(160, 'SEO description'),
  })
  .refine(
    (d) =>
      d.description !== null ||
      d.short_description !== null ||
      d.challenges !== null ||
      d.finishes !== null ||
      d.seo_title !== null ||
      d.seo_description !== null,
    { message: 'Select at least one suggestion field to apply to the project.' }
  );
