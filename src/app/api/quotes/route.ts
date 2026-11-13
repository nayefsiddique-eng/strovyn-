import { NextResponse } from 'next/server';
import { addQuote } from '@/lib/db/mockData';
import { sendNotificationEmail } from '@/lib/resend/client';

// Disallow GET on public endpoint to strictly protect customer quotation inquiries
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405 }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.fullName || !body.email || !body.phone || !body.serviceRequired || !body.description) {
      return NextResponse.json(
        { success: false, error: 'Please supply all required fields.' },
        { status: 400 }
      );
    }

    const newQuote = await addQuote({
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      projectLocation: body.projectLocation || 'Metro Adelaide, SA',
      serviceRequired: body.serviceRequired,
      propertyType: body.propertyType,
      description: body.description,
      preferredContact: body.preferredContact || 'email',
      attachmentUrl: body.attachmentUrl,
    });

    // Send notifications via Resend (fails gracefully if unconfigured)
    await sendNotificationEmail({
      subject: `New Quotation Request: ${body.fullName} (${body.serviceRequired})`,
      html: `
        <h2>New Strovyn Quotation Request</h2>
        <p><strong>Client:</strong> ${body.fullName}</p>
        <p><strong>Email:</strong> ${body.email}</p>
        <p><strong>Phone:</strong> ${body.phone}</p>
        <p><strong>Location:</strong> ${body.projectLocation || 'Metro Adelaide'}</p>
        <p><strong>Service:</strong> ${body.serviceRequired}</p>
        <p><strong>Scope:</strong></p>
        <p>${body.description}</p>
      `,
    });

    return NextResponse.json({ success: true, data: { id: newQuote.id, createdAt: newQuote.createdAt } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
