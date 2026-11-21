'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FilePlus2,
  FolderKanban,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  APPROVED_INTERNAL_ROUTES,
  type AiStudioMode,
  type ApprovedInternalRoute,
  type ArticleWriterOutput,
  type ProjectDescriptionOutput,
  type SeoAssistantOutput,
  type SocialAssistantOutput,
} from '@/lib/cms/aiStudioValidators';
import type {
  AiProviderStatus,
  AiUsageRecord,
} from '@/lib/cms/aiStudioProvider';
import type { ArticleRecord } from '@/lib/cms/editorialService';
import type {
  AdminProjectListItem,
  DbProjectRecord,
} from '@/lib/cms/projectsService';
import type { StaffViewerIdentity } from './StaffAuthGateCards';

const MODE_TABS: Array<{
  id: AiStudioMode;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'article_writer',
    label: 'A. AI Article Writer',
    subtitle: 'Structured Tiptap article draft, SEO metadata, and internal links.',
  },
  {
    id: 'project_description',
    label: 'B. Project Description Assistant',
    subtitle: 'Case study overview, workmanship notes, captions, and image alt text.',
  },
  {
    id: 'seo_assistant',
    label: 'C. AI SEO Assistant',
    subtitle: 'SEO title, meta description, heading refinements, and link opportunities.',
  },
  {
    id: 'social_assistant',
    label: 'D. Social Content Assistant',
    subtitle: 'Editable drafts for Instagram, Facebook, LinkedIn, and showcase captions.',
  },
];

export function AdminAiStudioWorkspace({
  staff,
  initialProjects,
  initialArticles,
  initialProviderStatus,
  initialUsage,
}: {
  staff: StaffViewerIdentity;
  initialProjects: AdminProjectListItem[];
  initialArticles: Partial<ArticleRecord>[];
  initialProviderStatus: AiProviderStatus;
  initialUsage: AiUsageRecord;
}) {
  const [activeMode, setActiveMode] = useState<AiStudioMode>('article_writer');
  const [projects, setProjects] = useState<AdminProjectListItem[]>(
    initialProjects.filter((p): p is AdminProjectListItem & { id: string } => Boolean(p.id))
  );
  const [usage, setUsage] = useState<AiUsageRecord>(initialUsage);
  const [providerStatus] = useState<AiProviderStatus>(initialProviderStatus);
  const [providerAvailability, setProviderAvailability] = useState(
    initialProviderStatus.availabilityState
  );

  // Mode A: Article Writer inputs
  const [artTopic, setArtTopic] = useState(
    'Moisture Equilibration Before Mineral Silicate Coating'
  );
  const [artAudience, setArtAudience] = useState(
    'Adelaide architects, heritage specifiers, and residential estate owners'
  );
  const [artKeyword, setArtKeyword] = useState('mineral silicate masonry coating');
  const [artCategory, setArtCategory] = useState('Surface Engineering');
  const [artLength, setArtLength] = useState<
    'concise' | 'standard' | 'comprehensive'
  >('standard');
  const [artNotes, setArtNotes] = useState(
    'Substrate moisture readings must stabilize prior to potassium silicate priming. Raking afternoon light checks ensure planar uniformity across North Adelaide heritage masonry.'
  );

  // Mode B: Project Description inputs
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjects[0]?.id ?? ''
  );
  const [projTitle, setProjTitle] = useState(
    initialProjects[0]?.title ?? 'North Adelaide Villa Residence'
  );
  const [projLocation, setProjLocation] = useState(
    initialProjects[0]?.location ?? 'North Adelaide, SA'
  );
  const [projCategory, setProjCategory] = useState(
    initialProjects[0]?.category ?? 'Residential Commissions'
  );
  const [projWork, setProjWork] = useState(
    'Level 5 plaster preparation, dust-controlled orbital sanding, and heritage cornice restoration across primary gallery rooms.'
  );
  const [projFinishes, setProjFinishes] = useState(
    'Potassium Silicate // Level 5 Skim & 2K Satin Millwork'
  );
  const [projNotes, setProjNotes] = useState(
    'Client-approved specification emphasizing low-sheen mineral walls and crisp shadowline reveals.'
  );

  // Mode C: SEO Assistant inputs
  const [seoTargetType, setSeoTargetType] = useState<'article' | 'project'>(
    'article'
  );
  const [seoTargetId, setSeoTargetId] = useState<string>(
    initialArticles[0]?.id ?? ''
  );
  const [seoCurrentTitle, setSeoCurrentTitle] = useState(
    initialArticles[0]?.title ?? 'Achieving AS/NZS 2311 Level 5 Surface Standards'
  );
  const [seoCurrentSummary, setSeoCurrentSummary] = useState(
    initialArticles[0]?.excerpt ??
      'Technical analysis of Level 5 plaster preparation and raking light inspection tolerances for architectural interiors.'
  );
  const [seoKeyword, setSeoKeyword] = useState('Level 5 surface preparation Adelaide');
  const [seoContext, setSeoContext] = useState('Interior Architectural Painting');

  // Mode D: Social Assistant inputs
  const [socSubject, setSocSubject] = useState('North Adelaide Villa Restoration');
  const [socService, setSocService] = useState(
    'Historic & Heritage Conservation'
  );
  const [socLocation, setSocLocation] = useState('North Adelaide, South Australia');
  const [socHighlights, setSocHighlights] = useState(
    'Breathable mineral silicate facade treatment and hand-detailed 140-year-old plaster cornices.'
  );
  const [socCtaRoute, setSocCtaRoute] =
    useState<ApprovedInternalRoute>('/projects');

  // Outputs & editable draft state
  const [articleOut, setArticleOut] = useState<ArticleWriterOutput | null>(null);
  const [projectOut, setProjectOut] =
    useState<ProjectDescriptionOutput | null>(null);
  const [seoOut, setSeoOut] = useState<SeoAssistantOutput | null>(null);
  const [socialOut, setSocialOut] = useState<SocialAssistantOutput | null>(null);

  // Project field selection checkboxes
  const [applyFields, setApplyFields] = useState({
    description: true,
    short_description: true,
    challenges: true,
    finishes: true,
    seo_title: true,
    seo_description: true,
  });

  const [generating, setGenerating] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [savedArticleLink, setSavedArticleLink] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [banner, setBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    const match = projects.find((p) => p.id === id);
    if (match) {
      setProjTitle(match.title);
      setProjLocation(match.location);
      setProjCategory(match.category);
    }
  };

  const handleSelectSeoTarget = (type: 'article' | 'project', id: string) => {
    setSeoTargetType(type);
    setSeoTargetId(id);
    if (type === 'article') {
      const art = initialArticles.find((a) => a.id === id);
      if (art) {
        if (art.title) setSeoCurrentTitle(art.title);
        if (art.excerpt) setSeoCurrentSummary(art.excerpt);
        if (art.category) setSeoContext(art.category);
      }
    } else {
      const proj = projects.find((p) => p.id === id);
      if (proj) {
        setSeoCurrentTitle(proj.title);
        setSeoCurrentSummary(
          `${proj.title} in ${proj.location} — ${proj.category} architectural finishing case study.`
        );
        setSeoContext(proj.location);
      }
    }
  };

  const buildRequestPayload = () => {
    switch (activeMode) {
      case 'article_writer':
        return {
          mode: 'article_writer',
          topic: artTopic,
          targetAudience: artAudience,
          primaryKeyword: artKeyword,
          serviceCategory: artCategory,
          desiredLength: artLength,
          sourceNotes: artNotes,
        };
      case 'project_description':
        return {
          mode: 'project_description',
          projectId: selectedProjectId || null,
          title: projTitle,
          location: projLocation,
          category: projCategory,
          workPerformed: projWork,
          materialsAndFinishes: projFinishes,
          clientApprovedNotes: projNotes || null,
        };
      case 'seo_assistant':
        return {
          mode: 'seo_assistant',
          targetType: seoTargetType,
          targetId: seoTargetId || null,
          currentTitle: seoCurrentTitle,
          currentContentOrSummary: seoCurrentSummary,
          primaryKeyword: seoKeyword,
          locationOrService: seoContext || null,
        };
      case 'social_assistant':
        return {
          mode: 'social_assistant',
          subjectTitle: socSubject,
          serviceOrCategory: socService,
          location: socLocation,
          verifiedHighlights: socHighlights,
          callToActionRoute: socCtaRoute,
        };
    }
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (generating) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setBanner(null);
    setSavedArticleLink(null);

    try {
      const res = await fetch('/api/admin/ai-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(buildRequestPayload()),
      });
      const data = await res.json();
      if (!res.ok || !data.output) {
        if (providerStatus.apiKeyConfigured && res.status >= 500) {
          setProviderAvailability('unavailable');
        }
        setBanner({
          type: 'error',
          message: data.error ?? 'AI draft generation failed.',
        });
        return;
      }

      if (data.provider === 'gemini_rest') {
        setProviderAvailability('verified');
      } else if (data.provider === 'deterministic_fallback') {
        setProviderAvailability('deterministic_fallback');
      }

      if (data.usage) {
        setUsage(data.usage as AiUsageRecord);
      }

      const out = data.output;
      if (out.mode === 'article_writer') setArticleOut(out);
      if (out.mode === 'project_description') setProjectOut(out);
      if (out.mode === 'seo_assistant') setSeoOut(out);
      if (out.mode === 'social_assistant') setSocialOut(out);

      setBanner({
        type: 'success',
        message: 'Editable AI draft generated. Review all fields and verification items before saving.',
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setBanner({ type: 'error', message: 'Generation cancelled by staff.' });
      } else {
        setBanner({
          type: 'error',
          message: 'Network error communicating with AI Content Studio.',
        });
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const handleCancelGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  };

  const handleCopyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setBanner({ type: 'success', message: `${label} copied to clipboard.` });
    } catch {
      setBanner({ type: 'error', message: 'Unable to copy to clipboard.' });
    }
  };

  const handleSaveToArticleDraft = async () => {
    if (!articleOut || savingAction) return;
    setSavingAction(true);
    setBanner(null);
    try {
      const res = await fetch('/api/admin/ai-studio/save-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: articleOut.headline,
          subtitle: articleOut.subtitle,
          excerpt: articleOut.excerpt,
          slug: articleOut.slug,
          category: articleOut.category,
          seoTitle: articleOut.seoTitle,
          seoDescription: articleOut.seoDescription,
          bodySections: articleOut.bodySections,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.article) {
        setBanner({
          type: 'error',
          message: data.error ?? 'Failed to save unpublished article draft.',
        });
        return;
      }
      setSavedArticleLink({
        id: data.article.id,
        title: data.article.title,
      });
      setBanner({
        type: 'success',
        message:
          'Saved as an unpublished Article Draft. Open the article editor to attach media or submit for review.',
      });
    } catch {
      setBanner({
        type: 'error',
        message: 'Network error saving article draft.',
      });
    } finally {
      setSavingAction(false);
    }
  };

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) ?? null;
  const canApplyToSelectedProject =
    selectedProject &&
    Boolean(selectedProject.id) &&
    Boolean(selectedProject.updatedAt) &&
    (selectedProject.visibilityStatus === 'draft' ||
      staff.role === 'publisher' ||
      staff.role === 'admin');

  const handleApplyToProject = async () => {
    if (
      !projectOut ||
      !selectedProject ||
      !selectedProject.id ||
      !selectedProject.updatedAt ||
      !canApplyToSelectedProject ||
      savingAction
    ) {
      return;
    }
    setSavingAction(true);
    setBanner(null);
    try {
      const res = await fetch('/api/admin/ai-studio/apply-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          expected_updated_at: selectedProject.updatedAt,
          description: applyFields.description ? projectOut.projectOverview : null,
          short_description: applyFields.short_description
            ? projectOut.shortDescription
            : null,
          challenges: applyFields.challenges
            ? projectOut.workmanshipDescription
            : null,
          finishes: applyFields.finishes ? projectOut.finishesSummary : null,
          seo_title: applyFields.seo_title ? projectOut.seoTitle : null,
          seo_description: applyFields.seo_description
            ? projectOut.seoDescription
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.project) {
        setBanner({
          type: 'error',
          message:
            data.error ?? 'Failed to apply suggestions to the selected project.',
        });
        return;
      }
      const updated = data.project as DbProjectRecord;
      setProjects((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                title: updated.title,
                visibilityStatus: updated.visibility_status,
                updatedAt: updated.updated_at,
              }
            : item
        )
      );
      setBanner({
        type: 'success',
        message: `Applied selected suggestions to project "${updated.title}" (Visibility remains ${updated.visibility_status}).`,
      });
    } catch {
      setBanner({
        type: 'error',
        message: 'Network error applying suggestions to project.',
      });
    } finally {
      setSavingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Provider Status */}
      <div className="bg-white border border-warm-grey/60 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-bronze block mb-1">
            AI Drafting Assistant · Articles &amp; Portfolio Copy
          </span>
          <h2 className="font-serif text-2xl text-charcoal">
            AI Content Studio
          </h2>
          <p className="font-sans text-xs text-warm-grey-dark mt-1">
            Generates editable, fact-grounded drafts from verified Strovyn notes. Never publishes content automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <span className="px-3 py-1.5 border border-warm-grey/60 bg-ivory text-charcoal">
            Engine:{' '}
            {providerAvailability === 'verified'
              ? `Live Verified (${providerStatus.model})`
              : providerAvailability === 'configured_unverified'
                ? `Live Key Configured · Unverified (${providerStatus.model})`
                : providerAvailability === 'unavailable'
                  ? `Provider Unavailable (${providerStatus.model})`
                  : 'Deterministic Fallback (No Paid API Key)'}
          </span>
          <span className="px-3 py-1.5 border border-warm-grey/60 bg-white text-warm-grey-dark">
            Quota Today: {usage.staffRequestsToday} / {usage.staffLimit}
          </span>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {MODE_TABS.map((tab) => {
          const isActive = tab.id === activeMode;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveMode(tab.id);
                setBanner(null);
              }}
              className={`p-4 text-left border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-charcoal text-ivory border-charcoal'
                  : 'bg-white text-charcoal border-warm-grey/60 hover:border-charcoal'
              }`}
            >
              <span className="font-mono text-xs uppercase tracking-wider font-semibold block">
                {tab.label}
              </span>
              <span
                className={`font-sans text-[11px] block mt-1 ${
                  isActive ? 'text-ivory/80' : 'text-warm-grey-dark'
                }`}
              >
                {tab.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {banner && (
        <div
          role="alert"
          className={`border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <span>{banner.message}</span>
          {savedArticleLink && (
            <Link
              href={`/admin/insights/articles/${savedArticleLink.id}`}
              className="px-3 py-1.5 bg-charcoal text-ivory font-mono text-[10px] uppercase tracking-wider shrink-0"
            >
              Open Article Draft &rarr;
            </Link>
          )}
        </div>
      )}

      {/* Main Split Grid: Left Input Form, Right Editable Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Inputs */}
        <form
          onSubmit={handleGenerate}
          className="lg:col-span-5 bg-white border border-warm-grey/60 p-5 space-y-4"
        >
          <h3 className="font-mono text-xs uppercase tracking-widest text-charcoal border-b border-warm-grey/30 pb-2">
            Verified Source Inputs
          </h3>

          {activeMode === 'article_writer' && (
            <>
              <div>
                <label
                  htmlFor="ai-article-topic"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Article Topic *
                </label>
                <input
                  id="ai-article-topic"
                  required
                  value={artTopic}
                  onChange={(e) => setArtTopic(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="ai-article-keyword"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Primary SEO Keyword *
                </label>
                <input
                  id="ai-article-keyword"
                  required
                  value={artKeyword}
                  onChange={(e) => setArtKeyword(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ai-article-category"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Service / Category *
                  </label>
                  <input
                    id="ai-article-category"
                    required
                    value={artCategory}
                    onChange={(e) => setArtCategory(e.target.value)}
                    className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ai-article-length"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Desired Length
                  </label>
                  <select
                    id="ai-article-length"
                    value={artLength}
                    onChange={(e) =>
                      setArtLength(
                        e.target.value as 'concise' | 'standard' | 'comprehensive'
                      )
                    }
                    className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                  >
                    <option value="concise">Concise (2 sections)</option>
                    <option value="standard">Standard (3 sections)</option>
                    <option value="comprehensive">Comprehensive (4 sections)</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="ai-article-audience"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Target Audience
                </label>
                <input
                  id="ai-article-audience"
                  value={artAudience}
                  onChange={(e) => setArtAudience(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="ai-article-notes"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Verified Technical Source Notes *
                </label>
                <textarea
                  id="ai-article-notes"
                  required
                  rows={4}
                  value={artNotes}
                  onChange={(e) => setArtNotes(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {activeMode === 'project_description' && (
            <>
              <div>
                <label
                  htmlFor="ai-project-select"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Target Portfolio Project
                </label>
                <select
                  id="ai-project-select"
                  value={selectedProjectId}
                  onChange={(e) => handleSelectProject(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                >
                  {projects.map((p) => (
                    <option key={p.id ?? p.slug} value={p.id ?? ''}>
                      {p.title} ({p.visibilityStatus})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ai-project-title"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Project Title *
                  </label>
                  <input
                    id="ai-project-title"
                    required
                    value={projTitle}
                    onChange={(e) => setProjTitle(e.target.value)}
                    className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ai-project-location"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Location *
                  </label>
                  <input
                    id="ai-project-location"
                    required
                    value={projLocation}
                    onChange={(e) => setProjLocation(e.target.value)}
                    className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="ai-project-finishes"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Materials &amp; Finishes Schedule *
                </label>
                <input
                  id="ai-project-finishes"
                  required
                  value={projFinishes}
                  onChange={(e) => setProjFinishes(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="ai-project-work"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Verified Work Performed *
                </label>
                <textarea
                  id="ai-project-work"
                  required
                  rows={3}
                  value={projWork}
                  onChange={(e) => setProjWork(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="ai-project-notes"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Client-Approved Notes (Optional)
                </label>
                <textarea
                  id="ai-project-notes"
                  rows={2}
                  value={projNotes}
                  onChange={(e) => setProjNotes(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {activeMode === 'seo_assistant' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ai-seo-target-type"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Content Type
                  </label>
                  <select
                    id="ai-seo-target-type"
                    value={seoTargetType}
                    onChange={(e) => {
                      const nextType = e.target.value as 'article' | 'project';
                      const firstId =
                        nextType === 'article'
                          ? initialArticles[0]?.id ?? ''
                          : projects[0]?.id ?? '';
                      handleSelectSeoTarget(nextType, firstId);
                    }}
                    className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                  >
                    <option value="article">Article</option>
                    <option value="project">Portfolio Project</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ai-seo-target-record"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Load Existing Record
                  </label>
                  <select
                    id="ai-seo-target-record"
                    value={seoTargetId}
                    onChange={(e) =>
                      handleSelectSeoTarget(seoTargetType, e.target.value)
                    }
                    className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                  >
                    {seoTargetType === 'article'
                      ? initialArticles.map((a, idx) => (
                          <option key={a.id ?? idx} value={a.id ?? ''}>
                            {a.title ?? 'Untitled Article'}
                          </option>
                        ))
                      : projects.map((p) => (
                          <option key={p.id ?? p.slug} value={p.id ?? ''}>
                            {p.title}
                          </option>
                        ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="ai-seo-title"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Current Title *
                </label>
                <input
                  id="ai-seo-title"
                  required
                  value={seoCurrentTitle}
                  onChange={(e) => setSeoCurrentTitle(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="ai-seo-keyword"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Primary SEO Keyword *
                </label>
                <input
                  id="ai-seo-keyword"
                  required
                  value={seoKeyword}
                  onChange={(e) => setSeoKeyword(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="ai-seo-summary"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Current Excerpt / Summary *
                </label>
                <textarea
                  id="ai-seo-summary"
                  required
                  rows={4}
                  value={seoCurrentSummary}
                  onChange={(e) => setSeoCurrentSummary(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {activeMode === 'social_assistant' && (
            <>
              <div>
                <label
                  htmlFor="ai-social-subject"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Subject / Project Title *
                </label>
                <input
                  id="ai-social-subject"
                  required
                  value={socSubject}
                  onChange={(e) => setSocSubject(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ai-social-service"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Service / Category *
                  </label>
                  <input
                    id="ai-social-service"
                    required
                    value={socService}
                    onChange={(e) => setSocService(e.target.value)}
                    className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ai-social-location"
                    className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                  >
                    Location *
                  </label>
                  <input
                    id="ai-social-location"
                    required
                    value={socLocation}
                    onChange={(e) => setSocLocation(e.target.value)}
                    className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="ai-social-cta"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Approved Website Call-to-Action Route
                </label>
                <select
                  id="ai-social-cta"
                  value={socCtaRoute}
                  onChange={(e) =>
                    setSocCtaRoute(e.target.value as ApprovedInternalRoute)
                  }
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm font-mono"
                >
                  {APPROVED_INTERNAL_ROUTES.map((route) => (
                    <option key={route} value={route}>
                      {route}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="ai-social-highlights"
                  className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
                >
                  Verified Craftsmanship Highlights *
                </label>
                <textarea
                  id="ai-social-highlights"
                  required
                  rows={4}
                  value={socHighlights}
                  onChange={(e) => setSocHighlights(e.target.value)}
                  className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          <div className="pt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={generating || savingAction}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-charcoal text-ivory font-mono text-xs uppercase tracking-wider hover:bg-bronze disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{generating ? 'Generating Draft...' : 'Generate Draft'}</span>
            </button>

            {generating && (
              <button
                type="button"
                onClick={handleCancelGeneration}
                className="inline-flex items-center gap-1 px-3 py-2.5 border border-red-400 bg-red-50 text-red-900 font-mono text-xs uppercase tracking-wider cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </form>

        {/* Right: Editable Output Workspace */}
        <div className="lg:col-span-7 bg-white border border-warm-grey/60 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-warm-grey/30 pb-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-charcoal">
              Editable Draft Output &amp; Verification Checklist
            </h3>
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerate()}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-charcoal hover:text-bronze cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              <span>Regenerate</span>
            </button>
          </div>

          {/* Mode A Output */}
          {activeMode === 'article_writer' && (
            <>
              {!articleOut ? (
                <p className="font-sans text-xs text-warm-grey-dark py-8">
                  Enter an article topic and verified technical notes on the left, then click Generate Draft.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                        Suggested Headline
                      </label>
                      <input
                        value={articleOut.headline}
                        onChange={(e) =>
                          setArticleOut({ ...articleOut, headline: e.target.value })
                        }
                        className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                        Suggested Slug
                      </label>
                      <input
                        value={articleOut.slug}
                        onChange={(e) =>
                          setArticleOut({ ...articleOut, slug: e.target.value })
                        }
                        className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                      Subtitle
                    </label>
                    <input
                      value={articleOut.subtitle}
                      onChange={(e) =>
                        setArticleOut({ ...articleOut, subtitle: e.target.value })
                      }
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                      Excerpt
                    </label>
                    <textarea
                      rows={2}
                      value={articleOut.excerpt}
                      onChange={(e) =>
                        setArticleOut({ ...articleOut, excerpt: e.target.value })
                      }
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                        SEO Title ({articleOut.seoTitle.length}/70)
                      </label>
                      <input
                        value={articleOut.seoTitle}
                        onChange={(e) =>
                          setArticleOut({ ...articleOut, seoTitle: e.target.value })
                        }
                        className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                        SEO Description ({articleOut.seoDescription.length}/160)
                      </label>
                      <input
                        value={articleOut.seoDescription}
                        onChange={(e) =>
                          setArticleOut({
                            ...articleOut,
                            seoDescription: e.target.value,
                          })
                        }
                        className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
                      Structured Tiptap Article Sections (Editable)
                    </span>
                    {articleOut.bodySections.map((sec, sIdx) => (
                      <div
                        key={sIdx}
                        className="border border-warm-grey/50 bg-ivory p-3 space-y-2"
                      >
                        <input
                          value={sec.heading}
                          onChange={(e) => {
                            const next = [...articleOut.bodySections];
                            next[sIdx] = { ...sec, heading: e.target.value };
                            setArticleOut({ ...articleOut, bodySections: next });
                          }}
                          className="w-full border border-warm-grey/60 bg-white px-2.5 py-1.5 text-xs font-semibold"
                        />
                        <textarea
                          rows={3}
                          value={sec.paragraphs.join('\n\n')}
                          onChange={(e) => {
                            const next = [...articleOut.bodySections];
                            next[sIdx] = {
                              ...sec,
                              paragraphs: e.target.value
                                .split(/\n{2,}/)
                                .map((p) => p.trim())
                                .filter(Boolean),
                            };
                            setArticleOut({ ...articleOut, bodySections: next });
                          }}
                          className="w-full border border-warm-grey/60 bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="border border-warm-grey/40 bg-ivory p-3 space-y-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-charcoal font-semibold block">
                      Approved Internal Links
                    </span>
                    {articleOut.suggestedInternalLinks.map((lnk, idx) => (
                      <div key={idx} className="text-xs font-sans">
                        <code className="font-mono text-bronze">{lnk.href}</code> —{' '}
                        <strong>{lnk.label}</strong>: {lnk.reason}
                      </div>
                    ))}
                  </div>

                  <div className="border border-amber-300 bg-amber-50/60 p-4 space-y-2">
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-amber-900 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Required Verification Before Publication</span>
                    </div>
                    <ul className="list-disc list-inside text-xs font-sans text-amber-950 space-y-1">
                      {articleOut.verificationChecklist.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopyText(
                          articleOut.bodySections
                            .map((s) => `## ${s.heading}\n\n${s.paragraphs.join('\n\n')}`)
                            .join('\n\n'),
                          'Article draft text'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-warm-grey/60 bg-ivory text-charcoal font-mono text-[11px] uppercase tracking-wider cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Copy Markdown</span>
                    </button>

                    <button
                      type="button"
                      disabled={savingAction}
                      onClick={() => void handleSaveToArticleDraft()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-charcoal text-ivory font-mono text-xs uppercase tracking-wider hover:bg-bronze disabled:opacity-50 cursor-pointer"
                    >
                      <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {savingAction ? 'Saving Draft...' : 'Save to Article Draft'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Mode B Output */}
          {activeMode === 'project_description' && (
            <>
              {!projectOut ? (
                <p className="font-sans text-xs text-warm-grey-dark py-8">
                  Select a portfolio project and enter verified scope details on the left, then click Generate Draft.
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                      <input
                        type="checkbox"
                        checked={applyFields.description}
                        onChange={(e) =>
                          setApplyFields({
                            ...applyFields,
                            description: e.target.checked,
                          })
                        }
                      />
                      <span>Project Overview (Apply to Case Study Description)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={projectOut.projectOverview}
                      onChange={(e) =>
                        setProjectOut({
                          ...projectOut,
                          projectOverview: e.target.value,
                        })
                      }
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                      <input
                        type="checkbox"
                        checked={applyFields.short_description}
                        onChange={(e) =>
                          setApplyFields({
                            ...applyFields,
                            short_description: e.target.checked,
                          })
                        }
                      />
                      <span>Short Summary (Apply to Card Summary)</span>
                    </label>
                    <input
                      value={projectOut.shortDescription}
                      onChange={(e) =>
                        setProjectOut({
                          ...projectOut,
                          shortDescription: e.target.value,
                        })
                      }
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                      <input
                        type="checkbox"
                        checked={applyFields.challenges}
                        onChange={(e) =>
                          setApplyFields({
                            ...applyFields,
                            challenges: e.target.checked,
                          })
                        }
                      />
                      <span>Workmanship &amp; Technical Execution</span>
                    </label>
                    <textarea
                      rows={3}
                      value={projectOut.workmanshipDescription}
                      onChange={(e) =>
                        setProjectOut({
                          ...projectOut,
                          workmanshipDescription: e.target.value,
                        })
                      }
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-2 font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                        <input
                          type="checkbox"
                          checked={applyFields.seo_title}
                          onChange={(e) =>
                            setApplyFields({
                              ...applyFields,
                              seo_title: e.target.checked,
                            })
                          }
                        />
                        <span>SEO Title</span>
                      </label>
                      <input
                        value={projectOut.seoTitle}
                        onChange={(e) =>
                          setProjectOut({ ...projectOut, seoTitle: e.target.value })
                        }
                        className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                        <input
                          type="checkbox"
                          checked={applyFields.seo_description}
                          onChange={(e) =>
                            setApplyFields({
                              ...applyFields,
                              seo_description: e.target.checked,
                            })
                          }
                        />
                        <span>SEO Description</span>
                      </label>
                      <input
                        value={projectOut.seoDescription}
                        onChange={(e) =>
                          setProjectOut({
                            ...projectOut,
                            seoDescription: e.target.value,
                          })
                        }
                        className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="border border-warm-grey/40 bg-ivory p-3 space-y-2 text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-charcoal font-semibold block">
                      Before / After Captions &amp; Image Alt-Text Suggestions
                    </span>
                    <p>
                      <strong>Before:</strong>{' '}
                      {projectOut.beforeAfterCaptions.beforeCaption}
                    </p>
                    <p>
                      <strong>After:</strong>{' '}
                      {projectOut.beforeAfterCaptions.afterCaption}
                    </p>
                    <ul className="list-disc list-inside text-charcoal/85">
                      {projectOut.imageAltSuggestions.map((alt, i) => (
                        <li key={i}>{alt}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="border border-amber-300 bg-amber-50/60 p-4 space-y-2">
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-amber-900 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Required Verification Before Publication</span>
                    </div>
                    <ul className="list-disc list-inside text-xs font-sans text-amber-950 space-y-1">
                      {projectOut.verificationChecklist.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    {!canApplyToSelectedProject ? (
                      <span className="font-sans text-xs text-amber-800">
                        Editors can only apply suggestions directly to draft projects. Publishers and Administrators can apply suggestions to published projects.
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-warm-grey-dark">
                        Target: {selectedProject?.title} ({selectedProject?.visibilityStatus})
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={!canApplyToSelectedProject || savingAction}
                      onClick={() => void handleApplyToProject()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-charcoal text-ivory font-mono text-xs uppercase tracking-wider hover:bg-bronze disabled:opacity-40 cursor-pointer"
                    >
                      <FolderKanban className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {savingAction
                          ? 'Applying...'
                          : 'Apply Suggestions to Project'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Mode C Output */}
          {activeMode === 'seo_assistant' && (
            <>
              {!seoOut ? (
                <p className="font-sans text-xs text-warm-grey-dark py-8">
                  Select an article or project on the left and click Generate Draft to produce SEO recommendations.
                </p>
              ) : (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                      Suggested SEO Title ({seoOut.seoTitle.length}/70)
                    </label>
                    <input
                      value={seoOut.seoTitle}
                      onChange={(e) =>
                        setSeoOut({ ...seoOut, seoTitle: e.target.value })
                      }
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase text-warm-grey-dark mb-1">
                      Suggested Meta Description ({seoOut.metaDescription.length}/160)
                    </label>
                    <textarea
                      rows={2}
                      value={seoOut.metaDescription}
                      onChange={(e) =>
                        setSeoOut({ ...seoOut, metaDescription: e.target.value })
                      }
                      className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="border border-warm-grey/40 bg-ivory p-3 space-y-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-charcoal font-semibold block">
                      Heading &amp; Readability Improvements
                    </span>
                    <ul className="list-disc list-inside space-y-1">
                      {seoOut.headingImprovements.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                      {seoOut.readabilityImprovements.map((r, i) => (
                        <li key={`r-${i}`}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="border border-warm-grey/40 bg-ivory p-3 space-y-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-charcoal font-semibold block">
                      Internal Linking Opportunities
                    </span>
                    {seoOut.internalLinkingOpportunities.map((lnk, idx) => (
                      <div key={idx}>
                        <code className="font-mono text-bronze">{lnk.href}</code> —{' '}
                        <strong>{lnk.label}</strong>: {lnk.reason}
                      </div>
                    ))}
                  </div>

                  <div className="border border-amber-300 bg-amber-50/60 p-4 space-y-2">
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-amber-900 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Missing Information Requiring Verification</span>
                    </div>
                    <ul className="list-disc list-inside text-amber-950 space-y-1">
                      {seoOut.missingVerificationItems.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Mode D Output */}
          {activeMode === 'social_assistant' && (
            <>
              {!socialOut ? (
                <p className="font-sans text-xs text-warm-grey-dark py-8">
                  Enter verified project or service highlights on the left and click Generate Draft.
                </p>
              ) : (
                <div className="space-y-4">
                  {[
                    {
                      key: 'instagramCaption' as const,
                      label: 'Instagram Caption',
                      value: socialOut.instagramCaption,
                    },
                    {
                      key: 'facebookPost' as const,
                      label: 'Facebook Post',
                      value: socialOut.facebookPost,
                    },
                    {
                      key: 'linkedinUpdate' as const,
                      label: 'LinkedIn Update',
                      value: socialOut.linkedinUpdate,
                    },
                    {
                      key: 'projectShowcaseCaption' as const,
                      label: 'Project Showcase Caption',
                      value: socialOut.projectShowcaseCaption,
                    },
                  ].map((field) => (
                    <div key={field.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
                          {field.label}
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyText(field.value, field.label)
                          }
                          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-bronze hover:text-charcoal cursor-pointer"
                        >
                          <Copy className="w-3 h-3" aria-hidden="true" />
                          <span>Copy</span>
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={field.value}
                        onChange={(e) =>
                          setSocialOut({
                            ...socialOut,
                            [field.key]: e.target.value,
                          })
                        }
                        className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-xs"
                      />
                    </div>
                  ))}

                  <div className="border border-amber-300 bg-amber-50/60 p-4 space-y-2">
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-amber-900 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Manual Verification &amp; External Posting Policy</span>
                    </div>
                    <ul className="list-disc list-inside text-xs font-sans text-amber-950 space-y-1">
                      {socialOut.verificationChecklist.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
