import {
  canEditArticleInStatus,
  canTransitionArticleStatus,
  hasEditorialPermission,
  STATUS_TRANSITION_MATRIX,
} from './rbac';
import type {
  ArticleStatus,
  EditorialAction,
  EditorialRole,
} from './roles';

export interface PermittedWorkflowActionSummary {
  toStatus: ArticleStatus;
  label: string;
  action: EditorialAction;
}

export interface RoleQueueActionModel {
  isEditableByRole: boolean;
  canInspectShell: boolean;
  canOpenPreview: boolean;
  workspaceLinkLabel: string;
  lockNotice: string | null;
  permittedTransitions: PermittedWorkflowActionSummary[];
}

const TRANSITION_LABELS: Record<
  ArticleStatus,
  Partial<Record<ArticleStatus, string>>
> = {
  draft: {
    review: 'Submit for Review',
  },
  review: {
    draft: 'Request Changes',
    approved: 'Approve',
  },
  approved: {
    draft: 'Return to Draft',
    review: 'Return to Review',
    scheduled: 'Schedule Publication',
    published: 'Publish Now',
  },
  scheduled: {
    approved: 'Unschedule',
    draft: 'Return to Draft',
    published: 'Publish Now',
  },
  published: {
    archived: 'Archive',
  },
  archived: {
    draft: 'Restore to Draft',
  },
};

/**
 * Normalizes and validates redirect destinations strictly to internal `/admin/insights`
 * routes, rejecting protocol-relative (`//`), external origins, backslashes, and control chars.
 */
export function sanitizeAdminRedirectPath(
  rawPath: string | null | undefined,
  fallback: string = '/admin/insights'
): string {
  if (!rawPath || typeof rawPath !== 'string') {
    return fallback;
  }
  const trimmed = rawPath.trim();
  if (!trimmed || /[\x00-\x1f\\]/.test(trimmed)) {
    return fallback;
  }
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, 'http://local.internal');
    if (parsed.origin !== 'http://local.internal') {
      return fallback;
    }
    const allowedPrefixes = [
      '/admin/insights',
      '/admin/projects',
      '/admin/testimonials',
      '/admin/careers',
      '/admin/quotes',
      '/admin/applications',
      '/admin/feedback',
      '/admin/ai-studio',
      '/admin/staff',
    ];
    const isAllowed =
      parsed.pathname === '/admin' ||
      allowedPrefixes.some(
        (prefix) =>
          parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`)
      );
    if (!isAllowed) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Computes strictly read-only Stage 1 UI action metadata for an article row
 * directly from the shared CMS RBAC matrix. Excludes `'scheduled'` transitions
 * because scheduling is intentionally deferred to CMS-4.
 */
export function getAvailableWorkflowTransitionsForRole(
  role: EditorialRole,
  currentStatus: ArticleStatus
): PermittedWorkflowActionSummary[] {
  const targets = STATUS_TRANSITION_MATRIX[currentStatus];
  if (!targets) return [];

  const result: PermittedWorkflowActionSummary[] = [];
  for (const [toStatusKey, action] of Object.entries(targets) as Array<
    [ArticleStatus, EditorialAction]
  >) {
    const check = canTransitionArticleStatus(role, currentStatus, toStatusKey);
    if (check.allowed) {
      result.push({
        toStatus: toStatusKey,
        label: TRANSITION_LABELS[currentStatus]?.[toStatusKey] ?? toStatusKey,
        action,
      });
    }
  }
  return result;
}

export function getRoleQueueActionModel(
  role: EditorialRole,
  status: ArticleStatus
): RoleQueueActionModel {
  const canInspectShell = hasEditorialPermission(role, 'article:read_unpublished');
  const isEditableByRole = canEditArticleInStatus(role, status);
  const canOpenPreview = hasEditorialPermission(role, 'article:read_unpublished');
  const permittedTransitions = getAvailableWorkflowTransitionsForRole(role, status);

  const lockNotice = isEditableByRole
    ? null
    : `Read-only for ${role} role in '${status}' status`;

  return {
    isEditableByRole,
    canInspectShell,
    canOpenPreview,
    workspaceLinkLabel: isEditableByRole ? 'Open Brief' : 'Inspect (Read-Only)',
    lockNotice,
    permittedTransitions,
  };
}

export function describeStaffRole(role: EditorialRole): {
  label: string;
  scopeSummary: string;
} {
  switch (role) {
    case 'admin':
      return {
        label: 'Administrator',
        scopeSummary:
          'Full editorial inspection, approval, live publication, archival, and staff governance.',
      };
    case 'publisher':
      return {
        label: 'Publisher',
        scopeSummary:
          'Editorial review, approval, live publication, and archival controls.',
      };
    case 'editor':
      return {
        label: 'Editor',
        scopeSummary:
          'Draft & review inspection, submission for review, and private preview access.',
      };
  }
}

export function formatStatusLabel(status: ArticleStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'review':
      return 'In Review';
    case 'approved':
      return 'Approved';
    case 'scheduled':
      return 'Scheduled (CMS-4)';
    case 'published':
      return 'Published';
    case 'archived':
      return 'Archived';
  }
}
