'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { WHATSAPP_DETAILS } from '@/lib/constants';

const INITIAL_FORM_STATE = {
  fullName: '',
  email: '',
  phone: '',
  projectLocation: '',
  serviceRequired: 'Interior Precision Painting',
  propertyType: 'Residential Villa / Home',
  preferredContact: 'email',
  description: '',
  attachmentUrl: '',
  attachmentToken: '',
};

const SERVICE_QUERY_MAP: Record<string, { service: string; scopeNote?: string }> = {
  interior: { service: 'Interior Precision Painting' },
  exterior: { service: 'Exterior Cladding & Facade Protection' },
  cabinetry: { service: 'Cabinet Refinishing & Spraying' },
  'surface-restoration': {
    service: 'Interior Precision Painting',
    scopeNote: 'Requested focus: Architectural Surface Restoration',
  },
  plaster: {
    service: 'Interior Precision Painting',
    scopeNote: 'Requested focus: Bespoke Artisan Plasters',
  },
  commercial: { service: 'Commercial & Heritage Painting' },
  'Interior Architectural Painting': { service: 'Interior Precision Painting' },
  'Exterior Facade Restoration & Coatings': { service: 'Exterior Cladding & Facade Protection' },
  'Fine Cabinetry & Millwork Lacquering': { service: 'Cabinet Refinishing & Spraying' },
  'Artisanal Plasters & Lime Washes': {
    service: 'Interior Precision Painting',
    scopeNote: 'Requested focus: Artisanal Plasters & Lime Washes',
  },
  'Historic & Heritage Conservation': { service: 'Commercial & Heritage Painting' },
  'Commercial & Hospitality Finishes': { service: 'Commercial & Heritage Painting' },
};

export const V3ContactAtelier: React.FC = () => {
  const searchParams = useSearchParams();
  const [formState, setFormState] = useState(INITIAL_FORM_STATE);
  const idempotencyKeyRef = useRef<string>('');

  const [uploading, setUploading] = useState(false);
  const [attachmentName, setAttachmentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const finishParam = searchParams.get('finish')?.trim();
    const hexParam = searchParams.get('hex')?.trim();
    const nameParam = searchParams.get('name')?.trim();
    const emailParam = searchParams.get('email')?.trim();
    const phoneParam = searchParams.get('phone')?.trim();
    const serviceParam = searchParams.get('service')?.trim();
    const locationParam = searchParams.get('location')?.trim();
    const propertyParam = searchParams.get('propertyType')?.trim();
    const scopeParam = searchParams.get('scope')?.trim();

    if (
      !finishParam &&
      !nameParam &&
      !emailParam &&
      !phoneParam &&
      !serviceParam &&
      !locationParam &&
      !propertyParam &&
      !scopeParam
    ) {
      return;
    }

    setFormState((prev) => {
      const next = { ...prev };
      if (nameParam && !prev.fullName) next.fullName = nameParam;
      if (emailParam && !prev.email) next.email = emailParam;
      if (phoneParam && !prev.phone) next.phone = phoneParam;
      if (locationParam && !prev.projectLocation) next.projectLocation = locationParam;
      if (propertyParam) next.propertyType = propertyParam;

      let scopeNote: string | undefined;
      if (serviceParam) {
        const mapped = SERVICE_QUERY_MAP[serviceParam];
        if (mapped) {
          next.serviceRequired = mapped.service;
          scopeNote = mapped.scopeNote;
        } else {
          next.serviceRequired = serviceParam;
        }
      }

      const prefillLines: string[] = [];
      if (finishParam) {
        const hexSuffix = hexParam ? ` (${hexParam})` : '';
        const finishLine = `Enquiry regarding finish: ${finishParam}${hexSuffix}`;
        if (!prev.description.includes(finishParam)) {
          prefillLines.push(finishLine);
        }
      }
      if (scopeNote && !prev.description.includes(scopeNote)) {
        prefillLines.push(scopeNote);
      }
      if (scopeParam && !prev.description.includes(scopeParam)) {
        prefillLines.push(scopeParam);
      }

      if (prefillLines.length > 0) {
        const prefix = prefillLines.join('\n');
        next.description = prev.description ? `${prefix}\n\n${prev.description}` : prefix;
      }

      return next;
    });
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || uploading) return;
    setErrorMsg('');

    if (formState.fullName.trim().length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }
    if (formState.phone.trim().length < 6) {
      setErrorMsg('Please enter a valid contact phone number.');
      return;
    }
    if (formState.description.trim().length < 10) {
      setErrorMsg('Please provide a brief project scope description (at least 10 characters).');
      return;
    }

    setLoading(true);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    try {
      const payload = {
        ...formState,
        attachmentUrl: formState.attachmentUrl || undefined,
        attachmentToken: formState.attachmentToken || undefined,
      };
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit quotation request');
      }

      idempotencyKeyRef.current = '';
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission error. Please verify fields.';
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
      {/* Frontispiece Header */}
      <section className="px-5 sm:px-10 lg:px-16 pt-8 sm:pt-12 pb-12 sm:pb-16 border-b border-[#B8B5AE]/70 dark:border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#20211F]/25 dark:border-white/20 py-2.5 mb-10 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
          <span>CORRESPONDENCE &amp; ESTIMATING DESK &mdash; ADELAIDE SA</span>
          <span>FREE ON-SITE SUBSTRATE DIAGNOSTICS</span>
        </div>

        <div className="max-w-3xl space-y-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
            § IX &middot; CONSULTATION &amp; QUOTATION
          </span>
          <h1 className="font-display uppercase text-[clamp(2.8rem,5.8vw,5.6rem)] leading-[0.92]">
            Request A Site Assessment &amp; Scope Schedule.
          </h1>
          <p className="font-sans text-base sm:text-lg text-[#42413D] dark:text-[#D5D2CA] font-light leading-[1.75]">
            Initiate a conversation regarding architectural drawings, interior repaints, facade
            restoration, or fine joinery finishing anywhere across Greater Adelaide.
          </p>
        </div>
      </section>

      {/* 4 / 8 Estimating Desk Split */}
      <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start">
          {/* Left 4 Columns: Adelaide Studio Coordinates */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#B8B5AE] dark:border-white/20 p-6 sm:p-8 space-y-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block border-b border-[#B8B5AE]/60 dark:border-white/15 pb-3">
                ADELAIDE STUDIO DESK
              </span>

              <div className="space-y-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE] block">
                  DIRECT WHATSAPP BUSINESS
                </span>
                <a
                  href="https://wa.me/61406646061?text=Hello%20Strovyn%20Painting%20Co.%20I%20would%20like%20to%20enquire%20about%20a%20painting%20project%20in%20Adelaide."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-mono text-sm font-semibold text-[#C41E1E] dark:text-[#C9B28F] underline"
                >
                  <span>{WHATSAPP_DETAILS.displayNumber}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <p className="font-sans text-xs text-[#5C5A55] dark:text-[#B8B5AE]">
                  Fastest channel for room photographs and scheduling site visits.
                </p>
              </div>

              <div className="pt-4 border-t border-[#B8B5AE]/60 dark:border-white/15 space-y-1">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE] block">
                  SERVICE REGION
                </span>
                <p className="font-sans text-sm font-medium">Greater Adelaide, South Australia</p>
                <p className="font-sans text-xs text-[#5C5A55] dark:text-[#B8B5AE] leading-relaxed">
                  Servicing Glenelg to the Adelaide Hills, North Adelaide, Norwood, Unley,
                  Burnside, Gawler, and McLaren Vale.
                </p>
              </div>
            </div>

            <div className="bg-[#141513] text-[#F4F1EA] p-6 sm:p-8 space-y-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#C9B28F] block">
                ON-SITE DIAGNOSTIC PROTOCOL
              </span>
              <p className="font-sans text-xs sm:text-sm text-[#D5D2CA] font-light leading-relaxed">
                Every written quotation is preceded by an on-site substrate moisture, plaster
                condition, and natural-light review—never blind square-metre guesswork.
              </p>
            </div>
          </aside>

          {/* Right 8 Columns: Formal Specification Intake Form */}
          <div className="lg:col-span-8 bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#20211F]/25 dark:border-white/20 p-6 sm:p-10 lg:p-12">
            <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
              FORMAL COMMISSION INTAKE
            </span>
            <h2 className="font-display uppercase text-3xl sm:text-4xl mb-8">
              Project Specification &amp; Quotation Slip.
            </h2>

            {submitted ? (
              <div
                role="status"
                className="p-8 bg-[#F4F1EA] dark:bg-[#141513] border border-[#A78B65] space-y-4"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F] block">
                  ENQUIRY RECORDED
                </span>
                <h3 className="font-display uppercase text-3xl">Quotation Request Logged.</h3>
                <p className="font-sans text-sm text-[#42413D] dark:text-[#D5D2CA] leading-relaxed max-w-lg">
                  Your project coordinates have been logged in our Adelaide estimating queue. Our
                  director will review your scope and respond via your preferred channel.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setAttachmentName('');
                    setFormState(INITIAL_FORM_STATE);
                  }}
                  className="px-5 py-3 border border-[#20211F] dark:border-white/30 font-mono text-[10px] uppercase tracking-[0.2em] cursor-pointer"
                >
                  Submit Another Inquiry
                </button>
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
                      placeholder="0400 000 000"
                      value={formState.phone}
                      onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                      className={inputBase}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                      Adelaide Suburb / Location *
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. North Adelaide, Norwood, Unley"
                      value={formState.projectLocation}
                      onChange={(e) =>
                        setFormState({ ...formState, projectLocation: e.target.value })
                      }
                      className={inputBase}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <label className="block space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                      Primary Discipline Required *
                    </span>
                    <select
                      required
                      value={formState.serviceRequired}
                      onChange={(e) =>
                        setFormState({ ...formState, serviceRequired: e.target.value })
                      }
                      className={inputBase}
                    >
                      <option value="Interior Precision Painting">
                        Interior Precision (Walls, Ceilings, Trim)
                      </option>
                      <option value="Exterior Cladding & Facade Protection">
                        Exterior Cladding &amp; Weatherproofing
                      </option>
                      <option value="Cabinet Refinishing & Spraying">
                        Cabinet Refinishing &amp; Fine Joinery
                      </option>
                      <option value="Woodwork & Architectural Trim">
                        Woodwork &amp; Architectural Timber
                      </option>
                      <option value="Commercial & Heritage Painting">
                        Commercial &amp; Heritage Restoration
                      </option>
                    </select>
                  </label>

                  <label className="block space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                      Property Typology *
                    </span>
                    <select
                      required
                      value={formState.propertyType}
                      onChange={(e) => setFormState({ ...formState, propertyType: e.target.value })}
                      className={inputBase}
                    >
                      <option value="Residential Villa / Home">Residential Villa / Home</option>
                      <option value="Heritage Property">Heritage Landmark / Period Cottage</option>
                      <option value="Commercial Space">Commercial Space / Hospitality</option>
                      <option value="Bespoke Joinery Project">Cabinetry / Joinery Only</option>
                    </select>
                  </label>
                </div>

                <fieldset className="space-y-2">
                  <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    Preferred Contact Method
                  </legend>
                  <div className="flex flex-wrap gap-6 pt-1">
                    {(['email', 'phone', 'whatsapp'] as const).map((method) => (
                      <label
                        key={method}
                        className="inline-flex items-center gap-2 cursor-pointer font-mono text-xs uppercase tracking-[0.16em] py-1"
                      >
                        <input
                          type="radio"
                          name="preferredContact"
                          value={method}
                          checked={formState.preferredContact === method}
                          onChange={(e) =>
                            setFormState({ ...formState, preferredContact: e.target.value })
                          }
                          className="accent-[#C41E1E]"
                        />
                        <span>{method}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    Project Scope &amp; Architectural Notes *
                  </span>
                  <textarea
                    required
                    rows={5}
                    placeholder="Describe rooms, ceiling heights, substrate condition, preferred timeline..."
                    value={formState.description}
                    onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                    className={inputBase}
                  />
                </label>

                {/* Architectural Plan Upload */}
                <div className="p-5 bg-[#F4F1EA] dark:bg-[#141513] border border-[#B8B5AE]/80 dark:border-white/15 space-y-2">
                  <label
                    htmlFor="quote-attachment-input"
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#20211F] dark:text-[#F4F1EA] font-semibold block"
                  >
                    Architectural Plans or Reference Photos (Optional)
                  </label>
                  <p className="font-sans text-xs text-[#5C5A55] dark:text-[#B8B5AE]">
                    Accepted: PDF, DOC, DOCX, JPG, PNG, WEBP (Max 15MB).
                  </p>
                  <input
                    id="quote-attachment-input"
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      setErrorMsg('');
                      const fd = new FormData();
                      fd.append('file', file);
                      fd.append('category', 'documents');
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
                            attachmentUrl: upData.fileReference,
                            attachmentToken:
                              typeof upData.uploadToken === 'string' ? upData.uploadToken : '',
                          }));
                          setAttachmentName(upData.fileName || file.name);
                        } else {
                          setFormState((prev) => ({
                            ...prev,
                            attachmentUrl: '',
                            attachmentToken: '',
                          }));
                          setAttachmentName('');
                          setErrorMsg(upData.error || 'Failed to upload plan file');
                        }
                      } catch {
                        setErrorMsg('Network error uploading document.');
                      } finally {
                        setUploading(false);
                      }
                    }}
                    className="text-xs file:mr-3 file:py-2 file:px-4 file:border-0 file:bg-[#20211F] file:text-[#F4F1EA] file:font-mono file:text-[10px] file:uppercase file:tracking-wider file:cursor-pointer"
                  />
                  {uploading && (
                    <span className="font-mono text-xs text-[#7E6340] block">
                      Uploading document...
                    </span>
                  )}
                  {attachmentName && (
                    <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400 block">
                      Attached: {attachmentName}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || uploading}
                  className="w-full py-4 px-6 bg-[#C41E1E] hover:bg-[#20211F] disabled:opacity-60 text-[#F4F1EA] font-mono text-xs uppercase tracking-[0.24em] font-semibold flex items-center justify-center gap-3 transition-colors cursor-pointer"
                >
                  <span>
                    {loading ? 'Submitting Request...' : 'Submit Formal Quotation Request'}
                  </span>
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
