import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildTiptapDocumentFromSections,
  executeAiStudioGeneration,
  type AiProviderAdapter,
  type AiUsageRecord,
} from './aiStudioProvider';
import {
  AiStudioGenerateRequestSchema,
  ApplyAiProjectSuggestionsSchema,
  SaveAiArticleDraftSchema,
  scanForProhibitedUnverifiedClaims,
  type AiStudioOutput,
} from './aiStudioValidators';
import { validateAndCompileTiptapContent } from './contentSecurity';
import { createEditorialDraft, type ArticleRecord } from './editorialService';
import { EditorialHttpError } from './http';
import { updateProjectRecord, type DbProjectRecord } from './projectsService';
import { hasEditorialPermission } from './rbac';
import type { EditorialAction, StaffProfile } from './roles';

function assertStaffPermission(staff: StaffProfile, action: EditorialAction): void {
  if (!staff.is_active) {
    throw new EditorialHttpError(403, 'FORBIDDEN', 'Staff account is inactive.');
  }
  if (!hasEditorialPermission(staff.role, action)) {
    throw new EditorialHttpError(
      403,
      'FORBIDDEN',
      `Role ${staff.role} is not authorized to perform ${action}.`
    );
  }
}

export async function generateAiStudioContent(
  staff: StaffProfile,
  rawRequest: unknown,
  options?: {
    timeoutMs?: number;
    maxOutputTokens?: number;
    requireLiveKey?: boolean;
    providerOverride?: AiProviderAdapter;
  }
): Promise<{
  output: AiStudioOutput;
  provider: { name: string; model: string; apiKeyConfigured: boolean };
  usage: AiUsageRecord;
}> {
  assertStaffPermission(staff, 'ai_studio:use');

  const parsed = AiStudioGenerateRequestSchema.safeParse(rawRequest);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid AI Content Studio generation request.'
    );
  }

  return executeAiStudioGeneration(staff.id, parsed.data, options);
}

/**
 * Persists an AI-assisted article strictly as an unpublished `draft` via the
 * existing editorial service (`createEditorialDraft`). Never publishes directly.
 */
export async function saveAiArticleAsDraft(
  staff: StaffProfile,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<Partial<ArticleRecord>> {
  assertStaffPermission(staff, 'ai_studio:use');
  assertStaffPermission(staff, 'article:create_draft');

  const parsed = SaveAiArticleDraftSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid article draft payload.'
    );
  }

  const input = parsed.data;
  const serializedCheck = scanForProhibitedUnverifiedClaims(JSON.stringify(input));
  if (!serializedCheck.clean) {
    throw new EditorialHttpError(
      422,
      'BAD_REQUEST',
      `Article draft rejected by factual safeguard: ${serializedCheck.violations[0]}`
    );
  }

  const contentJson = buildTiptapDocumentFromSections(input.bodySections);
  const compiled = validateAndCompileTiptapContent(contentJson);
  if (!compiled.ok) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      compiled.error ?? 'Generated article body is not valid Tiptap content.'
    );
  }

  const created = await createEditorialDraft(
    staff,
    {
      title: input.headline,
      subtitle: input.subtitle ?? null,
      slug: input.slug,
      category: input.category,
      excerpt: input.excerpt,
      content_json: contentJson,
      seo_title: input.seoTitle ?? null,
      seo_description: input.seoDescription ?? null,
      author_name: staff.full_name || 'Strovyn Editorial Desk',
      author_role: 'Architectural Coatings Studio',
    },
    clientOverride
  );

  return created;
}

/**
 * Applies selected AI suggestions to an existing project record through
 * `updateProjectRecord`, preserving role boundaries (Editors can only edit drafts;
 * Publishers/Admins can edit published projects) and optimistic concurrency (`409`).
 * Never alters `visibility_status`.
 */
export async function applyAiSuggestionsToProject(
  staff: StaffProfile,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<DbProjectRecord> {
  assertStaffPermission(staff, 'ai_studio:use');

  const parsed = ApplyAiProjectSuggestionsSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid project suggestions payload.'
    );
  }

  const input = parsed.data;
  const serializedCheck = scanForProhibitedUnverifiedClaims(JSON.stringify(input));
  if (!serializedCheck.clean) {
    throw new EditorialHttpError(
      422,
      'BAD_REQUEST',
      `Project suggestion rejected by factual safeguard: ${serializedCheck.violations[0]}`
    );
  }

  const updatePayload: Record<string, unknown> = {
    expected_updated_at: input.expected_updated_at,
  };
  if (input.description !== null) updatePayload.description = input.description;
  if (input.short_description !== null) {
    updatePayload.short_description = input.short_description;
  }
  if (input.challenges !== null) updatePayload.challenges = input.challenges;
  if (input.finishes !== null) updatePayload.finishes = input.finishes;
  if (input.seo_title !== null) updatePayload.seo_title = input.seo_title;
  if (input.seo_description !== null) {
    updatePayload.seo_description = input.seo_description;
  }

  return updateProjectRecord(staff, input.projectId, updatePayload, clientOverride);
}
