import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { addQuote, AttachmentClaimError } from '@/lib/db/mockData';
import {
  buildCustomerAcknowledgmentEmail,
  buildQuoteNotificationEmail,
} from '@/lib/resend/templates';
import { quoteRequestSchema } from '@/lib/security/schemas';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';
import { executeIdempotentSubmission } from '@/lib/security/submissionHandler';

const QUOTE_DEDUP_TTL_MS = 15 * 60 * 1000;

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

    const bodyResult = await readJsonBodyWithLimit(req, 32 * 1024);
    if (!bodyResult.ok) {
      return NextResponse.json(
        { success: false, error: bodyResult.error || 'Invalid request format.' },
        { status: bodyResult.status || 400 }
      );
    }

    const parseResult = quoteRequestSchema.safeParse(bodyResult.data);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid quotation details provided.';
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const validated = parseResult.data;
    const dedupKey = buildQuoteDedupKey(req.headers.get('idempotency-key'), validated);
    const emailContent = buildQuoteNotificationEmail({
      ...validated,
      hasAttachment: Boolean(validated.attachmentUrl),
    });

    const outcome = await executeIdempotentSubmission({
      dedupKey,
      logLabel: 'Quote',
      submissionType: 'quote_request',
      ttlMs: QUOTE_DEDUP_TTL_MS,
      emailPayload: {
        ...emailContent,
        recipientKind: 'default',
        replyTo: validated.email,
      },
      acknowledgmentPayload: {
        to: validated.email,
        ...buildCustomerAcknowledgmentEmail({
          recipientName: validated.fullName,
          submissionType: 'quote',
        }),
      },
      persistFn: (idempotencyKey) =>
        addQuote({
          fullName: validated.fullName,
          email: validated.email,
          phone: validated.phone,
          projectLocation: validated.projectLocation || 'Metro Adelaide, SA',
          serviceRequired: validated.serviceRequired,
          propertyType: validated.propertyType,
          description: validated.description,
          preferredContact: validated.preferredContact,
          attachmentUrl: validated.attachmentUrl,
          attachmentToken: validated.attachmentToken,
          idempotencyKey,
        }),
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
    if (err instanceof AttachmentClaimError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }
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
