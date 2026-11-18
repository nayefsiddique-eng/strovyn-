'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';

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
};

const SERVICE_QUERY_MAP: Record<string, { service: string; scopeNote?: string }> = {
  interior: { service: 'Interior Precision Painting' },
  exterior: { service: 'Exterior Cladding & Facade Protection' },
  'surface-restoration': {
    service: 'Interior Precision Painting',
    scopeNote: 'Requested focus: Architectural Surface Restoration',
  },
  plaster: {
    service: 'Interior Precision Painting',
    scopeNote: 'Requested focus: Bespoke Artisan Plasters',
  },
  commercial: { service: 'Commercial & Heritage Painting' },
};

function ContactFormContent() {
  const searchParams = useSearchParams();
  const [formState, setFormState] = useState(INITIAL_FORM_STATE);

  // Prefill query parameters safely without overwriting user-entered text
  useEffect(() => {
    const finishParam = searchParams.get('finish')?.trim();
    const hexParam = searchParams.get('hex')?.trim();
    const nameParam = searchParams.get('name')?.trim();
    const emailParam = searchParams.get('email')?.trim();
    const phoneParam = searchParams.get('phone')?.trim();
    const serviceParam = searchParams.get('service')?.trim();

    if (!finishParam && !nameParam && !emailParam && !phoneParam && !serviceParam) {
      return;
    }

    setFormState((prev) => {
      const next = { ...prev };
      if (nameParam && !prev.fullName) next.fullName = nameParam;
      if (emailParam && !prev.email) next.email = emailParam;
      if (phoneParam && !prev.phone) next.phone = phoneParam;

      let scopeNote: string | undefined;
      if (serviceParam) {
        const mapped = SERVICE_QUERY_MAP[serviceParam];
        if (mapped) {
          next.serviceRequired = mapped.service;
          scopeNote = mapped.scopeNote;
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

      if (prefillLines.length > 0) {
        const prefix = prefillLines.join('\n');
        next.description = prev.description ? `${prefix}\n\n${prev.description}` : prefix;
      }

      return next;
    });
  }, [searchParams]);

  const [uploading, setUploading] = useState(false);
  const [attachmentName, setAttachmentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit quotation request');
      }

      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission error. Please verify fields.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal">
      {/* Header */}
      <section className="relative pt-36 pb-16 md:pt-44 md:pb-24 border-b border-warm-grey/30 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-4">
          [ 01 / SPECIFICATION &amp; CONSULTATION ]
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal leading-[1.1] text-charcoal max-w-4xl mb-8">
          Request a Quotation &amp; Site Assessment
        </h1>
        <p className="font-sans text-lg sm:text-xl text-charcoal/80 max-w-2xl leading-relaxed">
          Initiate a dialogue regarding your architectural plans, color schedule, or surface restoration requirements.
        </p>
      </section>

      {/* Main Grid: Info + Form */}
      <section className="py-20 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left Column: Coordinates */}
          <div className="lg:col-span-5 space-y-8">
            <div>
              <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
                DIRECT ENQUIRIES &amp; ADELAIDE CONSULTATION
              </span>
              <h2 className="font-serif text-3xl text-charcoal mb-4">
                Studio Contact &amp; On-Site Consults
              </h2>
              <p className="font-sans text-sm text-charcoal/75 leading-relaxed">
                Strovyn Painting Co. offers free on-site consultations across metro Adelaide — servicing from Glenelg to the Adelaide Hills, and Gawler to McLaren Vale.
              </p>
            </div>

            <div className="p-6 bg-white border border-warm-grey/40 space-y-6 text-sm">
              <div>
                <span className="font-mono text-xs uppercase text-bronze tracking-wider block mb-1">
                  DIRECT CONTACT
                </span>
                <p className="font-sans text-charcoal/70 text-sm">Use WhatsApp below for fastest response.</p>
              </div>

              <div className="pt-4 border-t border-warm-grey/20">
                <span className="font-mono text-xs uppercase text-bronze tracking-wider block mb-1">
                  CONFIRMED WHATSAPP BUSINESS
                </span>
                <a
                  href="https://wa.me/61406646061?text=Hello%20Strovyn%20Painting%20Co.%20I%20would%20like%20to%20enquire%20about%20a%20painting%20project%20in%20Adelaide."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm font-semibold text-emerald-800 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-2"
                >
                  <span>0406 646 061</span>
                  <span className="text-xs font-sans font-normal text-warm-grey-dark">(Click to chat)</span>
                </a>
              </div>

              <div className="pt-4 border-t border-warm-grey/20">
                <span className="font-mono text-xs uppercase text-bronze tracking-wider block mb-1">
                  LOCATION &amp; SERVICE REGION
                </span>
                <p className="font-sans text-charcoal/80">
                  Adelaide, South Australia<br />
                  <span className="text-xs text-warm-grey-dark">Serving Greater Adelaide Metropolitan</span>
                </p>
              </div>
            </div>

            <div className="p-6 bg-charcoal text-white">
              <span className="font-mono text-xs uppercase text-bronze tracking-wider block mb-2">
                FREE ON-SITE CONSULTATION
              </span>
              <p className="font-sans text-xs sm:text-sm text-warm-grey leading-relaxed">
                We conduct comprehensive on-site substrate diagnostics across Adelaide before issuing fixed-price scope schedules. Zero guesswork.
              </p>
            </div>
          </div>

          {/* Right Column: Quote Form */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-warm-grey/40 p-8 sm:p-12">
              <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-2">
                PROJECT INTAKE
              </span>
              <h2 className="font-serif text-3xl text-charcoal mb-6">
                Consultation &amp; Quotation Request
              </h2>

              {submitted ? (
                <div role="status" className="p-8 bg-ivory border border-bronze text-center space-y-4">
                  <span className="font-serif text-2xl text-charcoal block">Quotation Request Logged</span>
                  <p className="font-sans text-sm text-charcoal/80 max-w-md mx-auto">
                    Your project details have been successfully recorded in our management queue. An estimating director will review your requirements and reach out via your preferred contact method.
                  </p>
                  <Button
                    onClick={() => {
                      setSubmitted(false);
                      setAttachmentName('');
                      setFormState(INITIAL_FORM_STATE);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Submit Another Inquiry
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {errorMsg && (
                    <div role="alert" className="p-4 bg-red-50 border border-red-300 text-xs text-red-800">
                      {errorMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input
                      label="Full Name"
                      required
                      placeholder="Julian Vance"
                      value={formState.fullName}
                      onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                    />
                    <Input
                      label="Email Address"
                      type="email"
                      required
                      placeholder="j.vance@example.com"
                      value={formState.email}
                      onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input
                      label="Telephone"
                      type="tel"
                      required
                      placeholder="0400 000 000"
                      value={formState.phone}
                      onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                    />
                    <Input
                      label="Adelaide Suburb / Location"
                      required
                      placeholder="e.g. North Adelaide, Norwood, Unley, Crafers"
                      value={formState.projectLocation}
                      onChange={(e) => setFormState({ ...formState, projectLocation: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Select
                      label="Primary Discipline Required"
                      required
                      value={formState.serviceRequired}
                      onChange={(e) => setFormState({ ...formState, serviceRequired: e.target.value })}
                      options={[
                        { value: 'Interior Precision Painting', label: 'Interior Precision (Walls, Ceilings, Trim)' },
                        { value: 'Exterior Cladding & Facade Protection', label: 'Exterior Cladding & Weatherproofing' },
                        { value: 'Cabinet Refinishing & Spraying', label: 'Cabinet Refinishing & Fine Joinery' },
                        { value: 'Woodwork & Architectural Trim', label: 'Woodwork & Architectural Timber' },
                        { value: 'Commercial & Heritage Painting', label: 'Commercial & Heritage Restoration' },
                      ]}
                    />

                    <Select
                      label="Property Typology"
                      required
                      value={formState.propertyType}
                      onChange={(e) => setFormState({ ...formState, propertyType: e.target.value })}
                      options={[
                        { value: 'Residential Villa / Home', label: 'Residential Villa / Home' },
                        { value: 'Heritage Property', label: 'Heritage Landmark / Period Cottage' },
                        { value: 'Commercial Space', label: 'Commercial Space / Hospitality' },
                        { value: 'Bespoke Joinery Project', label: 'Cabinetry / Joinery Only' },
                      ]}
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="font-sans text-xs uppercase tracking-wider text-warm-grey-dark block">
                      Preferred Contact Method
                    </span>
                    <div className="flex gap-4">
                      {['email', 'phone', 'whatsapp'].map((method) => (
                        <label key={method} className="flex items-center gap-2 cursor-pointer text-xs font-sans uppercase">
                          <input
                            type="radio"
                            name="preferredContact"
                            value={method}
                            checked={formState.preferredContact === method}
                            onChange={(e) => setFormState({ ...formState, preferredContact: e.target.value })}
                            className="accent-bronze"
                          />
                          <span>{method}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Textarea
                    label="Project Scope & Architectural Specifications"
                    required
                    rows={5}
                    placeholder="Provide details on ceiling heights, raking light exposures, square meterage, schedule milestones..."
                    value={formState.description}
                    onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  />

                  {/* Architectural Plan / PDF Attachment */}
                  <div className="p-4 bg-ivory border border-warm-grey/30 space-y-2">
                    <label
                      htmlFor="quote-attachment-input"
                      className="font-sans text-xs uppercase tracking-wider text-charcoal font-medium block"
                    >
                      Architectural Plans or Reference Drawings (Optional)
                    </label>
                    <p className="text-[11px] text-warm-grey-dark">
                      Upload PDF plans, DWG exports, or finish schedule documents (Max 15MB).
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
                          if (upData.success) {
                            setFormState((prev) => ({ ...prev, attachmentUrl: upData.fileUrl }));
                            setAttachmentName(upData.fileName);
                          } else {
                            setErrorMsg(upData.error || 'Failed to upload plan file');
                          }
                        } catch {
                          setErrorMsg('Network error uploading document.');
                        } finally {
                          setUploading(false);
                        }
                      }}
                      className="text-xs file:mr-3 file:py-1.5 file:px-3 file:border-0 file:bg-charcoal file:text-white file:text-xs file:font-sans file:cursor-pointer"
                    />
                    {uploading && <span className="text-xs text-bronze animate-pulse block">Uploading document...</span>}
                    {attachmentName && (
                      <span className="text-xs text-emerald-700 block font-medium">
                        ✓ Attached: {attachmentName}
                      </span>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={loading || uploading}
                    className="w-full text-center"
                  >
                    Submit Formal Quotation Request
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center py-40">
          <div className="font-mono text-xs text-warm-grey-dark uppercase tracking-widest animate-pulse">
            Loading Specification Portal...
          </div>
        </main>
      }
    >
      <ContactFormContent />
    </Suspense>
  );
}
