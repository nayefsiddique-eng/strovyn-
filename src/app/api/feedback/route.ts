import { NextResponse } from 'next/server';
import { addFeedback } from '@/lib/db/mockData';
import { sendNotificationEmail } from '@/lib/resend/client';

// Disallow GET on public endpoint to prevent exposing client messages or private feedback
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405 }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.customerName || !body.rating || !body.message) {
      return NextResponse.json(
        { success: false, error: 'Name, rating and message are required.' },
        { status: 400 }
      );
    }

    if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating must be a number between 1 and 5.' },
        { status: 400 }
      );
    }

    const newFeedback = await addFeedback({
      customerName: body.customerName,
      email: body.email,
      projectReference: body.projectReference,
      rating: body.rating,
      message: body.message,
      permissionToPublish: Boolean(body.permissionToPublish),
    });

    // Notify business of new evaluation
    await sendNotificationEmail({
      subject: `New Client Evaluation (${body.rating}/5): ${body.customerName}`,
      html: `
        <h2>New Strovyn Client Evaluation</h2>
        <p><strong>Client:</strong> ${body.customerName}</p>
        <p><strong>Rating:</strong> ${body.rating}/5</p>
        <p><strong>Project:</strong> ${body.projectReference || 'Unspecified'}</p>
        <p><strong>Message:</strong></p>
        <p>${body.message}</p>
      `,
    });

    return NextResponse.json({ success: true, data: { id: newFeedback.id, createdAt: newFeedback.createdAt } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
