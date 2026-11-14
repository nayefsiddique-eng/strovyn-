import { NextResponse } from 'next/server';
import { addQuote } from '@/lib/db/mockData';
import { sendNotificationEmail } from '@/lib/resend/client';
import { quoteRequestSchema } from '@/lib/security/schemas';
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

    // 3. Persist (fails closed if in production without Supabase)
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

    // 4. Send notification with escaped values
    const safeName = escapeHtml(validated.fullName);
    const safeEmail = escapeHtml(validated.email);
    const safePhone = escapeHtml(validated.phone);
    const safeLocation = escapeHtml(validated.projectLocation);
    const safeService = escapeHtml(validated.serviceRequired);
    const safeDescription = escapeHtml(validated.description);
    const safeAttachment = validated.attachmentUrl ? escapeHtml(validated.attachmentUrl) : '';

    await sendNotificationEmail({
      subject: `New Quotation Request: ${safeName} (${safeService})`,
      html: `
        <h2>New Strovyn Quotation Request</h2>
        <p><strong>Client:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Phone:</strong> ${safePhone}</p>
        <p><strong>Location:</strong> ${safeLocation}</p>
        <p><strong>Service:</strong> ${safeService}</p>
        <p><strong>Attachment:</strong> ${safeAttachment || 'None'}</p>
        <p><strong>Scope:</strong></p>
        <p>${safeDescription}</p>
      `,
    });

    return NextResponse.json(
      {
        success: true,
        data: { id: newQuote.id, createdAt: newQuote.createdAt },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Quotes route internal error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to process quotation request. Please try again later or contact us directly.',
      },
      { status: 500 }
    );
  }
}
