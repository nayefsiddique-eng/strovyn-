export interface PublicInsuranceStatus {
  isPublished: boolean;
  statement?: string;
  lastVerified?: string;
}

export interface InsuranceRecord {
  id: string;
  provider_name: string;
  named_insured: string;
  policy_number: string;
  coverage_limit_aud: number;
  policy_commencement_date: string;
  policy_expiry_date: string;
  certificate_storage_path: string | null;
  exclusions_summary: string | null;
  public_statement: string;
  is_published: boolean;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
  is_expired: boolean;
}

export interface UpdateInsuranceInput {
  provider_name: string;
  named_insured: string;
  policy_number: string;
  coverage_limit_aud: number;
  policy_commencement_date: string;
  policy_expiry_date: string;
  certificate_storage_path?: string | null;
  exclusions_summary?: string | null;
  public_statement?: string;
  is_published: boolean;
}

export const APPROVED_PUBLIC_STATEMENT =
  'STROVYN maintains public liability insurance in accordance with its current policy. Details of applicable cover can be provided upon request.';
