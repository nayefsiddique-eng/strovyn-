'use client';

import React, { useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

export const V3FeedbackFolio: React.FC = () => {
  const [formState, setFormState] = useState({
    customerName: '',
    email: '',
    projectReference: '',
    rating: 5,
    message: '',
    permissionToPublish: true,
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const idempotencyKeyRef = useRef<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
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
        email: formState.email.trim() || undefined,
        projectReference: formState.projectReference.trim() || undefined,
      };
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      idempotencyKeyRef.current = '';
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission error. Please try again.';
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
      {/* Header */}
      <section className="px-5 sm:px-10 lg:px-16 pt-8 sm:pt-12 pb-16 border-b border-[#B8B5AE]/70 dark:border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#20211F]/25 dark:border-white/20 py-2.5 mb-10 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
          <span>CLIENT REFLECTION FOLIO &mdash; HANDOVER GOVERNANCE</span>
          <span>VERIFIED ENDORSEMENT ARCHIVE</span>
        </div>

        <div className="max-w-3xl space-y-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
            § VIII &middot; PROJECT EVALUATION
          </span>
          <h1 className="font-display uppercase text-[clamp(2.8rem,5.8vw,5.6rem)] leading-[0.92]">
            Client Feedback &amp; Handover Reflection.
          </h1>
          <p className="font-sans text-base sm:text-lg text-[#42413D] dark:text-[#D5D2CA] font-light leading-[1.75]">
            Your reflection helps our Adelaide team uphold strict AS/NZS 2311 preparation,
            cleanliness, and communication standards on every commission.
          </p>
        </div>
      </section>

      {/* 5 / 7 Split: Governance Policy + Evaluation Slip */}
      <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start">
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#B8B5AE] dark:border-white/20 p-6 sm:p-8 space-y-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block">
                PUBLICATION GOVERNANCE
              </span>
              <p className="font-sans text-xs sm:text-sm text-[#42413D] dark:text-[#D5D2CA] font-light leading-relaxed">
                Strovyn never fabricates client testimonials. Every submission is reviewed privately
                by studio management first and displayed publicly only when explicit client
                permission is granted.
              </p>
            </div>
          </aside>

          <div className="lg:col-span-8 bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#20211F]/25 dark:border-white/20 p-6 sm:p-10 lg:p-12">
            {submitted ? (
              <div
                role="status"
                className="p-8 bg-[#F4F1EA] dark:bg-[#141513] border border-[#A78B65] space-y-3"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F] block">
                  REFLECTION LOGGED
                </span>
                <h2 className="font-display uppercase text-3xl">Thank You For Your Evaluation.</h2>
                <p className="font-sans text-sm text-[#42413D] dark:text-[#D5D2CA] leading-relaxed max-w-lg">
                  Your reflection has been securely recorded in our studio register for managerial
                  review.
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <label className="block space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                      Client Name *
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Your full name"
                      value={formState.customerName}
                      onChange={(e) => setFormState({ ...formState, customerName: e.target.value })}
                      className={inputBase}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                      Email (Optional)
                    </span>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={formState.email}
                      onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                      className={inputBase}
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    Project Reference / Suburb *
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Norwood Villa Interior or Unley Facade"
                    value={formState.projectReference}
                    onChange={(e) =>
                      setFormState({ ...formState, projectReference: e.target.value })
                    }
                    className={inputBase}
                  />
                </label>

                <fieldset className="space-y-2">
                  <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    Craftsmanship Rating *
                  </legend>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = formState.rating >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormState({ ...formState, rating: star })}
                          className={`h-11 w-14 border font-mono text-sm transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] border-[#20211F] dark:border-[#F4F1EA]'
                              : 'bg-transparent text-[#5C5A55] border-[#B8B5AE] dark:border-white/20'
                          }`}
                        >
                          {star} ★
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    Evaluation &amp; Reflection *
                  </span>
                  <textarea
                    required
                    rows={5}
                    placeholder="Describe surface preparation, dust containment, finish quality, and communication..."
                    value={formState.message}
                    onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                    className={inputBase}
                  />
                </label>

                <label className="flex items-start gap-3 cursor-pointer font-sans text-xs text-[#42413D] dark:text-[#D5D2CA] pt-1">
                  <input
                    type="checkbox"
                    checked={formState.permissionToPublish}
                    onChange={(e) =>
                      setFormState({ ...formState, permissionToPublish: e.target.checked })
                    }
                    className="mt-0.5 accent-[#C41E1E]"
                  />
                  <span>
                    I grant permission for Strovyn Painting Co. to publish this reflection following
                    managerial review.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 bg-[#C41E1E] hover:bg-[#20211F] disabled:opacity-60 text-[#F4F1EA] font-mono text-xs uppercase tracking-[0.24em] font-semibold flex items-center justify-center gap-3 transition-colors cursor-pointer"
                >
                  <span>{loading ? 'Recording Evaluation...' : 'Submit Project Evaluation'}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
