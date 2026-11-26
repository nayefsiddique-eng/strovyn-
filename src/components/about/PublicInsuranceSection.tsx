import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { PublicInsuranceStatus } from '@/lib/cms/insuranceTypes';

export interface PublicInsuranceSectionProps {
  status: PublicInsuranceStatus;
}

export function PublicInsuranceSection({ status }: PublicInsuranceSectionProps) {
  if (!status.isPublished) {
    return null;
  }

  const statement =
    status.statement ||
    'STROVYN maintains public liability insurance in accordance with its current policy. Details of applicable cover can be provided upon request.';

  return (
    <section
      aria-label="Public Liability Insurance & Compliance"
      className="py-16 md:py-24 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30"
    >
      <div className="border border-warm-grey/50 bg-white p-8 sm:p-12 lg:p-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Heading & Eyebrow */}
          <div className="lg:col-span-5">
            <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
              [ COMPLIANCE &amp; CLIENT ASSURANCE ]
            </span>
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-6 h-6 text-bronze flex-shrink-0" aria-hidden="true" />
              <h2 className="type-section-title text-2xl sm:text-3xl lg:text-4xl text-charcoal">
                Public Liability Insurance
              </h2>
            </div>
            <div className="w-12 h-[2px] bg-bronze" />
          </div>

          {/* Right Column: Statement & Verification Note */}
          <div className="lg:col-span-7 space-y-5 font-sans text-base text-charcoal/85 leading-relaxed">
            <p className="text-base sm:text-lg font-medium text-charcoal leading-relaxed">
              {statement}
            </p>
            <p className="text-sm text-charcoal/70 leading-relaxed">
              We operate with rigorous on-site risk mitigation, SWMS protocols, and professional indemnity standards. Certificates of Currency and formal compliance documentation are provided directly to architects, head contractors, and property owners prior to site commencement.
            </p>
            <div className="pt-4 border-t border-warm-grey/30 flex flex-wrap items-center gap-6 text-xs font-mono uppercase tracking-wider text-warm-grey-dark">
              <span>Jurisdiction: South Australia</span>
              <span>&bull;</span>
              <span>Certificate of Currency Available on Request</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
