'use client';

import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import type { PublicVacancyItem } from '@/lib/cms/publicCareers';

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const V3CareersGuild: React.FC<{
  vacancies: PublicVacancyItem[];
  isLoading?: boolean;
}> = ({ vacancies, isLoading = false }) => {
  const [formState, setFormState] = useState({
    jobOpeningId: vacancies[0]?.id ?? '',
    fullName: '',
    email: '',
    phone: '',
    position: vacancies[0]?.title ?? 'General Expression of Interest',
    yearsOfExperience: '5+',
    portfolioUrl: '',
    coverLetter: '',
    resumeUrl: '',
    resumeToken: '',
  });

  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeFileName, setResumeFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const idempotencyKeyRef = useRef<string>('');

  const handleSelectVacancy = (vacancy: PublicVacancyItem) => {
    setFormState((prev) => ({
      ...prev,
      jobOpeningId: vacancy.id,
      position: vacancy.title,
    }));
    const el = document.getElementById('application-form');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || uploadingResume) return;
    setLoading(true);
    setErrorMsg('');

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    try {
      const payload = {
        ...formState,
        jobOpeningId: formState.jobOpeningId.trim() || undefined,
        portfolioUrl: formState.portfolioUrl.trim() || undefined,
        coverLetter: formState.coverLetter.trim() || undefined,
        resumeUrl: formState.resumeUrl.trim() || undefined,
        resumeToken: formState.resumeToken.trim() || undefined,
      };
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit application');
      }

      idempotencyKeyRef.current = '';
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed. Please try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    'w-full bg-[#F4F1EA] dark:bg-[#141513] border border-[#B8B5AE] dark:border-white/20 px-4 py-3.5 font-sans text-sm text-[#20211F] dark:text-[#F4F1EA] placeholder:text-[#7A7872] focus:outline-none focus:border-[#C41E1E]';

  return (
    <div
      role="main"
      className="w-full bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA]"
    >
      {/* Guild Header */}
      <section className="px-5 sm:px-10 lg:px-16 pt-8 sm:pt-12 pb-16 border-b border-[#B8B5AE]/70 dark:border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#20211F]/25 dark:border-white/20 py-2.5 mb-10 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
          <span>THE GUILD OF MASTER FINISHERS &mdash; ADELAIDE SA</span>
          <span>HEPA TOOLING &middot; LEVEL 5 CRAFT</span>
        </div>

        <div className="max-w-3xl space-y-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
            § VII &middot; CAREERS IN CRAFTSMANSHIP
          </span>
          <h1 className="font-display uppercase text-[clamp(2.8rem,5.8vw,5.6rem)] leading-[0.92]">
            Join Our Architectural Finishing Guild.
          </h1>
          <p className="font-sans text-base sm:text-lg text-[#42413D] dark:text-[#D5D2CA] font-light leading-[1.75]">
            We operate not as high-volume commodity painters, but as a disciplined finishing
            atelier—investing in surgical Festool extraction, HVLP/airless spray systems, and calm
            site governance.
          </p>
        </div>
      </section>

      {/* Active Openings Ledger */}
      <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-20 border-b border-[#B8B5AE]/70 dark:border-white/15 space-y-10">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
            ACTIVE COMMISSIONS &amp; ROLES
          </span>
          <h2 className="font-display uppercase text-3xl sm:text-4xl">Current Studio Openings.</h2>
        </div>

        {isLoading ? (
          <div className="p-8 bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#B8B5AE] dark:border-white/20 font-mono text-xs uppercase tracking-[0.2em]">
            Loading Active Commissions...
          </div>
        ) : vacancies.length === 0 ? (
          <div
            data-testid="careers-empty-state"
            className="p-8 sm:p-10 bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#B8B5AE] dark:border-white/20 space-y-3 max-w-3xl"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F] block">
              NO ACTIVE VACANCY COMMISSIONS OPEN
            </span>
            <p className="font-sans text-sm sm:text-base text-[#42413D] dark:text-[#D5D2CA] font-light leading-relaxed">
              There are currently no published role-specific openings. Experienced architectural
              painters, plasterers, and 2K joinery sprayers across Adelaide are invited to lodge a
              general expression of interest below.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {vacancies.map((op) => {
              const formattedDeadline = formatDeadline(op.applicationDeadline);
              return (
                <article
                  key={op.id}
                  data-testid={`vacancy-card-${op.slug}`}
                  className="p-6 sm:p-8 bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#B8B5AE] dark:border-white/20 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
                >
                  <div className="lg:col-span-8 space-y-3">
                    <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em]">
                      <span className="bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] px-2.5 py-1 font-semibold">
                        {op.employmentType}
                      </span>
                      <span className="border border-[#B8B5AE] dark:border-white/20 px-2.5 py-1">
                        {op.department}
                      </span>
                      <span className="text-[#7E6340] dark:text-[#C9B28F]">{op.location}</span>
                      {formattedDeadline && (
                        <span className="text-[#5C5A55] dark:text-[#B8B5AE]">
                          Apply by {formattedDeadline}
                        </span>
                      )}
                    </div>

                    <h3 className="font-display uppercase text-2xl sm:text-3xl">{op.title}</h3>
                    <p className="font-sans text-sm text-[#42413D] dark:text-[#D5D2CA] font-light leading-relaxed">
                      {op.description}
                    </p>

                    {op.requirements.length > 0 && (
                      <ul className="pt-2 space-y-1.5 font-sans text-xs text-[#4A4945] dark:text-[#B8B5AE]">
                        {op.requirements.map((req, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 bg-[#C41E1E] mt-1.5 shrink-0" />
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="lg:col-span-4 lg:text-right">
                    <button
                      type="button"
                      onClick={() => handleSelectVacancy(op)}
                      className="inline-flex items-center gap-2 bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] hover:bg-[#C41E1E] px-5 py-3.5 font-mono text-[10px] uppercase tracking-[0.2em] font-semibold cursor-pointer transition-colors"
                    >
                      <span>Apply For Role</span>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Credentials & CV Intake Dossier */}
      <section id="application-form" className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24">
        <div className="max-w-3xl bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#20211F]/25 dark:border-white/20 p-6 sm:p-10 lg:p-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
            CREDENTIALS DOSSIER
          </span>
          <h2 className="font-display uppercase text-3xl sm:text-4xl mb-3">
            Application &amp; Expression Of Interest.
          </h2>
          <p className="font-sans text-sm text-[#5C5A55] dark:text-[#B8B5AE] font-light leading-relaxed mb-8">
            Share your trade background, spray/plaster experience, and optional CV.
          </p>

          {submitted ? (
            <div
              role="status"
              className="p-8 bg-[#F4F1EA] dark:bg-[#141513] border border-[#A78B65] space-y-3"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F] block">
                CREDENTIALS LOGGED
              </span>
              <h3 className="font-display uppercase text-3xl">Application Received.</h3>
              <p className="font-sans text-sm text-[#42413D] dark:text-[#D5D2CA] leading-relaxed">
                Thank you for lodging your credentials. Our operations director reviews all trade
                submissions directly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMsg && (
                <div
                  role="alert"
                  className="p-4 bg-[#C41E1E]/10 border border-[#C41E1E] text-xs text-[#C41E1E] dark:text-[#FF8A8A]"
                >
                  {errorMsg}
                </div>
              )}

              {vacancies.length > 0 && (
                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    Active Vacancy Selection
                  </span>
                  <select
                    id="select-vacancy-opening"
                    value={formState.jobOpeningId}
                    onChange={(e) => {
                      const val = e.target.value;
                      const matched = vacancies.find((v) => v.id === val);
                      setFormState((prev) => ({
                        ...prev,
                        jobOpeningId: val,
                        position: matched ? matched.title : 'General Expression of Interest',
                      }));
                    }}
                    className={inputBase}
                  >
                    {vacancies.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({v.employmentType} — {v.location})
                      </option>
                    ))}
                    <option value="">General Expression of Interest</option>
                  </select>
                </label>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    Full Name *
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Your full name"
                    value={formState.fullName}
                    onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                    className={inputBase}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    Email Address *
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={formState.email}
                    onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    className={inputBase}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    Telephone *
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="+61 400 000 000"
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                    className={inputBase}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    Position of Interest *
                  </span>
                  <input
                    type="text"
                    required
                    value={formState.position}
                    onChange={(e) => setFormState({ ...formState, position: e.target.value })}
                    className={inputBase}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    Years of Experience
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. 7 years"
                    value={formState.yearsOfExperience}
                    onChange={(e) =>
                      setFormState({ ...formState, yearsOfExperience: e.target.value })
                    }
                    className={inputBase}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    Portfolio / Reference Link
                  </span>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={formState.portfolioUrl}
                    onChange={(e) => setFormState({ ...formState, portfolioUrl: e.target.value })}
                    className={inputBase}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                  Craftsmanship &amp; Tooling Summary
                </span>
                <textarea
                  rows={4}
                  placeholder="Mention spray setups, Level 5 skimming, heritage restoration, or plaster experience..."
                  value={formState.coverLetter}
                  onChange={(e) => setFormState({ ...formState, coverLetter: e.target.value })}
                  className={inputBase}
                />
              </label>

              <div className="p-5 bg-[#F4F1EA] dark:bg-[#141513] border border-[#B8B5AE]/80 dark:border-white/15 space-y-2">
                <label
                  htmlFor="careers-cv-upload"
                  className="font-mono text-[10px] uppercase tracking-[0.2em] font-semibold block"
                >
                  Attach Curriculum Vitae (CV) / Resume
                </label>
                <p className="font-sans text-xs text-[#5C5A55] dark:text-[#B8B5AE]">
                  Accepted formats: PDF, DOCX, DOC (Max 15MB).
                </p>
                <input
                  id="careers-cv-upload"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingResume(true);
                    setErrorMsg('');
                    const fd = new FormData();
                    fd.append('file', file);
                    fd.append('category', 'resumes');
                    try {
                      const upRes = await fetch('/api/upload', {
                        method: 'POST',
                        body: fd,
                      });
                      const upData = await upRes.json();
                      if (
                        upRes.ok &&
                        upData.success &&
                        typeof upData.fileReference === 'string' &&
                        upData.fileReference.length > 0
                      ) {
                        setFormState((prev) => ({
                          ...prev,
                          resumeUrl: upData.fileReference,
                          resumeToken:
                            typeof upData.uploadToken === 'string' ? upData.uploadToken : '',
                        }));
                        setResumeFileName(upData.fileName || file.name);
                      } else {
                        setFormState((prev) => ({ ...prev, resumeUrl: '', resumeToken: '' }));
                        setResumeFileName('');
                        setErrorMsg(upData.error || 'Failed to upload CV file');
                      }
                    } catch {
                      setErrorMsg('Network error uploading resume.');
                    } finally {
                      setUploadingResume(false);
                    }
                  }}
                  className="text-xs file:mr-3 file:py-2 file:px-4 file:border-0 file:bg-[#20211F] file:text-[#F4F1EA] file:font-mono file:text-[10px] file:uppercase file:tracking-wider file:cursor-pointer"
                />
                {uploadingResume && (
                  <span className="font-mono text-xs text-[#7E6340] block">
                    Uploading resume...
                  </span>
                )}
                {resumeFileName && (
                  <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400 block">
                    Attached: {resumeFileName}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || uploadingResume}
                className="w-full py-4 px-6 bg-[#20211F] dark:bg-[#F4F1EA] hover:bg-[#C41E1E] dark:hover:bg-[#C9B28F] disabled:opacity-60 text-[#F4F1EA] dark:text-[#181917] font-mono text-xs uppercase tracking-[0.24em] font-semibold flex items-center justify-center gap-3 transition-colors cursor-pointer"
              >
                <span>{loading ? 'Submitting Credentials...' : 'Submit Application To Guild'}</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
