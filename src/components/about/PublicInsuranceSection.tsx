'use client';

import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ImagePlus,
  PhoneCall,
  Shield,
  X,
} from 'lucide-react';
import { WHATSAPP_DETAILS } from '@/lib/constants';
import {
  INCIDENT_NON_LIABILITY_STATEMENT,
  type IncidentCategory,
  type InsuranceEnquiryKind,
  type InsuranceRequestType,
  type PublicInsuranceStatus,
} from '@/lib/cms/insuranceTypes';

export interface PublicInsuranceSectionProps {
  status: PublicInsuranceStatus;
}

interface SubmissionReceipt {
  referenceCode: string;
  enquiryKind: InsuranceEnquiryKind;
  attachmentCount: number;
  createdAt: string;
}

function makeClientIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ins-${crypto.randomUUID()}`;
  }
  return `ins-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function PublicInsuranceSection({ status }: PublicInsuranceSectionProps) {
  const [activeOption, setActiveOption] = useState<InsuranceEnquiryKind>('information_request');

  // Shared fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot

  // Option A — Request Insurance Information
  const [requestType, setRequestType] = useState<InsuranceRequestType>('certificate_of_currency');
  const [message, setMessage] = useState('');

  // Option B — Report an Incident
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentCategory, setIncidentCategory] = useState<IncidentCategory>('property_damage');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const idempotencyKeyRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOptionSwitch = (next: InsuranceEnquiryKind) => {
    setActiveOption(next);
    setErrorMessage(null);
    setReceipt(null);
    idempotencyKeyRef.current = '';
  };

  const handlePhotoSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setErrorMessage(null);

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const combined = [...photos];

    for (const f of selected) {
      if (combined.length >= 3) {
        setErrorMessage('You can attach up to 3 supporting photographs.');
        break;
      }
      if (!allowed.includes(f.type)) {
        setErrorMessage(`"${f.name}" is not a supported photo format. Use JPEG, PNG, or WebP.`);
        continue;
      }
      if (f.size > 8 * 1024 * 1024) {
        setErrorMessage(`"${f.name}" exceeds the 8 MB per-photo limit.`);
        continue;
      }
      combined.push(f);
    }

    setPhotos(combined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhotoAt = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetFormForNewEnquiry = () => {
    setReceipt(null);
    setErrorMessage(null);
    setMessage('');
    setIncidentDate('');
    setIncidentDescription('');
    setDisclaimerAccepted(false);
    setPhotos([]);
    idempotencyKeyRef.current = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMessage(null);

    if (fullName.trim().length < 2) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim().includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (activeOption === 'incident_report') {
      if (phone.trim().length < 6) {
        setErrorMessage('Please provide a contact phone number for incident follow-up.');
        return;
      }
      if (projectLocation.trim().length < 2) {
        setErrorMessage('Please enter the project location or suburb.');
        return;
      }
      if (!incidentDate) {
        setErrorMessage('Please select the date the incident occurred.');
        return;
      }
      if (incidentDescription.trim().length < 15) {
        setErrorMessage('Please provide a brief factual description (at least 15 characters).');
        return;
      }
      if (!disclaimerAccepted) {
        setErrorMessage('Please confirm you understand the incident notification statement.');
        return;
      }
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = makeClientIdempotencyKey();
    }

    setSubmitting(true);
    try {
      let res: Response;

      if (activeOption === 'information_request') {
        res = await fetch('/api/insurance-enquiries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKeyRef.current,
          },
          body: JSON.stringify({
            enquiry_kind: 'information_request',
            full_name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            project_location: projectLocation.trim() || null,
            request_type: requestType,
            message: message.trim() || null,
            idempotency_key: idempotencyKeyRef.current,
            website,
          }),
        });
      } else {
        const formData = new FormData();
        formData.append('enquiry_kind', 'incident_report');
        formData.append('full_name', fullName.trim());
        formData.append('email', email.trim());
        formData.append('phone', phone.trim());
        formData.append('project_location', projectLocation.trim());
        formData.append('incident_date', incidentDate);
        formData.append('incident_category', incidentCategory);
        formData.append('incident_description', incidentDescription.trim());
        formData.append('disclaimer_acknowledged', disclaimerAccepted ? 'true' : 'false');
        formData.append('idempotency_key', idempotencyKeyRef.current);
        if (website) formData.append('website', website);
        for (const photo of photos) {
          formData.append('photos', photo);
        }

        res = await fetch('/api/insurance-enquiries', {
          method: 'POST',
          headers: {
            'Idempotency-Key': idempotencyKeyRef.current,
          },
          body: formData,
        });
      }

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.submission?.referenceCode) {
        const apiErr =
          typeof data?.error === 'string'
            ? data.error
            : typeof data?.error?.message === 'string'
              ? data.error.message
              : 'Unable to submit your enquiry right now. Please try again or contact us via WhatsApp.';
        setErrorMessage(apiErr);
        return;
      }

      idempotencyKeyRef.current = '';
      setReceipt({
        referenceCode: String(data.submission.referenceCode),
        enquiryKind: data.submission.enquiryKind as InsuranceEnquiryKind,
        attachmentCount: Number(data.submission.attachmentCount ?? 0),
        createdAt: String(data.submission.createdAt),
      });
    } catch {
      setErrorMessage(
        'A network error occurred while sending your submission. Please retry or message our Adelaide team on WhatsApp (+61 406 646 061).'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="public-liability-insurance"
      aria-labelledby="public-liability-insurance-heading"
      className="py-20 md:py-28 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30 dark:border-white/10"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        {/* Left Editorial Introduction */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
              [ 03 / GOVERNANCE &amp; ENQUIRIES ]
            </span>
            <h2
              id="public-liability-insurance-heading"
              className="type-section-title text-3xl sm:text-4xl text-charcoal dark:text-[#F4F1EA] mb-5"
            >
              Public Liability Insurance
            </h2>
            <div className="w-12 h-[2px] bg-bronze mb-6" />
            <p className="font-sans text-base text-charcoal/85 dark:text-[#D0CDC6] leading-relaxed">
              Need information about public liability insurance or wish to report an incident relating to our work? Contact our team using the form below.
            </p>
          </div>

          {status.isPublished && status.statement && (
            <div className="p-5 bg-white dark:bg-[#242523] border border-warm-grey/40 dark:border-white/12 space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-bronze">
                <Shield className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Policy Statement</span>
              </div>
              <p className="font-sans text-sm text-charcoal/85 dark:text-[#F4F1EA]/90 leading-relaxed">
                {status.statement}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-warm-grey/30 dark:border-white/10 space-y-2 font-sans text-xs text-charcoal/70 dark:text-[#B8B5AE] leading-relaxed">
            <p>
              All enquiries and incident reports are transmitted over encrypted connections directly to Strovyn management for review.
            </p>
            <p>
              For urgent on-site matters in Greater Adelaide, you can also reach our team directly on{' '}
              <a
                href={WHATSAPP_DETAILS.chatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-charcoal dark:text-[#F4F1EA] font-medium underline underline-offset-2 hover:text-bronze"
              >
                WhatsApp ({WHATSAPP_DETAILS.internationalDisplay})
              </a>
              .
            </p>
          </div>
        </div>

        {/* Right Interactive Form Card */}
        <div className="lg:col-span-7 bg-white dark:bg-[#222320] border border-warm-grey/50 dark:border-white/15 p-6 sm:p-8 lg:p-10">
          {/* Two-Option Selector */}
          <div
            role="tablist"
            aria-label="Public liability enquiry type"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-6 mb-6 border-b border-warm-grey/30 dark:border-white/12"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeOption === 'information_request'}
              data-insurance-tab="information_request"
              onClick={() => handleOptionSwitch('information_request')}
              className={`min-h-[46px] px-4 py-3 text-left border transition-colors cursor-pointer flex items-center gap-2.5 ${
                activeOption === 'information_request'
                  ? 'bg-charcoal text-ivory border-charcoal dark:bg-[#F4F1EA] dark:text-[#20211F] dark:border-[#F4F1EA]'
                  : 'bg-ivory/60 dark:bg-[#191A18] text-charcoal dark:text-[#F4F1EA] border-warm-grey/50 dark:border-white/15 hover:border-bronze'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0 text-bronze" aria-hidden="true" />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] font-medium">
                A. Request Insurance Information
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeOption === 'incident_report'}
              data-insurance-tab="incident_report"
              onClick={() => handleOptionSwitch('incident_report')}
              className={`min-h-[46px] px-4 py-3 text-left border transition-colors cursor-pointer flex items-center gap-2.5 ${
                activeOption === 'incident_report'
                  ? 'bg-charcoal text-ivory border-charcoal dark:bg-[#F4F1EA] dark:text-[#20211F] dark:border-[#F4F1EA]'
                  : 'bg-ivory/60 dark:bg-[#191A18] text-charcoal dark:text-[#F4F1EA] border-warm-grey/50 dark:border-white/15 hover:border-bronze'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-bronze" aria-hidden="true" />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] font-medium">
                B. Report an Incident
              </span>
            </button>
          </div>

          {receipt ? (
            <div
              role="status"
              data-insurance-receipt="true"
              className="p-6 bg-ivory dark:bg-[#191A18] border border-bronze/60 space-y-4"
            >
              <div className="flex items-center gap-2.5 text-charcoal dark:text-[#F4F1EA]">
                <CheckCircle2 className="w-5 h-5 text-bronze shrink-0" aria-hidden="true" />
                <h3 className="font-sans text-lg font-semibold">
                  {receipt.enquiryKind === 'incident_report'
                    ? 'Incident Notification Recorded'
                    : 'Insurance Enquiry Received'}
                </h3>
              </div>

              <div className="p-3.5 bg-white dark:bg-[#222320] border border-warm-grey/40 dark:border-white/12 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-warm-grey-dark dark:text-[#B8B5AE]">
                  Reference Number
                </span>
                <code
                  data-insurance-reference={receipt.referenceCode}
                  className="font-mono text-sm font-semibold text-charcoal dark:text-[#F4F1EA] tracking-wider"
                >
                  {receipt.referenceCode}
                </code>
              </div>

              <p className="font-sans text-sm text-charcoal/85 dark:text-[#D0CDC6] leading-relaxed">
                Thank you. Your submission has been logged for review by Strovyn management. Please retain your reference number above if following up with our team.
              </p>

              {receipt.enquiryKind === 'incident_report' && (
                <p className="font-sans text-xs text-charcoal/70 dark:text-[#B8B5AE] leading-relaxed border-t border-warm-grey/30 dark:border-white/10 pt-3">
                  {INCIDENT_NON_LIABILITY_STATEMENT}
                </p>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={resetFormForNewEnquiry}
                  className="px-4 py-2.5 border border-charcoal dark:border-white/30 text-xs font-mono uppercase tracking-wider text-charcoal dark:text-[#F4F1EA] hover:bg-charcoal hover:text-ivory transition-colors cursor-pointer"
                >
                  Submit Another Enquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Honeypot anti-spam field */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="ins-website-hp">Website</label>
                <input
                  id="ins-website-hp"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {activeOption === 'incident_report' && (
                <div className="p-4 bg-ivory dark:bg-[#191A18] border-l-2 border-brand-red text-xs font-sans text-charcoal/85 dark:text-[#E5E2DC] space-y-1.5 leading-relaxed">
                  <div className="flex items-center gap-2 font-semibold text-charcoal dark:text-white">
                    <PhoneCall className="w-3.5 h-3.5 text-brand-red shrink-0" aria-hidden="true" />
                    <span>Emergency &amp; Urgent Site Assistance</span>
                  </div>
                  <p>
                    If anyone requires immediate medical or emergency services, call{' '}
                    <strong>000</strong> first. For urgent on-site safety matters requiring prompt human contact, please also phone or WhatsApp our Adelaide team directly on{' '}
                    <strong>{WHATSAPP_DETAILS.internationalDisplay}</strong> rather than relying solely on a web form.
                  </p>
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 bg-red-50 dark:bg-[#2A1616] border border-red-300 dark:border-red-700/60 text-xs font-sans text-red-900 dark:text-red-200"
                >
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="ins-full-name"
                    className="block font-mono text-[11px] uppercase tracking-wider text-charcoal/80 dark:text-[#D0CDC6] mb-1.5"
                  >
                    Full Name <span className="text-brand-red">*</span>
                  </label>
                  <input
                    id="ins-full-name"
                    type="text"
                    required
                    maxLength={120}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3.5 py-3 border border-warm-grey/60 dark:border-white/20 bg-transparent text-sm font-sans text-charcoal dark:text-white focus:outline-none focus:border-charcoal"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ins-email"
                    className="block font-mono text-[11px] uppercase tracking-wider text-charcoal/80 dark:text-[#D0CDC6] mb-1.5"
                  >
                    Email Address <span className="text-brand-red">*</span>
                  </label>
                  <input
                    id="ins-email"
                    type="email"
                    required
                    maxLength={160}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-3 border border-warm-grey/60 dark:border-white/20 bg-transparent text-sm font-sans text-charcoal dark:text-white focus:outline-none focus:border-charcoal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="ins-phone"
                    className="block font-mono text-[11px] uppercase tracking-wider text-charcoal/80 dark:text-[#D0CDC6] mb-1.5"
                  >
                    Contact Number{' '}
                    {activeOption === 'incident_report' ? (
                      <span className="text-brand-red">*</span>
                    ) : (
                      <span className="text-warm-grey-dark">(Optional)</span>
                    )}
                  </label>
                  <input
                    id="ins-phone"
                    type="tel"
                    required={activeOption === 'incident_report'}
                    maxLength={40}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="04XX XXX XXX"
                    className="w-full px-3.5 py-3 border border-warm-grey/60 dark:border-white/20 bg-transparent text-sm font-sans text-charcoal dark:text-white focus:outline-none focus:border-charcoal"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ins-location"
                    className="block font-mono text-[11px] uppercase tracking-wider text-charcoal/80 dark:text-[#D0CDC6] mb-1.5"
                  >
                    {activeOption === 'incident_report' ? 'Project Location' : 'Project Address or Suburb'}{' '}
                    {activeOption === 'incident_report' ? (
                      <span className="text-brand-red">*</span>
                    ) : (
                      <span className="text-warm-grey-dark">(Optional)</span>
                    )}
                  </label>
                  <input
                    id="ins-location"
                    type="text"
                    required={activeOption === 'incident_report'}
                    maxLength={200}
                    value={projectLocation}
                    onChange={(e) => setProjectLocation(e.target.value)}
                    placeholder="e.g. Norwood, SA"
                    className="w-full px-3.5 py-3 border border-warm-grey/60 dark:border-white/20 bg-transparent text-sm font-sans text-charcoal dark:text-white focus:outline-none focus:border-charcoal"
                  />
                </div>
              </div>

              {activeOption === 'information_request' ? (
                <>
                  <div>
                    <label
                      htmlFor="ins-request-type"
                      className="block font-mono text-[11px] uppercase tracking-wider text-charcoal/80 dark:text-[#D0CDC6] mb-1.5"
                    >
                      Request Type <span className="text-brand-red">*</span>
                    </label>
                    <select
                      id="ins-request-type"
                      value={requestType}
                      onChange={(e) => setRequestType(e.target.value as InsuranceRequestType)}
                      className="w-full px-3.5 py-3 border border-warm-grey/60 dark:border-white/20 bg-white dark:bg-[#242523] text-sm font-sans text-charcoal dark:text-white focus:outline-none focus:border-charcoal"
                    >
                      <option value="certificate_of_currency">Certificate of Currency</option>
                      <option value="coverage_enquiry">Coverage enquiry</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="ins-message"
                      className="block font-mono text-[11px] uppercase tracking-wider text-charcoal/80 dark:text-[#D0CDC6] mb-1.5"
                    >
                      Message <span className="text-warm-grey-dark">(Optional)</span>
                    </label>
                    <textarea
                      id="ins-message"
                      rows={3}
                      maxLength={3000}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Share any tender, builder, or project reference details..."
                      className="w-full px-3.5 py-3 border border-warm-grey/60 dark:border-white/20 bg-transparent text-sm font-sans text-charcoal dark:text-white focus:outline-none focus:border-charcoal"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="ins-incident-date"
                        className="block font-mono text-[11px] uppercase tracking-wider text-charcoal/80 dark:text-[#D0CDC6] mb-1.5"
                      >
                        Incident Date <span className="text-brand-red">*</span>
                      </label>
                      <input
                        id="ins-incident-date"
                        type="date"
                        required
                        value={incidentDate}
                        onChange={(e) => setIncidentDate(e.target.value)}
                        className="w-full px-3.5 py-3 border border-warm-grey/60 dark:border-white/20 bg-white dark:bg-[#242523] text-sm font-sans text-charcoal dark:text-white focus:outline-none focus:border-charcoal"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="ins-incident-category"
                        className="block font-mono text-[11px] uppercase tracking-wider text-charcoal/80 dark:text-[#D0CDC6] mb-1.5"
                      >
                        Incident Category <span className="text-brand-red">*</span>
                      </label>
                      <select
                        id="ins-incident-category"
                        value={incidentCategory}
                        onChange={(e) => setIncidentCategory(e.target.value as IncidentCategory)}
                        className="w-full px-3.5 py-3 border border-warm-grey/60 dark:border-white/20 bg-white dark:bg-[#242523] text-sm font-sans text-charcoal dark:text-white focus:outline-none focus:border-charcoal"
                      >
                        <option value="property_damage">Property damage</option>
                        <option value="injury">Injury</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="ins-incident-description"
                      className="block font-mono text-[11px] uppercase tracking-wider text-charcoal/80 dark:text-[#D0CDC6] mb-1.5"
                    >
                      Brief Factual Description <span className="text-brand-red">*</span>
                    </label>
                    <textarea
                      id="ins-incident-description"
                      rows={4}
                      required
                      maxLength={4000}
                      value={incidentDescription}
                      onChange={(e) => setIncidentDescription(e.target.value)}
                      placeholder="Describe what occurred, where on site it happened, and any immediate steps taken..."
                      className="w-full px-3.5 py-3 border border-warm-grey/60 dark:border-white/20 bg-transparent text-sm font-sans text-charcoal dark:text-white focus:outline-none focus:border-charcoal"
                    />
                    <p className="font-sans text-[11px] text-charcoal/65 dark:text-[#B8B5AE] mt-1">
                      Please include only factual site observations. Do not include sensitive medical records, driver licences, or identity documents.
                    </p>
                  </div>

                  {/* Optional Supporting Photographs */}
                  <div>
                    <span className="block font-mono text-[11px] uppercase tracking-wider text-charcoal/80 dark:text-[#D0CDC6] mb-1.5">
                      Supporting Photographs <span className="text-warm-grey-dark">(Optional, max 3)</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 border border-warm-grey/70 dark:border-white/25 text-xs font-mono uppercase tracking-wider text-charcoal dark:text-[#F4F1EA] hover:border-bronze cursor-pointer transition-colors">
                        <ImagePlus className="w-4 h-4 text-bronze shrink-0" aria-hidden="true" />
                        <span>Add Photos (JPEG, PNG, WebP)</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          disabled={photos.length >= 3}
                          onChange={handlePhotoSelection}
                          className="sr-only"
                        />
                      </label>
                      <span className="font-sans text-[11px] text-charcoal/65 dark:text-[#B8B5AE]">
                        Stored privately · Max 8 MB per photo
                      </span>
                    </div>

                    {photos.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {photos.map((photo, idx) => (
                          <li
                            key={`${photo.name}-${idx}`}
                            className="flex items-center justify-between gap-2 px-3 py-2 bg-ivory dark:bg-[#191A18] border border-warm-grey/40 dark:border-white/12 text-xs font-mono"
                          >
                            <span className="truncate text-charcoal dark:text-[#F4F1EA]">
                              {photo.name} ({Math.max(1, Math.round(photo.size / 1024))} KB)
                            </span>
                            <button
                              type="button"
                              onClick={() => removePhotoAt(idx)}
                              aria-label={`Remove ${photo.name}`}
                              className="p-1 text-charcoal/70 dark:text-[#B8B5AE] hover:text-brand-red cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Mandatory Non-Liability Statement & Acknowledgment */}
                  <div className="p-4 bg-ivory dark:bg-[#191A18] border border-warm-grey/50 dark:border-white/15 space-y-3">
                    <p className="font-sans text-xs text-charcoal/85 dark:text-[#E5E2DC] leading-relaxed">
                      {INCIDENT_NON_LIABILITY_STATEMENT}
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        id="ins-disclaimer-ack"
                        type="checkbox"
                        checked={disclaimerAccepted}
                        onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                        className="mt-0.5 w-4 h-4 shrink-0 accent-charcoal"
                      />
                      <span className="font-sans text-xs font-medium text-charcoal dark:text-[#F4F1EA]">
                        I understand and acknowledge this notification statement. <span className="text-brand-red">*</span>
                      </span>
                    </label>
                  </div>
                </>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[48px] bg-charcoal dark:bg-[#F4F1EA] hover:bg-bronze dark:hover:bg-bronze text-white dark:text-[#20211F] dark:hover:text-white py-3.5 px-6 font-mono text-xs uppercase tracking-[0.22em] font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting
                    ? 'Submitting Securely...'
                    : activeOption === 'incident_report'
                      ? 'Submit Incident Notification'
                      : 'Submit Insurance Enquiry'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
