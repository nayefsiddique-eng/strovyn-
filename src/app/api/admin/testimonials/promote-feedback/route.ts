import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { requireStaffSession, resolveAuthenticatedStaff } from '@/lib/cms/staffAuth';
import {
  listPromotableFeedback,
  promoteFeedbackToTestimonialDraft,
} from '@/lib/cms/testimonialsService';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_PROMOTE_BYTES = 16 * 1024;

export async function GET() {
  try {
    const staff = await requireStaffSession({ action: 'testimonial:promote_feedback' });
    const feedback = await listPromotableFeedback(staff);
    return NextResponse.json(
      { success: true, feedback },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'testimonials_promote', 30, 60_000);

    const staff = await resolveAuthenticatedStaff();
    const bodyCheck = await readJsonBodyWithLimit(req, MAX_PROMOTE_BYTES);
    if (!bodyCheck.ok) {
      throw new EditorialHttpError(
        bodyCheck.status === 413 ? 413 : 400,
        bodyCheck.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const testimonial = await promoteFeedbackToTestimonialDraft(staff, bodyCheck.data);
    return NextResponse.json({ success: true, testimonial }, { status: 201 });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
