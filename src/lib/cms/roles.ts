export const EDITORIAL_ROLES = ['editor', 'publisher', 'admin'] as const;
export type EditorialRole = (typeof EDITORIAL_ROLES)[number];

export const ARTICLE_STATUSES = [
  'draft',
  'review',
  'approved',
  'scheduled',
  'published',
  'archived',
] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const EDITORIAL_ACTIONS = [
  'article:read_unpublished',
  'article:create_draft',
  'article:edit_draft',
  'article:edit_review',
  'article:submit_for_review',
  'article:request_changes',
  'article:approve',
  'article:return_approved',
  'article:schedule',
  'article:unschedule',
  'article:publish_now',
  'article:edit_published',
  'article:archive',
  'media:upload',
  'media:delete_orphan',
  'preview:create_token',
  'overview:read',
  'project:read',
  'project:create_draft',
  'project:edit_draft',
  'project:edit_published',
  'project:write',
  'project:publish',
  'project:archive',
  'testimonial:read',
  'testimonial:create_draft',
  'testimonial:edit_draft',
  'testimonial:review',
  'testimonial:publish',
  'testimonial:feature',
  'testimonial:edit_published',
  'testimonial:promote_feedback',
  'career:read',
  'career:create_draft',
  'career:edit_draft',
  'career:edit_published',
  'career:publish',
  'career:toggle_open',
  'career:reorder',
  'submission:read',
  'submission:write',
  'submission:download_attachment',
  'ai_studio:use',
  'staff:manage',
  'insurance:read',
  'insurance:manage',
  'insurance:export',
] as const;
export type EditorialAction = (typeof EDITORIAL_ACTIONS)[number];

export interface StaffProfile {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  role: EditorialRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export function isEditorialRole(value: unknown): value is EditorialRole {
  return typeof value === 'string' && (EDITORIAL_ROLES as readonly string[]).includes(value);
}

export function isArticleStatus(value: unknown): value is ArticleStatus {
  return typeof value === 'string' && (ARTICLE_STATUSES as readonly string[]).includes(value);
}
