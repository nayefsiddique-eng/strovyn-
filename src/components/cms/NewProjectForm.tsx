'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import {
  PROJECT_CATEGORIES,
  PROJECT_LIFECYCLES,
  type ProjectCategory,
  type ProjectLifecycle,
} from '@/lib/cms/projectValidators';
import { deriveAutoSlug } from '@/lib/cms/editorHelpers';

export function NewProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [category, setCategory] = useState<ProjectCategory>(PROJECT_CATEGORIES[0]);
  const [lifecycle, setLifecycle] = useState<ProjectLifecycle>('Completed');
  const [location, setLocation] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [architect, setArchitect] = useState('');
  const [builder, setBuilder] = useState('');
  const [finishes, setFinishes] = useState('');
  const [sheenLevels, setSheenLevels] = useState('');
  const [challenges, setChallenges] = useState('');
  const [scopeText, setScopeText] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugEditedManually) {
      setSlug(deriveAutoSlug(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    if (title.trim().length < 4) {
      setErrorMsg('Project title must be at least 4 characters.');
      return;
    }
    if (location.trim().length < 3) {
      setErrorMsg('Project location is required.');
      return;
    }
    if (description.trim().length < 20) {
      setErrorMsg('Project description must be at least 20 characters.');
      return;
    }

    const scopeItems = scopeText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 3);

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim() || undefined,
          category,
          status: lifecycle,
          visibility_status: 'draft',
          location: location.trim(),
          year: year.trim() || null,
          short_description: shortDescription.trim() || null,
          description: description.trim(),
          architect: architect.trim() || null,
          builder: builder.trim() || null,
          finishes: finishes.trim() || null,
          sheen_levels: sheenLevels.trim() || null,
          challenges: challenges.trim() || null,
          scope: scopeItems.length > 0 ? scopeItems : undefined,
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | { success: true; project: { id: string } }
        | { success: false; error?: string }
        | null;

      if (!res.ok || !json || !json.success) {
        setErrorMsg((json && !json.success && json.error) || `Unable to create project (HTTP ${res.status}).`);
        return;
      }

      router.push(`/admin/projects/${json.project.id}`);
      router.refresh();
    } catch {
      setErrorMsg('Network error creating project draft.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-warm-grey/60 p-6 flex items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/projects"
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-charcoal hover:text-bronze mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Projects</span>
          </Link>
          <h1 className="type-section-title text-3xl text-charcoal">
            New Portfolio Project Draft
          </h1>
          <p className="font-sans text-xs text-warm-grey-dark mt-1">
            Projects start strictly in Draft visibility. Add gallery &amp; before/after photos on the next screen before publishing.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="bg-white border border-brand-red/60 px-4 py-3 text-xs font-sans text-brand-red-dark">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-warm-grey/60 p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="proj-new-title" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
              Project Title *
            </label>
            <input
              id="proj-new-title"
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Medindie Bluestone Residence"
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal"
            />
          </div>

          <div>
            <label htmlFor="proj-new-slug" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
              URL Slug (kebab-case)
            </label>
            <input
              id="proj-new-slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugEditedManually(true);
                setSlug(e.target.value.toLowerCase());
              }}
              placeholder="medindie-bluestone-residence"
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-xs font-mono text-charcoal"
            />
          </div>

          <div>
            <label htmlFor="proj-new-category" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
              Category *
            </label>
            <select
              id="proj-new-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ProjectCategory)}
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal"
            >
              {PROJECT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="proj-new-lifecycle" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
              Lifecycle Stage *
            </label>
            <select
              id="proj-new-lifecycle"
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value as ProjectLifecycle)}
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal"
            >
              {PROJECT_LIFECYCLES.map((lc) => (
                <option key={lc} value={lc}>{lc}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="proj-new-location" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
              Location *
            </label>
            <input
              id="proj-new-location"
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Medindie, Adelaide SA"
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal"
            />
          </div>

          <div>
            <label htmlFor="proj-new-year" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
              Completion Year (4 digits)
            </label>
            <input
              id="proj-new-year"
              type="text"
              maxLength={4}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-mono text-charcoal"
            />
          </div>
        </div>

        <div>
          <label htmlFor="proj-new-short" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
            Short Summary (optional)
          </label>
          <input
            id="proj-new-short"
            type="text"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="Concise one-line architectural summary"
            className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal"
          />
        </div>

        <div>
          <label htmlFor="proj-new-desc" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
            Full Case-Study Description * (min 20 characters)
          </label>
          <textarea
            id="proj-new-desc"
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="proj-new-architect" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
              Architect / Specifier
            </label>
            <input
              id="proj-new-architect"
              type="text"
              value={architect}
              onChange={(e) => setArchitect(e.target.value)}
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal"
            />
          </div>
          <div>
            <label htmlFor="proj-new-builder" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
              Builder
            </label>
            <input
              id="proj-new-builder"
              type="text"
              value={builder}
              onChange={(e) => setBuilder(e.target.value)}
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal"
            />
          </div>
          <div>
            <label htmlFor="proj-new-finishes" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
              Finishes Specification
            </label>
            <input
              id="proj-new-finishes"
              type="text"
              value={finishes}
              onChange={(e) => setFinishes(e.target.value)}
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal"
            />
          </div>
          <div>
            <label htmlFor="proj-new-sheen" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
              Sheen Levels
            </label>
            <input
              id="proj-new-sheen"
              type="text"
              value={sheenLevels}
              onChange={(e) => setSheenLevels(e.target.value)}
              className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal"
            />
          </div>
        </div>

        <div>
          <label htmlFor="proj-new-challenges" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
            Substrate Challenges &amp; Approach
          </label>
          <textarea
            id="proj-new-challenges"
            rows={2}
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
            className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal"
          />
        </div>

        <div>
          <label htmlFor="proj-new-scope" className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
            Scope Items (one item per line)
          </label>
          <textarea
            id="proj-new-scope"
            rows={3}
            value={scopeText}
            onChange={(e) => setScopeText(e.target.value)}
            placeholder="Level 5 skim coat across main living ceiling&#10;Two-pack polyurethane joinery lacquer"
            className="w-full bg-ivory-light border border-warm-grey px-3 py-2 text-sm font-sans text-charcoal"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-3 border-t border-warm-grey/40">
          <Link
            href="/admin/projects"
            className="px-4 py-2 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-charcoal text-ivory hover:bg-bronze transition-colors text-xs font-mono uppercase tracking-wider cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isSubmitting ? 'Creating Draft...' : 'Create Project Draft'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
