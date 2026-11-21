import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PROJECTS_DATA } from '@/data/projectsData';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import type { StaffProfile } from './roles';

export interface OperationalPendingAction {
  id: string;
  title: string;
  detail: string;
  count: number;
  href: string;
  ctaLabel: string;
  priority: 'high' | 'normal';
}

export interface AdminOverviewSnapshot {
  articles: {
    draft: number;
    review: number;
    approved: number;
    scheduled: number;
    published: number;
    archived: number;
    total: number;
  };
  projects: {
    catalogCount: number;
    overridesCount: number;
    dbProjectsCount: number;
  };
  governance: {
    pendingTestimonials: number;
    approvedTestimonials: number;
    activeJobOpenings: number;
  } | null;
  submissions: {
    pendingQuotes: number;
    totalQuotes: number;
    pendingApplications: number;
    totalApplications: number;
    pendingFeedback: number;
    totalFeedback: number;
  } | null;
  pendingActions: OperationalPendingAction[];
  generatedAt: string;
}

async function safeCount(
  queryPromise: PromiseLike<{ count: number | null; error: { message?: string } | null }>
): Promise<number> {
  try {
    const res = await queryPromise;
    if (res.error) return 0;
    return res.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Loads live operational counts and actionable pending items for the unified
 * `/admin` Overview workspace. Strictly server-only; callers must verify an
 * active staff session before calling.
 */
export async function getAdminOverviewSnapshot(
  staff: StaffProfile,
  clientOverride?: SupabaseClient
): Promise<AdminOverviewSnapshot> {
  const client = clientOverride ?? createServiceRoleClient();
  const canViewOperations = staff.role === 'publisher' || staff.role === 'admin';

  const [
    draftCount,
    reviewCount,
    approvedCount,
    scheduledCount,
    publishedCount,
    archivedCount,
    overridesCount,
    dbProjectsCount,
  ] = await Promise.all([
    safeCount(client.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'draft')),
    safeCount(client.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'review')),
    safeCount(client.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'approved')),
    safeCount(client.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'scheduled')),
    safeCount(client.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'published')),
    safeCount(client.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'archived')),
    safeCount(client.from('project_photo_overrides').select('slug', { count: 'exact', head: true })),
    safeCount(client.from('projects').select('id', { count: 'exact', head: true })),
  ]);

  const articlesTotal =
    draftCount +
    reviewCount +
    approvedCount +
    scheduledCount +
    publishedCount +
    archivedCount;

  let governance: AdminOverviewSnapshot['governance'] = null;
  let submissions: AdminOverviewSnapshot['submissions'] = null;

  if (canViewOperations) {
    const [
      pendingTestimonials,
      approvedTestimonials,
      activeJobOpenings,
      pendingQuotes,
      totalQuotes,
      pendingApplications,
      totalApplications,
      pendingFeedback,
      totalFeedback,
    ] = await Promise.all([
      safeCount(client.from('testimonials').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
      safeCount(client.from('testimonials').select('id', { count: 'exact', head: true }).eq('status', 'approved')),
      safeCount(client.from('job_openings').select('id', { count: 'exact', head: true }).eq('status', 'active')),
      safeCount(client.from('quote_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
      safeCount(client.from('quote_requests').select('id', { count: 'exact', head: true })),
      safeCount(client.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
      safeCount(client.from('job_applications').select('id', { count: 'exact', head: true })),
      safeCount(client.from('customer_feedback').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
      safeCount(client.from('customer_feedback').select('id', { count: 'exact', head: true })),
    ]);

    governance = {
      pendingTestimonials,
      approvedTestimonials,
      activeJobOpenings,
    };
    submissions = {
      pendingQuotes,
      totalQuotes,
      pendingApplications,
      totalApplications,
      pendingFeedback,
      totalFeedback,
    };
  }

  const pendingActions: OperationalPendingAction[] = [];

  if (reviewCount > 0) {
    pendingActions.push({
      id: 'articles-in-review',
      title: 'Articles Awaiting Editorial Review',
      detail: `${reviewCount} article${reviewCount === 1 ? ' is' : 's are'} submitted for review.`,
      count: reviewCount,
      href: '/admin/insights',
      ctaLabel: 'Manage Articles',
      priority: 'high',
    });
  }

  if (approvedCount > 0 && canViewOperations) {
    pendingActions.push({
      id: 'articles-approved',
      title: 'Approved Articles Ready to Publish',
      detail: `${approvedCount} approved article${approvedCount === 1 ? ' is' : 's are'} awaiting explicit publication.`,
      count: approvedCount,
      href: '/admin/insights',
      ctaLabel: 'Review for Publication',
      priority: 'high',
    });
  }

  if (draftCount > 0) {
    pendingActions.push({
      id: 'articles-draft',
      title: 'Active Editorial Drafts',
      detail: `${draftCount} draft article${draftCount === 1 ? '' : 's'} currently in authoring.`,
      count: draftCount,
      href: '/admin/insights',
      ctaLabel: 'Continue Drafting',
      priority: 'normal',
    });
  }

  if (submissions && submissions.pendingQuotes > 0) {
    pendingActions.push({
      id: 'pending-quotes',
      title: 'Pending Quote Requests',
      detail: `${submissions.pendingQuotes} client quote inquiry${submissions.pendingQuotes === 1 ? '' : 's'} awaiting review.`,
      count: submissions.pendingQuotes,
      href: '/admin/quotes',
      ctaLabel: 'View Quote Requests',
      priority: 'high',
    });
  }

  if (submissions && submissions.pendingApplications > 0) {
    pendingActions.push({
      id: 'pending-applications',
      title: 'Pending Job Applications',
      detail: `${submissions.pendingApplications} candidate submission${submissions.pendingApplications === 1 ? '' : 's'} awaiting review.`,
      count: submissions.pendingApplications,
      href: '/admin/applications',
      ctaLabel: 'View Applications',
      priority: 'high',
    });
  }

  if (submissions && submissions.pendingFeedback > 0) {
    pendingActions.push({
      id: 'pending-feedback',
      title: 'Pending Customer Feedback',
      detail: `${submissions.pendingFeedback} feedback submission${submissions.pendingFeedback === 1 ? '' : 's'} awaiting review.`,
      count: submissions.pendingFeedback,
      href: '/admin/feedback',
      ctaLabel: 'View Feedback',
      priority: 'normal',
    });
  }

  return {
    articles: {
      draft: draftCount,
      review: reviewCount,
      approved: approvedCount,
      scheduled: scheduledCount,
      published: publishedCount,
      archived: archivedCount,
      total: articlesTotal,
    },
    projects: {
      catalogCount: PROJECTS_DATA.length,
      overridesCount,
      dbProjectsCount,
    },
    governance,
    submissions,
    pendingActions,
    generatedAt: new Date().toISOString(),
  };
}
