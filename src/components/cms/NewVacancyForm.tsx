'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  EMPLOYMENT_TYPES,
  type VacancyEmploymentType,
} from '@/lib/cms/careerValidators';

export function NewVacancyForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [department, setDepartment] = useState('Architectural Finishing');
  const [employmentType, setEmploymentType] =
    useState<VacancyEmploymentType>('Full-time');
  const [location, setLocation] = useState('Adelaide, South Australia');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/careers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug: slug.trim() || undefined,
          department,
          employment_type: employmentType,
          location,
          application_deadline: deadline ? new Date(deadline).toISOString() : null,
          description,
          requirements: requirements || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.vacancy) {
        setErrorMsg(data.error ?? 'Failed to create vacancy draft.');
        return;
      }
      router.push(`/admin/careers/${data.vacancy.id}`);
      router.refresh();
    } catch {
      setErrorMsg('Network error while creating vacancy draft.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-warm-grey/60 p-5 flex items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/careers"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-warm-grey-dark hover:text-charcoal mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Careers Queue</span>
          </Link>
          <h2 className="font-serif text-2xl text-charcoal">Create New Vacancy Draft</h2>
          <p className="font-sans text-xs text-warm-grey-dark mt-1">
            New roles always start as unpublished drafts until reviewed and published.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-warm-grey/60 p-6 space-y-5"
      >
        {errorMsg && (
          <div
            role="alert"
            className="p-4 bg-red-50 border border-red-300 text-red-900 text-xs font-sans"
          >
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="new-vacancy-title"
              className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
            >
              Vacancy Title *
            </label>
            <input
              id="new-vacancy-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Architectural Painter"
              className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="new-vacancy-slug"
              className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
            >
              URL Identifier / Slug (Optional)
            </label>
            <input
              id="new-vacancy-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Auto-generated from title if omitted"
              className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="new-vacancy-department"
              className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
            >
              Department / Category *
            </label>
            <input
              id="new-vacancy-department"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="new-vacancy-employment-type"
              className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
            >
              Employment Type *
            </label>
            <select
              id="new-vacancy-employment-type"
              value={employmentType}
              onChange={(e) =>
                setEmploymentType(e.target.value as VacancyEmploymentType)
              }
              className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
            >
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="new-vacancy-location"
              className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
            >
              Work Location *
            </label>
            <input
              id="new-vacancy-location"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="new-vacancy-deadline"
              className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
            >
              Application Deadline (Optional)
            </label>
            <input
              id="new-vacancy-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="new-vacancy-description"
            className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
          >
            Job Description *
          </label>
          <textarea
            id="new-vacancy-description"
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the role scope, site standards, and responsibilities..."
            className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="new-vacancy-requirements"
            className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
          >
            Key Prerequisites &amp; Requirements (One per line)
          </label>
          <textarea
            id="new-vacancy-requirements"
            rows={4}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="Proven Level 5 preparation experience&#10;Valid White Card and SA driver licence"
            className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/careers"
            className="px-4 py-2 border border-warm-grey/60 bg-ivory text-charcoal font-mono text-[11px] uppercase tracking-wider"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2 bg-charcoal text-ivory font-mono text-[11px] uppercase tracking-wider hover:bg-bronze disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'Creating...' : 'Create Vacancy Draft'}
          </button>
        </div>
      </form>
    </div>
  );
}
