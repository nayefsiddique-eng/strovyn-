import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { addApplication } from '@/lib/db/mockData';
import { applicationSchema } from '@/lib/security/schemas';
import { escapeHtml } from '@/lib/security/escapeHtml';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';
import { executeIdempotentSubmission } from '@/lib/security/submissionHandler';

const APPLICATION_DEDUP_TTL_MS = 15 * 60 * 1000;

function buildApplicationDedupKey(
  idempotencyHeader: string | null,
  validated: {
    fullName: string;
    email: string;
    phone: string;
    position: string;
    yearsOfExperience?: string;
    portfolioUrl?: string;
    coverLetter?: string;
    resumeUrl?: string;
  }
): string {
  const parts = [
    idempotencyHeader?.trim() ? `hdr:${idempotencyHeader.trim()}` : '',
    validated.fullName.trim().toLowerCase(),
    validated.email.trim().toLowerCase(),
    validated.phone.trim(),
    validated.position.trim().toLowerCase(),
    (validated.yearsOfExperience || '').trim(),
    (validated.portfolioUrl || '').trim(),
    (validated.coverLetter || '').trim(),
    (validated.resumeUrl || '').trim(),
  ];
  const hash = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
  return `app_dedup_${hash}`;
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
    const rateCheck = await checkRateLimit(`application_${clientIp}`, 5, 600000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please wait a few minutes before submitting another application.',
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

    const parseResult = applicationSchema.safeParse(bodyResult.data);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid application details provided.';
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const validated = parseResult.data;
    const dedupKey = buildApplicationDedupKey(req.headers.get('idempotency-key'), validated);

    const safeName = escapeHtml(validated.fullName);
    const safePosition = escapeHtml(validated.position);
    const safeEmail = escapeHtml(validated.email);
    const safePhone = escapeHtml(validated.phone);
    const safeExp = escapeHtml(validated.yearsOfExperience || '1+');
    const safeResume = validated.resumeUrl ? escapeHtml(validated.resumeUrl) : '';
    const safePortfolio = validated.portfolioUrl ? escapeHtml(validated.portfolioUrl) : '';

    const outcome = await executeIdempotentSubmission({
      dedupKey,
      logLabel: 'Application',
      ttlMs: APPLICATION_DEDUP_TTL_MS,
      emailPayload: {
        subject: `New Candidate Application: ${safeName} (${safePosition})`,
        html: `
          <h2>New Strovyn Candidate Application</h2>
          <p><strong>Applicant:</strong> ${safeName}</p>
          <p><strong>Position:</strong> ${safePosition}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Phone:</strong> ${safePhone}</p>
          <p><strong>Experience:</strong> ${safeExp}</p>
          <p><strong>CV Reference:</strong> ${safeResume || 'None attached'}</p>
          <p><strong>Portfolio:</strong> ${safePortfolio || 'None provided'}</p>
        `,
      },
      persistFn: (idempotencyKey) =>
        addApplication({
          fullName: validated.fullName,
          email: validated.email,
          phone: validated.phone,
          position: validated.position,
          yearsOfExperience: validated.yearsOfExperience || '1+',
          portfolioUrl: validated.portfolioUrl || undefined,
          coverLetter: validated.coverLetter || undefined,
          resumeUrl: validated.resumeUrl || undefined,
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
    console.error('Applications route internal error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        error: isUnconfiguredProd
          ? 'Application service is not yet configured in production. Please contact us via WhatsApp.'
          : 'Unable to submit application. Please try again later or reach us via WhatsApp.',
      },
      { status: isUnconfiguredProd ? 503 : 500 }
    );
  }
}
