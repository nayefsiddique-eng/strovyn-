'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  FileUp,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { InsuranceRecord } from '@/lib/cms/insuranceTypes';
import { APPROVED_PUBLIC_STATEMENT } from '@/lib/cms/insuranceTypes';

interface AdminInsuranceWorkspaceProps {
  initialRecord: InsuranceRecord | null;
}

export function AdminInsuranceWorkspace({
  initialRecord,
}: AdminInsuranceWorkspaceProps) {
  const [providerName, setProviderName] = useState(
    initialRecord?.provider_name || ''
  );
  const [namedInsured, setNamedInsured] = useState(
    initialRecord?.named_insured || 'Strovyn Painting Co.'
  );
  const [policyNumber, setPolicyNumber] = useState(
    initialRecord?.policy_number || ''
  );
  const [coverageLimitAud, setCoverageLimitAud] = useState<number | ''>(
    initialRecord?.coverage_limit_aud || 20000000
  );
  const [commencementDate, setCommencementDate] = useState(
    initialRecord?.policy_commencement_date || ''
  );
  const [expiryDate, setExpiryDate] = useState(
    initialRecord?.policy_expiry_date || ''
  );
  const [certificateStoragePath, setCertificateStoragePath] = useState(
    initialRecord?.certificate_storage_path || ''
  );
  const [exclusionsSummary, setExclusionsSummary] = useState(
    initialRecord?.exclusions_summary || ''
  );
  const [publicStatement, setPublicStatement] = useState(
    initialRecord?.public_statement || APPROVED_PUBLIC_STATEMENT
  );
  const [isPublished, setIsPublished] = useState(
    initialRecord?.is_published || false
  );

  const [uploadingCert, setUploadingCert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isExpired = Boolean(initialRecord?.is_expired);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadingCert(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/insurance/certificate', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Certificate upload failed.');
      }

      setCertificateStoragePath(data.storagePath);
      setSuccessMsg(`Certificate uploaded: ${data.fileName}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingCert(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (isPublished) {
      if (!providerName.trim()) {
        setErrorMsg('Insurer / provider name is required to publish.');
        return;
      }
      if (!namedInsured.trim()) {
        setErrorMsg('Named insured is required to publish.');
        return;
      }
      if (!policyNumber.trim()) {
        setErrorMsg('Policy number is required to publish.');
        return;
      }
      if (!coverageLimitAud || coverageLimitAud <= 0) {
        setErrorMsg('Coverage limit must be greater than $0 AUD to publish.');
        return;
      }
      if (!certificateStoragePath) {
        setErrorMsg(
          'A verified Certificate of Currency document must be uploaded before publishing.'
        );
        return;
      }
      if (isExpired) {
        setErrorMsg(
          `Cannot publish an expired policy. Expiry date (${expiryDate}) is in the past.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_name: providerName,
          named_insured: namedInsured,
          policy_number: policyNumber,
          coverage_limit_aud: Number(coverageLimitAud),
          policy_commencement_date: commencementDate,
          policy_expiry_date: expiryDate,
          certificate_storage_path: certificateStoragePath || null,
          exclusions_summary: exclusionsSummary || null,
          public_statement: publicStatement,
          is_published: isPublished,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to save record.');
      }

      setSuccessMsg(
        isPublished
          ? 'Insurance policy verified and PUBLISHED to public website.'
          : 'Insurance policy saved as UNPUBLISHED draft. Public website remains suppressed.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="bg-white border border-warm-grey/60 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-bronze font-medium">
                [ COMPLIANCE &amp; GOVERNANCE ]
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-charcoal/5 text-charcoal border border-charcoal/20">
                <Lock className="w-3 h-3 text-bronze" aria-hidden="true" />
                Admin Restricted
              </span>
            </div>
            <h1 className="type-section-title text-3xl sm:text-4xl text-charcoal">
              Public Liability Insurance
            </h1>
            <p className="font-sans text-sm text-charcoal/75 mt-2 max-w-3xl leading-relaxed">
              Manage verified liability insurance credentials. Until client-supplied proof is verified and published, the public liability section remains completely suppressed on the live site.
            </p>
          </div>

          {/* Current Status Badge */}
          <div className="flex-shrink-0">
            {isPublished && !isExpired ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-mono uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>Live &amp; Published</span>
              </div>
            ) : isPublished && isExpired ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-mono uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-amber-600" aria-hidden="true" />
                <span>Expired (Auto-Suppressed)</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-charcoal/5 border border-charcoal/20 text-charcoal/80 text-xs font-mono uppercase tracking-wider">
                <Shield className="w-4 h-4 text-bronze" aria-hidden="true" />
                <span>Unpublished (Suppressed)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-300 text-red-900 text-sm flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="font-semibold block mb-0.5">Validation Requirement</strong>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm flex items-start gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Governance Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Private Policy Credentials */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-warm-grey/60 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-warm-grey/30 pb-3">
              <h2 className="font-sans text-base font-semibold text-charcoal flex items-center gap-2">
                <Lock className="w-4 h-4 text-bronze" aria-hidden="true" />
                Private Policy Credentials
              </h2>
              <span className="font-mono text-[10px] uppercase text-warm-grey-dark">
                Never exposed to public visitors
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                  Insurer / Provider Name <span className="text-brand-red">*</span>
                </label>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="e.g. QBE Insurance / Allianz"
                  className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal focus:border-charcoal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                  Named Insured <span className="text-brand-red">*</span>
                </label>
                <input
                  type="text"
                  value={namedInsured}
                  onChange={(e) => setNamedInsured(e.target.value)}
                  placeholder="e.g. Strovyn Painting Co."
                  className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal focus:border-charcoal focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                  Policy Number <span className="text-brand-red">*</span>
                </label>
                <input
                  type="text"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  placeholder="e.g. POL-7729103-AU"
                  className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal focus:border-charcoal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                  Coverage Limit ($ AUD) <span className="text-brand-red">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="100000"
                  value={coverageLimitAud}
                  onChange={(e) =>
                    setCoverageLimitAud(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  placeholder="20000000"
                  className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal focus:border-charcoal focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                  Commencement Date <span className="text-brand-red">*</span>
                </label>
                <input
                  type="date"
                  value={commencementDate}
                  onChange={(e) => setCommencementDate(e.target.value)}
                  className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal focus:border-charcoal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                  Expiry Date <span className="text-brand-red">*</span>
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className={`w-full px-3 py-2 border text-sm font-sans text-charcoal focus:outline-none ${
                    isExpired ? 'border-amber-500 bg-amber-50/50' : 'border-warm-grey focus:border-charcoal'
                  }`}
                />
                {isExpired && (
                  <span className="text-[11px] font-mono text-amber-700 block mt-1">
                    Policy has expired. Cannot be published.
                  </span>
                )}
              </div>
            </div>

            {/* Certificate of Currency Private Upload */}
            <div className="pt-2 border-t border-warm-grey/30">
              <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                Certificate of Currency (Private Storage) <span className="text-brand-red">*</span>
              </label>
              <p className="font-sans text-xs text-charcoal/70 mb-2">
                Upload verified insurer document (PDF, PNG, JPG). Stored in a private compliance bucket with zero public access.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 border border-charcoal text-xs font-mono uppercase tracking-wider text-charcoal hover:bg-charcoal hover:text-white transition-colors cursor-pointer">
                  <FileUp className="w-4 h-4 text-bronze" aria-hidden="true" />
                  <span>{uploadingCert ? 'Uploading...' : 'Choose File'}</span>
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    disabled={uploadingCert}
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>

                {certificateStoragePath ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-mono text-charcoal/80">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    <span>Uploaded: {certificateStoragePath.split('/').pop()}</span>
                    <a
                      href={`/api/admin/insurance/certificate?path=${encodeURIComponent(
                        certificateStoragePath
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-bronze underline ml-2"
                    >
                      Download
                    </a>
                  </div>
                ) : (
                  <span className="text-xs font-mono text-warm-grey-dark">
                    No certificate uploaded yet
                  </span>
                )}
              </div>
            </div>

            {/* Exclusions Summary */}
            <div className="pt-2 border-t border-warm-grey/30">
              <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                Policy Exclusions &amp; Scope Summary (Internal)
              </label>
              <textarea
                rows={2}
                value={exclusionsSummary}
                onChange={(e) => setExclusionsSummary(e.target.value)}
                placeholder="e.g. Standard building defects excluded; high-risk industrial works excluded."
                className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal focus:border-charcoal focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Public Statement & Publishing Governance */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-warm-grey/60 p-6 space-y-5">
            <h2 className="font-sans text-base font-semibold text-charcoal">
              Public Statement Governance
            </h2>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-charcoal/80 mb-1">
                Approved Client Wording
              </label>
              <textarea
                rows={4}
                value={publicStatement}
                onChange={(e) => setPublicStatement(e.target.value)}
                className="w-full px-3 py-2 border border-warm-grey text-sm font-sans text-charcoal focus:border-charcoal focus:outline-none leading-relaxed"
              />
              <p className="font-sans text-[11px] text-charcoal/60 mt-1">
                This exact text is delivered on the About page. Details of applicable cover are provided upon request.
              </p>
            </div>

            {/* Publication Toggle */}
            <div className="pt-4 border-t border-warm-grey/30">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="mt-1 w-4 h-4 text-charcoal rounded border-warm-grey focus:ring-0"
                />
                <div>
                  <span className="block text-sm font-semibold text-charcoal">
                    Publish Public Liability Section
                  </span>
                  <span className="font-sans text-xs text-charcoal/70 block leading-relaxed mt-0.5">
                    When enabled and verified, the public section appears on the About page and trust pill on the Homepage. If disabled or expired, the public site shows zero mention.
                  </span>
                </div>
              </label>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-warm-grey/30">
              <button
                type="submit"
                disabled={saving || uploadingCert}
                className="w-full py-3.5 bg-charcoal text-white hover:bg-black font-mono text-xs uppercase tracking-[0.2em] font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Compliance Record'}
              </button>
            </div>
          </div>

          {/* Live Visitor Preview */}
          <div className="bg-ivory border border-warm-grey/60 p-6 space-y-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-bronze block">
              Visitor Visibility Preview
            </span>
            {isPublished && !isExpired ? (
              <div className="bg-white p-4 border border-warm-grey/40 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-bronze" aria-hidden="true" />
                  <span className="type-card-title text-base text-charcoal">
                    Public Liability Insurance
                  </span>
                </div>
                <p className="font-sans text-xs text-charcoal/80 leading-relaxed">
                  {publicStatement}
                </p>
                <div className="pt-2 text-[10px] font-mono text-warm-grey-dark uppercase tracking-wider">
                  Details provided upon request · Current Policy Active
                </div>
              </div>
            ) : (
              <div className="p-4 border border-dashed border-warm-grey/80 text-center text-xs font-mono text-warm-grey-dark">
                [ Section Completely Suppressed from Visitors ]
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
