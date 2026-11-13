import { NextResponse } from 'next/server';
import { addApplication } from '@/lib/db/mockData';
import { sendNotificationEmail } from '@/lib/resend/client';

// Disallow GET on public endpoint to strictly protect applicant data and CVs
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405 }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.fullName || !body.email || !body.phone || !body.position) {
      return NextResponse.json(
        { success: false, error: 'Please supply all required applicant fields.' },
        { status: 400 }
      );
    }

    const newApp = await addApplication({
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      position: body.position,
      yearsOfExperience: body.yearsOfExperience || '1+',
      portfolioUrl: body.portfolioUrl,
      coverLetter: body.coverLetter,
      resumeUrl: body.resumeUrl,
    });

    // Send notifications via Resend
    await sendNotificationEmail({
      subject: `New Guild Application: ${body.fullName} (${body.position})`,
      html: `
        <h2>New Strovyn Candidate Application</h2>
        <p><strong>Applicant:</strong> ${body.fullName}</p>
        <p><strong>Position:</strong> ${body.position}</p>
        <p><strong>Email:</strong> ${body.email}</p>
        <p><strong>Phone:</strong> ${body.phone}</p>
        <p><strong>Experience:</strong> ${body.yearsOfExperience}</p>
        <p><strong>CV / Portfolio:</strong> ${body.resumeUrl || body.portfolioUrl || 'None attached'}</p>
      `,
    });

    return NextResponse.json({ success: true, data: { id: newApp.id, createdAt: newApp.createdAt } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
