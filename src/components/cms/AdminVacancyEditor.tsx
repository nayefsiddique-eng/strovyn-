'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  EMPLOYMENT_TYPES,
  type VacancyEmploymentType,
  type VacancyPublicationStatus,
} from '@/lib/cms/careerValidators';
import type { VacancyRecord } from '@/lib/cms/careersService';
import type { StaffViewerIdentity } from './StaffAuthGateCards';

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function isDeadlineInPast(iso: string | null): boolean {
  if (!iso) return false;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && ms <= Date.now();
}

export function AdminVacancyEditor({
  staff,
  initialVacancy,
}: {
  staff: StaffViewerIdentity;
  initialVacancy: VacancyRecord;
}) {
  const router = useRouter();
  const canPublishAndToggle =
    staff.role === 'publisher' || staff.role === 'admin';

  const [vacancy, setVacancy] = useState<VacancyRecord>(initialVacancy);
  const [title, setTitle] = useState(initialVacancy.title);
  const [slug, setSlug] = useState(initialVacancy.slug);
  const [department, setDepartment] = useState(initialVacancy.department);
  const [employmentType, setEmploymentType] = useState<VacancyEmploymentType>(
    (EMPLOYMENT_TYPES.includes(
      initialVacancy.employment_type as VacancyEmploymentType
    )
      ? initialVacancy.employment_type
      : 'Full-time') as VacancyEmploymentType
  );
  const [location, setLocation] = useState(initialVacancy.location);
  const [deadline, setDeadline] = useState(
    toDateInputValue(initialVacancy.application_deadline)
  );
  const [description, setDescription] = useState(initialVacancy.description);
  const [requirements, setRequirements] = useState(
    initialVacancy.requirements ?? ''
  );

  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflictLatest, setConflictLatest] = useState<VacancyRecord | null>(
    null
  );
  const [banner, setBanner] = useState<{
    type: 'success' | 'error' | 'conflict';
    message: string;
  } | null>(null);

  const canEdit =
    vacancy.publication_status === 'draft' ? true : canPublishAndToggle;

  const isDirty =
    title !== vacancy.title ||
    slug !== vacancy.slug ||
    department !== vacancy.department ||
    employmentType !== vacancy.employment_type ||
    location !== vacancy.location ||
    deadline !== toDateInputValue(vacancy.application_deadline) ||
    description !== vacancy.description ||
    requirements !== (vacancy.requirements ?? '');

  const syncFromRecord = (rec: VacancyRecord) => {
    setVacancy(rec);
    setTitle(rec.title);
    setSlug(rec.slug);
    setDepartment(rec.department);
    setEmploymentType(
      (EMPLOYMENT_TYPES.includes(rec.employment_type as VacancyEmploymentType)
        ? rec.employment_type
        : 'Full-time') as VacancyEmploymentType
    );
    setLocation(rec.location);
    setDeadline(toDateInputValue(rec.application_deadline));
    setDescription(rec.description);
    setRequirements(rec.requirements ?? '');
    setPublishConfirmed(false);
    setConflictLatest(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !canEdit) return;
    setBusy(true);
    setBanner(null);
    setConflictLatest(null);
    try {
      const deadlineIso = deadline
        ? new Date(`${deadline}T23:59:59.000Z`).toISOString()
        : null;
      const res = await fetch(`/api/admin/careers/${vacancy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_updated_at: vacancy.updated_at,
          title,
          slug,
          department,
          employment_type: employmentType,
          location,
          application_deadline: deadlineIso,
          description,
          requirements: requirements || null,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        const latestRes = await fetch(`/api/admin/careers/${vacancy.id}`, {
          cache: 'no-store',
        });
        const latestData = await latestRes.json().catch(() => null);
        if (latestRes.ok && latestData?.vacancy) {
          setConflictLatest(latestData.vacancy as VacancyRecord);
        }
        setBanner({
          type: 'conflict',
          message:
            data.error ??
            'This vacancy was updated elsewhere. Your local edits are preserved.',
        });
        return;
      }
      if (!res.ok || !data.vacancy) {
        setBanner({
          type: 'error',
          message: data.error ?? 'Failed to save vacancy changes.',
        });
        return;
      }
      syncFromRecord(data.vacancy as VacancyRecord);
      setBanner({ type: 'success', message: 'Vacancy changes saved cleanly.' });
      router.refresh();
    } catch {
      setBanner({ type: 'error', message: 'Network error while saving vacancy.' });
    } finally {
      setBusy(false);
    }
  };

  const handleRebaseTimestamp = () => {
    if (!conflictLatest) return;
    setVacancy(conflictLatest);
    setConflictLatest(null);
    setBanner({
      type: 'success',
      message:
        'Timestamp rebased to latest server version. Click Save Changes to persist your local edits.',
    });
  };

  const handlePublicationChange = async (
    targetStatus: VacancyPublicationStatus
  ) => {
    if (busy || !canPublishAndToggle) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/admin/careers/${vacancy.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_updated_at: vacancy.updated_at,
          publication_status: targetStatus,
          confirmed: targetStatus === 'published' ? publishConfirmed : true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.vacancy) {
        setBanner({
          type: res.status === 409 ? 'conflict' : 'error',
          message: data.error ?? 'Failed to update publication status.',
        });
        return;
      }
      syncFromRecord(data.vacancy as VacancyRecord);
      setBanner({
        type: 'success',
        message: `Vacancy publication status updated to "${targetStatus}".`,
      });
      router.refresh();
    } catch {
      setBanner({
        type: 'error',
        message: 'Network error updating publication status.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleOpenState = async (nextOpen: boolean) => {
    if (busy || !canPublishAndToggle) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/admin/careers/${vacancy.id}/open-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_updated_at: vacancy.updated_at,
          is_open: nextOpen,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.vacancy) {
        setBanner({
          type: res.status === 409 ? 'conflict' : 'error',
          message: data.error ?? 'Failed to update open/closed state.',
        });
        return;
      }
      syncFromRecord(data.vacancy as VacancyRecord);
      setBanner({
        type: 'success',
        message: nextOpen
          ? 'Vacancy reopened for candidate applications.'
          : 'Vacancy closed. New public applications for this role are now blocked.',
      });
      router.refresh();
    } catch {
      setBanner({
        type: 'error',
        message: 'Network error updating vacancy open state.',
      });
    } finally {
      setBusy(false);
    }
  };

  const expired = isDeadlineInPast(vacancy.application_deadline);

  return (
    <div className="space-y-6">
      {/* Sticky Top Action Bar */}
      <div className="bg-white border border-warm-grey/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/careers"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-charcoal hover:text-bronze"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Careers</span>
          </Link>
          <span className="text-warm-grey">|</span>
          <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border border-warm-grey/60 bg-ivory text-charcoal">
            Publication: {vacancy.publication_status}
          </span>
          <span
            className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border ${
              vacancy.is_open && !expired
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-red-50 text-red-800 border-red-300'
            }`}
          >
            {expired
              ? 'Deadline Expired'
              : vacancy.is_open
                ? 'Open'
                : 'Closed'}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-warm-grey/40 text-warm-grey-dark">
            {isDirty ? 'Unsaved edits' : 'All Changes Saved'}
          </span>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                type="button"
                disabled={busy}
                onClick={() => syncFromRecord(vacancy)}
                className="px-3 py-2 border border-warm-grey/60 bg-ivory text-charcoal font-mono text-[11px] uppercase tracking-wider cursor-pointer"
              >
                Discard Edits
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={handleSave}
              className="px-5 py-2 bg-charcoal text-ivory font-mono text-[11px] uppercase tracking-wider hover:bg-bronze disabled:opacity-50 cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>

      {banner && (
        <div
          role="alert"
          className={`border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : banner.type === 'conflict'
                ? 'bg-amber-50 border-amber-400 text-amber-950'
                : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <span>{banner.message}</span>
          {banner.type === 'conflict' && conflictLatest && (
            <button
              type="button"
              onClick={handleRebaseTimestamp}
              className="px-3 py-1.5 bg-charcoal text-ivory font-mono text-[10px] uppercase tracking-wider cursor-pointer shrink-0"
            >
              Keep Local &amp; Rebase Timestamp
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Metadata & Requirements Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-8 bg-white border border-warm-grey/60 p-6 space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="edit-vacancy-title"
                className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
              >
                Vacancy Title *
              </label>
              <input
                id="edit-vacancy-title"
                required
                disabled={!canEdit || busy}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="edit-vacancy-slug"
                className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
              >
                Slug *
              </label>
              <input
                id="edit-vacancy-slug"
                required
                disabled={!canEdit || busy}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm font-mono disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="edit-vacancy-department"
                className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
              >
                Department / Category *
              </label>
              <input
                id="edit-vacancy-department"
                required
                disabled={!canEdit || busy}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="edit-vacancy-employment-type"
                className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
              >
                Employment Type *
              </label>
              <select
                id="edit-vacancy-employment-type"
                disabled={!canEdit || busy}
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(e.target.value as VacancyEmploymentType)
                }
                className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="edit-vacancy-location"
                className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
              >
                Work Location *
              </label>
              <input
                id="edit-vacancy-location"
                required
                disabled={!canEdit || busy}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="edit-vacancy-deadline"
                className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
              >
                Application Deadline (Optional)
              </label>
              <input
                id="edit-vacancy-deadline"
                type="date"
                disabled={!canEdit || busy}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="edit-vacancy-description"
              className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
            >
              Job Description *
            </label>
            <textarea
              id="edit-vacancy-description"
              required
              rows={5}
              disabled={!canEdit || busy}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="edit-vacancy-requirements"
              className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1"
            >
              Key Prerequisites &amp; Requirements (One per line)
            </label>
            <textarea
              id="edit-vacancy-requirements"
              rows={5}
              disabled={!canEdit || busy}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className="w-full border border-warm-grey/60 bg-ivory px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
        </form>

        {/* Right: Publication & Open/Close Governance */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-warm-grey/60 p-5 space-y-4">
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-charcoal border-b border-warm-grey/30 pb-2">
              Vacancy Governance
            </h3>

            {!canPublishAndToggle ? (
              <p className="font-sans text-xs text-warm-grey-dark">
                Only Publishers and Administrators can publish, unpublish, open, or close vacancies.
              </p>
            ) : (
              <div className="space-y-4">
                {vacancy.publication_status !== 'published' ? (
                  <div className="border border-emerald-300 bg-emerald-50/50 p-4 space-y-3">
                    <label className="flex items-start gap-2 text-xs font-sans cursor-pointer">
                      <input
                        id="confirm-publish-vacancy"
                        type="checkbox"
                        checked={publishConfirmed}
                        onChange={(e) => setPublishConfirmed(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        I confirm this vacancy is approved for public listing on /careers.
                      </span>
                    </label>
                    <button
                      type="button"
                      disabled={busy || !publishConfirmed}
                      onClick={() => handlePublicationChange('published')}
                      className="w-full px-4 py-2 bg-charcoal text-ivory font-mono text-[11px] uppercase tracking-wider hover:bg-bronze disabled:opacity-40 cursor-pointer"
                    >
                      Publish Vacancy
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handlePublicationChange('draft')}
                      className="w-full px-4 py-2 border border-charcoal bg-ivory text-charcoal font-mono text-[11px] uppercase tracking-wider hover:bg-charcoal hover:text-ivory cursor-pointer"
                    >
                      Unpublish to Draft
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handlePublicationChange('archived')}
                      className="w-full px-4 py-2 border border-warm-grey/60 bg-white text-warm-grey-dark font-mono text-[11px] uppercase tracking-wider hover:border-charcoal hover:text-charcoal cursor-pointer"
                    >
                      Archive Vacancy
                    </button>
                  </div>
                )}

                <div className="border-t border-warm-grey/30 pt-4 space-y-2">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
                    Application Intake Status
                  </span>
                  {vacancy.is_open ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleOpenState(false)}
                      className="w-full px-4 py-2 border border-red-400 bg-red-50 text-red-900 font-mono text-[11px] uppercase tracking-wider hover:bg-red-100 cursor-pointer"
                    >
                      Close Vacancy Applications
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleOpenState(true)}
                      className="w-full px-4 py-2 bg-emerald-700 text-white font-mono text-[11px] uppercase tracking-wider hover:bg-emerald-800 cursor-pointer"
                    >
                      Reopen Vacancy Applications
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
