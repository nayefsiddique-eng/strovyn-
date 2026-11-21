import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
  revalidatePublicTestimonialsPaths,
} from '@/lib/cms/http';
import { requireStaffSession, resolveAuthenticatedStaff } from '@/lib/cms/staffAuth';
import { parseTestimonialId } from '@/lib/cms/testimonialRouteHelpers';
import {
  getTestimonialByIdForAdmin,
  updateTestimonialRecord,
} from '@/lib/cms/testimonialsService';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_UPDATE_BYTES = 32 * 1024;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const testimonialId = parseTestimonialId(id);
    const staff = await requireStaffSession({ action: 'testimonial:read' });
    const detail = await getTestimonialByIdForAdmin(staff, testimonialId);
    return NextResponse.json(
      { success: true, ...detail },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'testimonials_update', 60, 60_000);

    const { id } = await context.params;
    const testimonialId = parseTestimonialId(id);
    const staff = await resolveAuthenticatedStaff();

    const bodyCheck = await readJsonBodyWithLimit(req, MAX_UPDATE_BYTES);
    if (!bodyCheck.ok) {
      throw new EditorialHttpError(
        bodyCheck.status === 413 ? 413 : 400,
        bodyCheck.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const testimonial = await updateTestimonialRecord(staff, testimonialId, bodyCheck.data);
    revalidatePublicTestimonialsPaths();
    return NextResponse.json({ success: true, testimonial });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
