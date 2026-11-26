import {
  type ArticleStatus,
  type EditorialAction,
  type EditorialRole,
} from './roles';

const EDITOR_ACTIONS: readonly EditorialAction[] = [
  'article:read_unpublished',
  'article:create_draft',
  'article:edit_draft',
  'article:edit_review',
  'article:submit_for_review',
  'article:request_changes',
  'media:upload',
  'media:delete_orphan',
  'preview:create_token',
  'overview:read',
  'project:read',
  'project:create_draft',
  'project:edit_draft',
  'testimonial:read',
  'testimonial:create_draft',
  'testimonial:edit_draft',
  'career:read',
  'career:create_draft',
  'career:edit_draft',
  'ai_studio:use',
];

const PUBLISHER_ONLY_ACTIONS: readonly EditorialAction[] = [
  'article:approve',
  'article:return_approved',
  'article:schedule',
  'article:unschedule',
  'article:publish_now',
  'article:edit_published',
  'article:archive',
  'project:edit_published',
  'project:write',
  'project:publish',
  'project:archive',
  'testimonial:review',
  'testimonial:publish',
  'testimonial:feature',
  'testimonial:edit_published',
  'testimonial:promote_feedback',
  'career:edit_published',
  'career:publish',
  'career:toggle_open',
  'career:reorder',
  'submission:read',
  'submission:write',
  'submission:download_attachment',
];

const ROLE_PERMISSION_SETS: Record<EditorialRole, ReadonlySet<EditorialAction>> = {
  editor: new Set<EditorialAction>(EDITOR_ACTIONS),
  publisher: new Set<EditorialAction>([...EDITOR_ACTIONS, ...PUBLISHER_ONLY_ACTIONS]),
  admin: new Set<EditorialAction>([
    ...EDITOR_ACTIONS,
    ...PUBLISHER_ONLY_ACTIONS,
    'staff:manage',
    'insurance:read',
    'insurance:manage',
  ]),
};

/**
 * Explicit status transition graph mapped to the required permission action.
 * Any transition pair absent from this table is rejected even for admins
 * (e.g. direct `draft -> published` or `archived -> published` bypasses).
 */
export const STATUS_TRANSITION_MATRIX: Record<
  ArticleStatus,
  Partial<Record<ArticleStatus, EditorialAction>>
> = {
  draft: {
    review: 'article:submit_for_review',
  },
  review: {
    draft: 'article:request_changes',
    approved: 'article:approve',
  },
  approved: {
    draft: 'article:return_approved',
    review: 'article:return_approved',
    scheduled: 'article:schedule',
    published: 'article:publish_now',
  },
  scheduled: {
    approved: 'article:unschedule',
    draft: 'article:unschedule',
    published: 'article:publish_now',
  },
  published: {
    archived: 'article:archive',
  },
  archived: {
    draft: 'article:archive',
  },
};

const STATUS_EDIT_ACTIONS: Record<ArticleStatus, EditorialAction> = {
  draft: 'article:edit_draft',
  review: 'article:edit_review',
  approved: 'article:approve',
  scheduled: 'article:schedule',
  published: 'article:edit_published',
  archived: 'article:archive',
};

export interface TransitionCheckResult {
  allowed: boolean;
  requiredAction?: EditorialAction;
  reason?: string;
}

export function hasEditorialPermission(
  role: EditorialRole,
  action: EditorialAction
): boolean {
  return ROLE_PERMISSION_SETS[role]?.has(action) ?? false;
}

export function hasAnyEditorialRole(
  role: EditorialRole,
  allowedRoles: readonly EditorialRole[]
): boolean {
  return allowedRoles.includes(role);
}

export function canEditArticleInStatus(
  role: EditorialRole,
  currentStatus: ArticleStatus
): boolean {
  const requiredAction = STATUS_EDIT_ACTIONS[currentStatus];
  return hasEditorialPermission(role, requiredAction);
}

export function canTransitionArticleStatus(
  role: EditorialRole,
  fromStatus: ArticleStatus,
  toStatus: ArticleStatus
): TransitionCheckResult {
  if (fromStatus === toStatus) {
    return {
      allowed: false,
      reason: `Article is already in '${fromStatus}' status.`,
    };
  }

  const requiredAction = STATUS_TRANSITION_MATRIX[fromStatus]?.[toStatus];
  if (!requiredAction) {
    return {
      allowed: false,
      reason: `Workflow transition '${fromStatus}' -> '${toStatus}' is not permitted.`,
    };
  }

  if (!hasEditorialPermission(role, requiredAction)) {
    return {
      allowed: false,
      requiredAction,
      reason: `Role '${role}' is not authorized to perform '${requiredAction}' (${fromStatus} -> ${toStatus}).`,
    };
  }

  if (!canEditArticleInStatus(role, fromStatus)) {
    return {
      allowed: false,
      requiredAction,
      reason: `Role '${role}' cannot modify articles currently in '${fromStatus}' status.`,
    };
  }

  return {
    allowed: true,
    requiredAction,
  };
}
