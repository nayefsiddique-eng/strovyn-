import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { addQuote } from '@/lib/db/mockData';
import { sendNotificationEmail } from '@/lib/resend/client';
import { quoteRequestSchema } from '@/lib/security/schemas';
import { escapeHtml } from '@/lib/security/escapeHtml';
import {
  checkRateLimit,
  getRecentSubmissionRecord,
  saveSubmissionRecord,
  withSubmissionLock,
} from '@/lib/security/rateLimiter';

const QUOTE_DEDUP_TTL_MS = 15 * 60 * 1000; // 15-minute idempotency window

function buildQuoteEmailPayload(validated: {
  fullName: string;
  email: string;
  phone: string;
  projectLocation: string;
  serviceRequired: string;
  propertyType?: string;
  preferredContact: string;
  description: string;
  attachmentUrl?: string;
}) {
  const safeName = escapeHtml(validated.fullName);
  const safeEmail = escapeHtml(validated.email);
  const safePhone = escapeHtml(validated.phone);
  const safeLocation = escapeHtml(validated.projectLocation || 'Metro Adelaide, SA');
  const safeService = escapeHtml(validated.serviceRequired);
  const safePropertyType = validated.propertyType
    ? escapeHtml(validated.propertyType)
    : 'Not specified';
  const safePreferred = escapeHtml(validated.preferredContact);
  const safeDescription = escapeHtml(validated.description);
  const safeAttachment = validated.attachmentUrl ? escapeHtml(validated.attachmentUrl) : '';

  return {
    subject: `New Quotation Request: ${safeName} (${safeService})`,
    html: `
      <h2>New Strovyn Quotation Request</h2>
      <p><strong>Client:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Phone:</strong> ${safePhone}</p>
      <p><strong>Location:</strong> ${safeLocation}</p>
      <p><strong>Service:</strong> ${safeService}</p>
      <p><strong>Property Type:</strong> ${safePropertyType}</p>
      <p><strong>Preferred Contact:</strong> ${safePreferred}</p>
      <p><strong>Attachment:</strong> ${safeAttachment || 'None'}</p>
      <p><strong>Scope:</strong></p>
      <p>${safeDescription}</p>
    `,
  };
}

function buildQuoteDedupKey(
  idempotencyHeader: string | null,
  validated: {
    fullName: string;
    email: string;
    phone: string;
    projectLocation: string;
    serviceRequired: string;
    propertyType?: string;
    preferredContact: string;
    description: string;
    attachmentUrl?: string;
  }
): string {
  // Always include the full normalized enquiry payload so two genuinely different
  // enquiries from the same customer never collide, even if an Idempotency-Key header is reused.
  const payloadParts = [
    validated.fullName.trim().toLowerCase(),
    validated.email.trim().toLowerCase(),
    validated.phone.trim(),
    (validated.projectLocation || 'Metro Adelaide, SA').trim().toLowerCase(),
    validated.serviceRequired.trim(),
    (validated.propertyType || '').trim(),
    validated.preferredContact.trim(),
    validated.description.trim(),
    (validated.attachmentUrl || '').trim(),
  ];
  const headerPart = idempotencyHeader?.trim() ? `hdr:${idempotencyHeader.trim()}` : '';
  const source = [headerPart, ...payloadParts].join('|');
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 32);
  return `quote_dedup_${hash}`;
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405 }
  );
}

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting (5 requests per 5 minutes per IP)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local-client';
    const rateCheck = await checkRateLimit(`quote_${clientIp}`, 5, 300000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please wait a few minutes before submitting another request.',
        },
        { status: 429 }
      );
    }

    // 2. Parse & Zod Validate
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request format.' },
        { status: 400 }
      );
    }

    const parseResult = quoteRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid quotation details provided.';
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const validated = parseResult.data;
    const dedupKey = buildQuoteDedupKey(req.headers.get('idempotency-key'), validated);
    const emailPayload = buildQuoteEmailPayload(validated);

    // 3. Concurrent-Safe Duplicate Suppression + Persist-Once
    // Coalesces concurrent requests on the same key and persists the dedup record
    // immediately after addQuote() succeeds (so email failure never causes a duplicate row).
    const outcome = await withSubmissionLock(dedupKey, async () => {
      const existingRecord = getRecentSubmissionRecord(dedupKey, QUOTE_DEDUP_TTL_MS);
      if (existingRecord) {
        let notified = existingRecord.notified;
        if (!notified) {
          const retryNotify = await sendNotificationEmail(emailPayload);
          notified = Boolean(retryNotify.success);
          if (notified) {
            saveSubmissionRecord(dedupKey, { ...existingRecord, notified: true });
          }
        }
        return {
          status: 200,
          id: existingRecord.id,
          createdAt: existingRecord.createdAt,
          notified,
          deduplicated: true,
        };
      }

      // Persist once (fails closed in production if Supabase is missing/failing,
      // in which case this throws before saving any dedup record).
      const newQuote = await addQuote({
        fullName: validated.fullName,
        email: validated.email,
        phone: validated.phone,
        projectLocation: validated.projectLocation || 'Metro Adelaide, SA',
        serviceRequired: validated.serviceRequired,
        propertyType: validated.propertyType,
        description: validated.description,
        preferredContact: validated.preferredContact,
        attachmentUrl: validated.attachmentUrl,
      });

      const baseRecord = {
        id: newQuote.id,
        createdAt: newQuote.createdAt,
        notified: false,
        storedAt: Date.now(),
      };
      saveSubmissionRecord(dedupKey, baseRecord);

      let notified = false;
      try {
        const notifyResult = await sendNotificationEmail(emailPayload);
        notified = Boolean(notifyResult.success);
        if (notified) {
          saveSubmissionRecord(dedupKey, { ...baseRecord, notified: true });
        } else {
          console.warn(
            `Quote ${newQuote.id} persisted, but owner email notification was not delivered (configured=${Boolean(notifyResult.configured)}).`
          );
        }
      } catch (notifyErr) {
        console.warn(
          `Quote ${newQuote.id} persisted, but email notification threw unexpectedly:`,
          notifyErr instanceof Error ? notifyErr.message : 'Unknown error'
        );
      }

      return {
        status: 201,
        id: newQuote.id,
        createdAt: newQuote.createdAt,
        notified,
        deduplicated: false,
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: outcome.id,
          createdAt: outcome.createdAt,
          notified: outcome.notified,
          ...(outcome.deduplicated ? { deduplicated: true } : {}),
        },
      },
      { status: outcome.status }
    );
  } catch (err: unknown) {
    const isUnconfiguredProd =
      err instanceof Error &&
      err.message.includes('Supabase database is required in production');
    console.error('Quotes route internal error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        error: isUnconfiguredProd
          ? 'Quote database service is not yet configured in production. Please contact us directly via WhatsApp.'
          : 'Unable to process quotation request. Please try again later or contact us directly.',
      },
      { status: isUnconfiguredProd ? 503 : 500 }
    );
  }
}
