'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

const OPENINGS = [
  {
    id: 'op-01',
    title: 'Precision Architectural Painter',
    type: 'Expression of Interest',
    location: 'Adelaide, South Australia',
    desc: 'Expression of interest for experienced trade painters proficient in zero-tolerance substrate preparation, dust-controlled orbital sanding, and fine hand-cut edge lines.',
    reqs: [
      'Proven background in high-end residential or commercial architectural finishing',
      'Commitment to clean site discipline and respectful client presentation',
      'Valid White Card and South Australia driver’s licence',
    ],
  },
  {
    id: 'op-02',
    title: 'Cabinetry & Fine Joinery Sprayer',
    type: 'Expression of Interest',
    location: 'Adelaide, South Australia',
    desc: 'General talent register for spray craftspeople experienced in polyurethane finishes, cabinetry transformations, and timber joinery lacquering.',
    reqs: [
      'Demonstrated experience with fine woodwork and cabinetry finishes',
      'Knowledge of surface containment and spray equipment maintenance',
      'Meticulous masking and substrate rectification discipline',
    ],
  },
];

export default function CareersPage() {
  const [formState, setFormState] = useState({
    fullName: '',
    email: '',
    phone: '',
    position: 'Senior Architectural Spray Technician',
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

  const idempotencyKeyRef = React.useRef<string>('');

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

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal">
      {/* Header */}
      <section className="relative pt-36 pb-16 md:pt-44 md:pb-24 border-b border-warm-grey/30 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-4">
          [ 01 / THE GUILD OF MASTER FINISHERS ]
        </span>
        <h1 className="type-page-title text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-charcoal max-w-4xl mb-8">
          Careers in Architectural Craftsmanship
        </h1>
        <p className="font-sans text-lg sm:text-xl text-charcoal/80 max-w-2xl leading-relaxed">
          We operate not as high-volume commodity painters, but as a disciplined finishing guild. We respect the trade, invest in surgical tooling, and reward uncompromising quality.
        </p>
      </section>

      {/* Openings Section */}
      <section className="py-20 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30">
        <div className="mb-12">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-2">
            CURRENT POSITIONS
          </span>
          <h2 className="type-section-title text-3xl sm:text-4xl text-charcoal">
            Active Commissions &amp; Opportunities
          </h2>
        </div>

        <div className="space-y-6">
          {OPENINGS.map((op) => (
            <div
              key={op.id}
              className="p-6 sm:p-8 bg-white border border-warm-grey/40 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              <div className="lg:col-span-8 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs bg-bronze text-white px-2.5 py-0.5 uppercase tracking-wider">
                    {op.type}
                  </span>
                  <span className="font-sans text-xs text-warm-grey-dark">
                    {op.location}
                  </span>
                </div>
                <h3 className="type-card-title text-2xl text-charcoal">{op.title}</h3>
                <p className="font-sans text-sm text-charcoal/80 leading-relaxed">
                  {op.desc}
                </p>
                <div className="pt-2">
                  <span className="font-sans text-xs uppercase text-warm-grey-dark block mb-1">
                    Key Prerequisites:
                  </span>
                  <ul className="text-xs text-charcoal/85 space-y-1">
                    {op.reqs.map((r, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-bronze" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-4 lg:text-right pt-4 lg:pt-0">
                <button
                  type="button"
                  onClick={() => {
                    setFormState((prev) => ({ ...prev, position: op.title }));
                    const el = document.getElementById('application-form');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="font-sans text-xs uppercase tracking-widest px-5 py-3 bg-charcoal text-white hover:bg-bronze transition-colors cursor-pointer"
                >
                  Apply For Role &darr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Application Form */}
      <section id="application-form" className="py-20 px-6 sm:px-8 lg:px-12 max-w-4xl mx-auto">
        <div className="bg-white border border-warm-grey/40 p-8 sm:p-12">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-2">
            SUBMIT CREDENTIALS
          </span>
          <h2 className="type-section-title text-3xl sm:text-4xl text-charcoal mb-4">
            Application &amp; Expression of Interest
          </h2>
          <p className="font-sans text-sm text-charcoal/75 leading-relaxed mb-8">
            Tell us about your background, craftsmanship philosophy, and surface finishes experience.
          </p>

          {submitted ? (
            <div className="p-8 bg-ivory border border-bronze text-center space-y-3">
              <span className="type-card-title text-2xl text-charcoal block">Application Received</span>
              <p className="font-sans text-sm text-charcoal/80">
                Thank you for submitting your credentials. Our operations director will review your portfolio and get in touch within 2 business days.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMsg && (
                <div className="p-4 bg-red-50 border border-red-300 text-xs text-red-800">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Input
                  label="Full Name"
                  required
                  placeholder="Your full name"
                  value={formState.fullName}
                  onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                />
                <Input
                  label="Email Address"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={formState.email}
                  onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Input
                  label="Telephone"
                  type="tel"
                  required
                  placeholder="+61 400 000 000"
                  value={formState.phone}
                  onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                />
                <Input
                  label="Position of Interest"
                  required
                  value={formState.position}
                  onChange={(e) => setFormState({ ...formState, position: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Input
                  label="Years of Experience"
                  placeholder="e.g. 7 years"
                  value={formState.yearsOfExperience}
                  onChange={(e) => setFormState({ ...formState, yearsOfExperience: e.target.value })}
                />
                <Input
                  label="Portfolio / Instagram / Website Link"
                  placeholder="https://..."
                  value={formState.portfolioUrl}
                  onChange={(e) => setFormState({ ...formState, portfolioUrl: e.target.value })}
                />
              </div>

              <Textarea
                label="Summary of Craftsmanship &amp; Equipment Knowledge"
                rows={4}
                placeholder="Mention spray setups, plaster experience, and notable projects..."
                value={formState.coverLetter}
                onChange={(e) => setFormState({ ...formState, coverLetter: e.target.value })}
              />

              {/* Resume / CV File Upload */}
              <div className="p-4 bg-ivory border border-warm-grey/30 space-y-2">
                <span className="font-sans text-xs uppercase tracking-wider text-charcoal font-medium block">
                  Attach Curriculum Vitae (CV) / Resume
                </span>
                <p className="text-[11px] text-warm-grey-dark">
                  Accepted formats: PDF, DOCX, DOC (Maximum 15MB).
                </p>
                <input
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
                      if (upRes.ok && upData.success && typeof upData.fileReference === 'string' && upData.fileReference.length > 0) {
                        setFormState((prev) => ({
                          ...prev,
                          resumeUrl: upData.fileReference,
                          resumeToken: typeof upData.uploadToken === 'string' ? upData.uploadToken : '',
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
                  className="text-xs file:mr-3 file:py-1.5 file:px-3 file:border-0 file:bg-charcoal file:text-white file:text-xs file:font-sans file:cursor-pointer"
                />
                {uploadingResume && <span className="text-xs text-bronze animate-pulse block">Uploading resume...</span>}
                {resumeFileName && (
                  <span className="text-xs text-emerald-700 block font-medium">
                    ✓ Resume attached: {resumeFileName}
                  </span>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading || uploadingResume}
                className="w-full text-center"
              >
                Submit Application To Guild
              </Button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
