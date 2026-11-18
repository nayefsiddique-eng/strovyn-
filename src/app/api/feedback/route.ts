import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { addFeedback } from '@/lib/db/mockData';
import { feedbackSchema } from '@/lib/security/schemas';
import { escapeHtml } from '@/lib/security/escapeHtml';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';
import { executeIdempotentSubmission } from '@/lib/security/submissionHandler';

const FEEDBACK_DEDUP_TTL_MS = 15 * 60 * 1000;

function buildFeedbackDedupKey(
  idempotencyHeader: string | null,
  validated: {
    customerName: string;
    email?: string;
    projectReference?: string;
    rating: number;
    message: string;
    permissionToPublish: boolean;
  }
): string {
  const parts = [
    idempotencyHeader?.trim() ? `hdr:${idempotencyHeader.trim()}` : '',
    validated.customerName.trim().toLowerCase(),
    (validated.email || '').trim().toLowerCase(),
    (validated.projectReference || '').trim().toLowerCase(),
    String(validated.rating),
    validated.message.trim(),
    String(validated.permissionToPublish),
  ];
  const hash = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
  return `feedback_dedup_${hash}`;
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
    const rateCheck = await checkRateLimit(`feedback_${clientIp}`, 5, 300000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please wait a few minutes before submitting another review.',
        },
        { status: 429 }
      );
    }

    const bodyResult = await readJsonBodyWithLimit(req, 32 * 1024);
    if (!bodyResult.ok) {
      return NextResponse.json(
        { success: false, error: bodyResult.error || 'Invalid JSON request format.' },
        { status: bodyResult.status || 400 }
      );
    }

    const parseResult = feedbackSchema.safeParse(bodyResult.data);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid feedback provided.';
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const validated = parseResult.data;
    const dedupKey = buildFeedbackDedupKey(req.headers.get('idempotency-key'), validated);

    const safeName = escapeHtml(validated.customerName);
    const safeProject = escapeHtml(validated.projectReference || 'Unspecified');
    const safeMessage = escapeHtml(validated.message);

    const outcome = await executeIdempotentSubmission({
      dedupKey,
      logLabel: 'Feedback',
      ttlMs: FEEDBACK_DEDUP_TTL_MS,
      emailPayload: {
        subject: `New Client Evaluation (${validated.rating}/5): ${safeName}`,
        html: `
          <h2>New Strovyn Client Evaluation</h2>
          <p><strong>Client:</strong> ${safeName}</p>
          <p><strong>Rating:</strong> ${validated.rating}/5</p>
          <p><strong>Project:</strong> ${safeProject}</p>
          <p><strong>Message:</strong></p>
          <p>${safeMessage}</p>
        `,
      },
      persistFn: (idempotencyKey) =>
        addFeedback({
          customerName: validated.customerName,
          email: validated.email,
          projectReference: validated.projectReference,
          rating: validated.rating,
          message: validated.message,
          permissionToPublish: validated.permissionToPublish,
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
    const isUnconfiguredProd =
      err instanceof Error &&
      err.message.includes('Supabase database is required in production');
    console.error('Feedback route internal error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        error: isUnconfiguredProd
          ? 'Feedback service is not yet configured in production.'
          : 'Unable to submit feedback at this time. Please try again later.',
      },
      { status: isUnconfiguredProd ? 503 : 500 }
    );
  }
}
