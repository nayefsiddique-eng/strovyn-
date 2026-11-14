import { NextResponse } from 'next/server';
import { addApplication } from '@/lib/db/mockData';
import { sendNotificationEmail } from '@/lib/resend/client';
import { applicationSchema } from '@/lib/security/schemas';
import { escapeHtml } from '@/lib/security/escapeHtml';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405 }
  );
}

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting (5 requests per 10 minutes per IP)
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

    const parseResult = applicationSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid application details provided.';
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const validated = parseResult.data;

    // 3. Persist
    const newApp = await addApplication({
      fullName: validated.fullName,
      email: validated.email,
      phone: validated.phone,
      position: validated.position,
      yearsOfExperience: validated.yearsOfExperience || '1+',
      portfolioUrl: validated.portfolioUrl || undefined,
      coverLetter: validated.coverLetter || undefined,
      resumeUrl: validated.resumeUrl || undefined,
    });

    // 4. Send notification with escaped values
    const safeName = escapeHtml(validated.fullName);
    const safePosition = escapeHtml(validated.position);
    const safeEmail = escapeHtml(validated.email);
    const safePhone = escapeHtml(validated.phone);
    const safeExp = escapeHtml(validated.yearsOfExperience);
    const safeResume = validated.resumeUrl ? escapeHtml(validated.resumeUrl) : '';
    const safePortfolio = validated.portfolioUrl ? escapeHtml(validated.portfolioUrl) : '';

    await sendNotificationEmail({
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
    });

    return NextResponse.json(
      {
        success: true,
        data: { id: newApp.id, createdAt: newApp.createdAt },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Applications route internal error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to submit application. Please try again later or email us directly.',
      },
      { status: 500 }
    );
  }
}
