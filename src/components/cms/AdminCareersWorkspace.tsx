'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Calendar,
  ExternalLink,
  Plus,
  Search,
} from 'lucide-react';
import type { VacancyRecord } from '@/lib/cms/careersService';
import type { StaffViewerIdentity } from './StaffAuthGateCards';

type FilterTab =
  | 'all'
  | 'draft'
  | 'published_open'
  | 'closed'
  | 'expired'
  | 'archived';

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'published_open', label: 'Published & Open' },
  { id: 'closed', label: 'Closed' },
  { id: 'expired', label: 'Expired Deadline' },
  { id: 'archived', label: 'Archived' },
];

function isExpired(deadline: string | null): boolean {
  if (!deadline) return false;
  const ms = Date.parse(deadline);
  return Number.isFinite(ms) && ms <= Date.now();
}

function formatDate(iso: string | null): string {
  if (!iso) return 'No deadline';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function pubBadgeClass(status: VacancyRecord['publication_status']): string {
  switch (status) {
    case 'published':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    case 'archived':
      return 'bg-stone-100 text-stone-700 border-stone-300';
    case 'draft':
    default:
      return 'bg-ivory text-charcoal border-warm-grey/60';
  }
}

export function AdminCareersWorkspace({
  staff,
  initialVacancies,
}: {
  staff: StaffViewerIdentity;
  initialVacancies: VacancyRecord[];
}) {
  const router = useRouter();
  const canReorder = staff.role === 'publisher' || staff.role === 'admin';

  const [vacancies, setVacancies] = useState<VacancyRecord[]>(initialVacancies);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const filteredVacancies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vacancies.filter((v) => {
      const expired = isExpired(v.application_deadline);
      if (activeFilter === 'draft' && v.publication_status !== 'draft') return false;
      if (
        activeFilter === 'published_open' &&
        !(v.publication_status === 'published' && v.is_open && !expired)
      ) {
        return false;
      }
      if (activeFilter === 'closed' && v.is_open) return false;
      if (activeFilter === 'expired' && !expired) return false;
      if (activeFilter === 'archived' && v.publication_status !== 'archived') {
        return false;
      }

      if (!q) return true;
      return [
        v.title,
        v.slug,
        v.department,
        v.employment_type,
        v.location,
        v.description,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [vacancies, activeFilter, searchQuery]);

  const handleMoveOrder = async (id: string, delta: -1 | 1) => {
    if (!canReorder || busy) return;
    const idx = vacancies.findIndex((v) => v.id === id);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= vacancies.length) return;

    const reordered = [...vacancies];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);
    setVacancies(reordered);
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/admin/careers/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ordered_ids: reordered.map((v) => v.id),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBanner({
          type: 'error',
          message: data.error ?? 'Failed to reorder vacancies.',
        });
        return;
      }
      setBanner({ type: 'success', message: 'Vacancy display order updated.' });
      router.refresh();
    } catch {
      setBanner({ type: 'error', message: 'Network error reordering vacancies.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="bg-white border border-warm-grey/60 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-bronze block mb-1">
            Careers &amp; Vacancies
          </span>
          <h2 className="font-serif text-2xl text-charcoal">
            Careers &amp; Vacancies Management
          </h2>
          <p className="font-sans text-xs text-warm-grey-dark mt-1">
            Only published, open vacancies with active deadlines appear on the public /careers page and accept candidate submissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/careers"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-warm-grey/60 bg-ivory text-charcoal font-mono text-[11px] uppercase tracking-wider hover:border-charcoal"
          >
            <span>Public /careers</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </Link>
          <Link
            href="/admin/careers/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-charcoal text-ivory font-mono text-[11px] uppercase tracking-wider hover:bg-bronze transition-colors"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New Vacancy</span>
          </Link>
        </div>
      </div>

      {banner && (
        <div
          role="alert"
          className={`border p-4 text-xs font-sans ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          {banner.message}
        </div>
      )}

      {/* Filter Tabs + Search */}
      <div className="bg-white border border-warm-grey/60 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border cursor-pointer transition-colors ${
                activeFilter === tab.id
                  ? 'bg-charcoal text-ivory border-charcoal'
                  : 'bg-ivory text-charcoal border-warm-grey/50 hover:border-charcoal'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search
            className="w-3.5 h-3.5 text-warm-grey-dark absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, department, location..."
            aria-label="Search vacancies"
            className="w-full border border-warm-grey/60 bg-ivory pl-8 pr-3 py-1.5 text-xs"
          />
        </div>
      </div>

      {/* Vacancies Queue */}
      <div className="bg-white border border-warm-grey/60 divide-y divide-warm-grey/30">
        {filteredVacancies.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Briefcase className="w-6 h-6 text-bronze mx-auto" aria-hidden="true" />
            <p className="font-sans text-sm text-charcoal">
              No vacancies match the current filter.
            </p>
            <p className="font-sans text-xs text-warm-grey-dark">
              When zero published &amp; open vacancies exist, the public /careers page displays a clean empty state.
            </p>
          </div>
        ) : (
          filteredVacancies.map((vacancy, idx) => {
            const expired = isExpired(vacancy.application_deadline);
            return (
              <div
                key={vacancy.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-ivory/40 transition-colors"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border ${pubBadgeClass(
                        vacancy.publication_status
                      )}`}
                    >
                      {vacancy.publication_status}
                    </span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
                        vacancy.is_open && !expired
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-red-50 text-red-800 border-red-300'
                      }`}
                    >
                      {expired
                        ? 'Deadline Expired'
                        : vacancy.is_open
                          ? 'Open for Applications'
                          : 'Closed'}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-bronze">
                      {vacancy.employment_type}
                    </span>
                  </div>

                  <Link
                    href={`/admin/careers/${vacancy.id}`}
                    className="block font-serif text-xl text-charcoal hover:text-bronze transition-colors"
                  >
                    {vacancy.title}
                  </Link>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-warm-grey-dark font-sans">
                    <span>{vacancy.department}</span>
                    <span>•</span>
                    <span>{vacancy.location}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                      <Calendar className="w-3 h-3" aria-hidden="true" />
                      Deadline: {formatDate(vacancy.application_deadline)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canReorder && activeFilter === 'all' && !searchQuery && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy || idx === 0}
                        onClick={() => handleMoveOrder(vacancy.id, -1)}
                        aria-label={`Move ${vacancy.title} up`}
                        className="p-2 border border-warm-grey/60 bg-ivory text-charcoal disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy || idx === vacancies.length - 1}
                        onClick={() => handleMoveOrder(vacancy.id, 1)}
                        aria-label={`Move ${vacancy.title} down`}
                        className="p-2 border border-warm-grey/60 bg-ivory text-charcoal disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <Link
                    href={`/admin/careers/${vacancy.id}`}
                    className="px-4 py-2 border border-charcoal bg-white text-charcoal font-mono text-[11px] uppercase tracking-wider hover:bg-charcoal hover:text-ivory transition-colors"
                  >
                    Manage Vacancy
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
