import type { EditorialRole } from './roles';

export type AdminModuleId =
  | 'overview'
  | 'articles'
  | 'projects'
  | 'testimonials'
  | 'careers'
  | 'quote-requests'
  | 'job-applications'
  | 'customer-feedback'
  | 'media-library'
  | 'ai-content-studio';

export type AdminModuleStatus = 'live' | 'foundation' | 'planned';

export interface AdminNavItem {
  id: AdminModuleId;
  label: string;
  href: string;
  group: 'core' | 'submissions' | 'future';
  status: AdminModuleStatus;
  phaseLabel: string;
  description: string;
  allowedRoles: readonly EditorialRole[];
}

export const ADMIN_NAVIGATION_ITEMS: readonly AdminNavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    href: '/admin',
    group: 'core',
    status: 'live',
    phaseLabel: 'Phase A',
    description: 'Live operational counts, pending editorial reviews, and submission queues.',
    allowedRoles: ['editor', 'publisher', 'admin'],
  },
  {
    id: 'articles',
    label: 'Articles',
    href: '/admin/insights',
    group: 'core',
    status: 'live',
    phaseLabel: 'CMS-3',
    description: 'Editorial queue, rich-text authoring, approvals, and publication.',
    allowedRoles: ['editor', 'publisher', 'admin'],
  },
  {
    id: 'projects',
    label: 'Projects',
    href: '/admin/projects',
    group: 'core',
    status: 'foundation',
    phaseLabel: 'Phase B',
    description: 'Portfolio case studies, photo overrides, and before/after management.',
    allowedRoles: ['editor', 'publisher', 'admin'],
  },
  {
    id: 'testimonials',
    label: 'Testimonials',
    href: '/admin/testimonials',
    group: 'core',
    status: 'live',
    phaseLabel: 'Phase C',
    description: 'Authorized client endorsements, moderation, and homepage ordering.',
    allowedRoles: ['editor', 'publisher', 'admin'],
  },
  {
    id: 'careers',
    label: 'Careers',
    href: '/admin/careers',
    group: 'core',
    status: 'live',
    phaseLabel: 'Phase D',
    description: 'Vacancy openings, application deadlines, and active recruitment status.',
    allowedRoles: ['editor', 'publisher', 'admin'],
  },
  {
    id: 'quote-requests',
    label: 'Quote Requests',
    href: '/admin/quotes',
    group: 'submissions',
    status: 'live',
    phaseLabel: 'Phase E',
    description: 'Inbound client quote inquiries and private attachment inspection.',
    allowedRoles: ['publisher', 'admin'],
  },
  {
    id: 'job-applications',
    label: 'Job Applications',
    href: '/admin/applications',
    group: 'submissions',
    status: 'live',
    phaseLabel: 'Phase E',
    description: 'Candidate submissions and private resume document access.',
    allowedRoles: ['publisher', 'admin'],
  },
  {
    id: 'customer-feedback',
    label: 'Customer Feedback',
    href: '/admin/feedback',
    group: 'submissions',
    status: 'live',
    phaseLabel: 'Phase E',
    description: 'Direct client feedback triage and testimonial promotion.',
    allowedRoles: ['publisher', 'admin'],
  },
  {
    id: 'media-library',
    label: 'Media Library',
    href: '/admin/photos',
    group: 'core',
    status: 'foundation',
    phaseLabel: 'Phase B',
    description: 'Portfolio project photo manager and editorial asset governance.',
    allowedRoles: ['publisher', 'admin'],
  },
  {
    id: 'ai-content-studio',
    label: 'AI Content Studio',
    href: '/admin/ai-studio',
    group: 'future',
    status: 'live',
    phaseLabel: 'Phase F',
    description: 'Staff-assisted drafting workspace (no automated publishing).',
    allowedRoles: ['editor', 'publisher', 'admin'],
  },
] as const;

export function getAdminNavigationForRole(role: EditorialRole): AdminNavItem[] {
  return ADMIN_NAVIGATION_ITEMS.filter((item) => item.allowedRoles.includes(role));
}
