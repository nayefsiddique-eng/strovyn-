import { NextResponse } from 'next/server';
import { addFeedback } from '@/lib/db/mockData';
import { sendNotificationEmail } from '@/lib/resend/client';
import { feedbackSchema } from '@/lib/security/schemas';
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
    // 1. Rate Limiting (5 requests per 5 minutes per IP)
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

    const parseResult = feedbackSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid feedback provided.';
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const validated = parseResult.data;

    // 3. Persist
    const newFeedback = await addFeedback({
      customerName: validated.customerName,
      email: validated.email,
      projectReference: validated.projectReference,
      rating: validated.rating,
      message: validated.message,
      permissionToPublish: validated.permissionToPublish,
    });

    // 4. Notify business with escaped values
    const safeName = escapeHtml(validated.customerName);
    const safeProject = escapeHtml(validated.projectReference || 'Unspecified');
    const safeMessage = escapeHtml(validated.message);

    await sendNotificationEmail({
      subject: `New Client Evaluation (${validated.rating}/5): ${safeName}`,
      html: `
        <h2>New Strovyn Client Evaluation</h2>
        <p><strong>Client:</strong> ${safeName}</p>
        <p><strong>Rating:</strong> ${validated.rating}/5</p>
        <p><strong>Project:</strong> ${safeProject}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
    });

    return NextResponse.json(
      {
        success: true,
        data: { id: newFeedback.id, createdAt: newFeedback.createdAt },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Feedback route internal error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to submit feedback at this time. Please try again later.',
      },
      { status: 500 }
    );
  }
}
