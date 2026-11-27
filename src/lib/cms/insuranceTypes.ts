export const APPROVED_PUBLIC_STATEMENT =
  'STROVYN maintains public liability insurance in accordance with its current policy. Details of applicable cover can be provided upon request.';

export const INCIDENT_NON_LIABILITY_STATEMENT =
  'Submitting this form notifies STROVYN of the reported incident. It does not constitute acceptance of liability, an insurance claim lodged with an insurer, or confirmation of coverage.';

export const INSURANCE_ENQUIRY_KINDS = [
  'information_request',
  'incident_report',
] as const;
export type InsuranceEnquiryKind = (typeof INSURANCE_ENQUIRY_KINDS)[number];

export const INSURANCE_ENQUIRY_STATUSES = [
  'new',
  'under_review',
  'awaiting_customer',
  'referred_to_insurer',
  'closed',
] as const;
export type InsuranceEnquiryStatus = (typeof INSURANCE_ENQUIRY_STATUSES)[number];

export const INSURANCE_REQUEST_TYPES = [
  'certificate_of_currency',
  'coverage_enquiry',
  'other',
] as const;
export type InsuranceRequestType = (typeof INSURANCE_REQUEST_TYPES)[number];

export const INCIDENT_CATEGORIES = [
  'property_damage',
  'injury',
  'other',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

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

export interface InsuranceIncidentAttachmentSummary {
  id: string;
  original_label: string;
  mime_type: string;
  byte_size: number;
  retention_until: string;
  created_at: string;
}

export interface InsuranceEnquiryAuditEvent {
  id: string;
  enquiry_id: string | null;
  actor_staff_id: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InsuranceEnquirySummary {
  id: string;
  reference_code: string;
  enquiry_kind: InsuranceEnquiryKind;
  status: InsuranceEnquiryStatus;
  is_urgent: boolean;
  full_name: string;
  email: string;
  phone: string | null;
  project_location: string | null;
  request_type: InsuranceRequestType | null;
  incident_date: string | null;
  incident_category: IncidentCategory | null;
  reviewed_at: string | null;
  closed_at: string | null;
  attachment_count: number;
  created_at: string;
  updated_at: string;
}

export interface InsuranceEnquiryDetail extends InsuranceEnquirySummary {
  message: string | null;
  incident_description: string | null;
  disclaimer_acknowledged: boolean;
  reviewed_by: string | null;
  internal_notes: string | null;
  follow_up_actions: string | null;
  closed_by: string | null;
  attachments: InsuranceIncidentAttachmentSummary[];
  audit_log: InsuranceEnquiryAuditEvent[];
}

export interface InsuranceEnquiryCounts {
  total: number;
  openCount: number;
  urgentOpenCount: number;
  infoRequestCount: number;
  incidentReportCount: number;
}

export interface AdminInsuranceWorkspaceSnapshot {
  enquiries: InsuranceEnquirySummary[];
  counts: InsuranceEnquiryCounts;
  policyRecord: InsuranceRecord | null;
}

export const INSURANCE_STATUS_LABELS: Record<InsuranceEnquiryStatus, string> = {
  new: 'New',
  under_review: 'Under Review',
  awaiting_customer: 'Awaiting Customer',
  referred_to_insurer: 'Referred to Insurer',
  closed: 'Closed',
};

export const INSURANCE_REQUEST_TYPE_LABELS: Record<InsuranceRequestType, string> = {
  certificate_of_currency: 'Certificate of Currency',
  coverage_enquiry: 'Coverage enquiry',
  other: 'Other',
};

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  property_damage: 'Property damage',
  injury: 'Injury',
  other: 'Other',
};
