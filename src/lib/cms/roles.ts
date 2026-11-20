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
  'project:write',
  'project:publish',
  'staff:manage',
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
