import { escapeHtml } from '@/lib/security/escapeHtml';

function resolveAdminBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.URL?.trim() ||
    '';
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

function adminLinkHtml(path: string, label: string): string {
  const base = resolveAdminBaseUrl();
  const href = base ? `${base}${path}` : path;
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<p><a href="${safeHref}">${safeLabel}</a></p>`;
}

export function buildQuoteNotificationEmail(input: {
  fullName: string;
  email: string;
  phone: string;
  projectLocation?: string;
  serviceRequired: string;
  propertyType?: string;
  preferredContact: string;
  description: string;
  hasAttachment: boolean;
}) {
  const safeName = escapeHtml(input.fullName);
  const safeEmail = escapeHtml(input.email);
  const safePhone = escapeHtml(input.phone);
  const safeLocation = escapeHtml(input.projectLocation || 'Metro Adelaide, SA');
  const safeService = escapeHtml(input.serviceRequired);
  const safePropertyType = input.propertyType
    ? escapeHtml(input.propertyType)
    : 'Not specified';
  const safePreferred = escapeHtml(input.preferredContact);
  const safeDescription = escapeHtml(input.description);

  return {
    subject: `New Quotation Request: ${input.fullName} (${input.serviceRequired})`,
    html: `
      <h2>New Strovyn Quotation Request</h2>
      <p><strong>Client:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Phone:</strong> ${safePhone}</p>
      <p><strong>Location:</strong> ${safeLocation}</p>
      <p><strong>Service:</strong> ${safeService}</p>
      <p><strong>Property Type:</strong> ${safePropertyType}</p>
      <p><strong>Preferred Contact:</strong> ${safePreferred}</p>
      <p><strong>Attachment:</strong> ${
        input.hasAttachment
          ? 'Uploaded securely (sign in to the Admin Portal to download)'
          : 'None'
      }</p>
      <p><strong>Scope:</strong></p>
      <p>${safeDescription}</p>
      ${adminLinkHtml('/admin/quotes', 'Open Quote Requests in Admin Portal')}
    `,
  };
}

export function buildApplicationNotificationEmail(input: {
  fullName: string;
  email: string;
  phone: string;
  position: string;
  yearsOfExperience?: string;
  portfolioUrl?: string;
  hasResume: boolean;
}) {
  const safeName = escapeHtml(input.fullName);
  const safePosition = escapeHtml(input.position);
  const safeEmail = escapeHtml(input.email);
  const safePhone = escapeHtml(input.phone);
  const safeExp = escapeHtml(input.yearsOfExperience || '1+');
  const safePortfolio = input.portfolioUrl ? escapeHtml(input.portfolioUrl) : 'None provided';

  return {
    subject: `New Candidate Application: ${input.fullName} (${input.position})`,
    html: `
      <h2>New Strovyn Candidate Application</h2>
      <p><strong>Applicant:</strong> ${safeName}</p>
      <p><strong>Vacancy / Position:</strong> ${safePosition}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Phone:</strong> ${safePhone}</p>
      <p><strong>Experience:</strong> ${safeExp}</p>
      <p><strong>CV / Resume:</strong> ${
        input.hasResume
          ? 'Uploaded securely (sign in to the Admin Portal to view)'
          : 'None attached'
      }</p>
      <p><strong>Portfolio:</strong> ${safePortfolio}</p>
      ${adminLinkHtml('/admin/applications', 'Open Job Applications in Admin Portal')}
    `,
  };
}

export function buildContactEnquiryNotificationEmail(input: {
  customerName: string;
  projectReference?: string;
  rating: number;
  message: string;
}) {
  const safeName = escapeHtml(input.customerName);
  const safeProject = escapeHtml(input.projectReference || 'Unspecified');
  const safeMessage = escapeHtml(input.message);

  return {
    subject: `New Client Evaluation (${input.rating}/5): ${input.customerName}`,
    html: `
      <h2>New Strovyn Client Evaluation / Enquiry</h2>
      <p><strong>Client:</strong> ${safeName}</p>
      <p><strong>Rating:</strong> ${input.rating}/5</p>
      <p><strong>Project:</strong> ${safeProject}</p>
      <p><strong>Message:</strong></p>
      <p>${safeMessage}</p>
      ${adminLinkHtml('/admin/feedback', 'Open Customer Feedback in Admin Portal')}
    `,
  };
}

export function buildCustomerAcknowledgmentEmail(input: {
  recipientName: string;
  submissionType: 'quote' | 'application' | 'feedback';
}) {
  const safeName = escapeHtml(input.recipientName);
  const summaryByType = {
    quote: 'your quotation enquiry',
    application: 'your job application',
    feedback: 'your feedback',
  }[input.submissionType];

  return {
    subject: 'Strovyn Painting Co. — Submission Received',
    html: `
      <p>Dear ${safeName},</p>
      <p>Thank you for contacting Strovyn Painting Co. We have received ${escapeHtml(summaryByType)}.</p>
      <p>Our team will review the details you provided. Please note that this automated confirmation is an acknowledgment of receipt only and does not constitute a quotation, offer of employment, or guaranteed response timeframe.</p>
      <p>Kind regards,<br />Strovyn Painting Co.</p>
    `,
  };
}
