import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { PublicInsuranceStatus } from '@/lib/cms/insuranceTypes';

export interface InsuranceTrustPillProps {
  status: PublicInsuranceStatus;
  className?: string;
}

export function InsuranceTrustPill({
  status,
  className = '',
}: InsuranceTrustPillProps) {
  if (!status.isPublished) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-mono uppercase tracking-wider ${className}`}
      title="Public liability insurance maintained in South Australia. Certificate of Currency provided upon request."
    >
      <ShieldCheck className="w-3.5 h-3.5 text-white/90 flex-shrink-0" aria-hidden="true" />
      <span>Public Liability Insured &middot; Verification on Request</span>
    </div>
  );
}
