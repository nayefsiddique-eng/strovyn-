import 'server-only';
import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
  revalidatePublicTestimonialsPaths,
} from './http';
import { resolveAuthenticatedStaff } from './staffAuth';
import {
  transitionTestimonialModeration,
  type TestimonialModerationAction,
} from './testimonialsService';
import { UuidParamSchema } from './validators';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_TESTIMONIAL_BODY_BYTES = 32 * 1024;

export function parseTestimonialId(rawId: string): string {
  const parsed = UuidParamSchema.safeParse(rawId);
  if (!parsed.success) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid testimonial identifier.');
  }
  return parsed.data;
}

export async function handleTestimonialTransitionPost(
  req: Request,
  rawId: string,
  action: TestimonialModerationAction
): Promise<NextResponse> {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, `testimonials_${action}`, 60, 60_000);

    const id = parseTestimonialId(rawId);
    const staff = await resolveAuthenticatedStaff();

    const bodyCheck = await readJsonBodyWithLimit(req, MAX_TESTIMONIAL_BODY_BYTES);
    if (!bodyCheck.ok) {
      throw new EditorialHttpError(
        bodyCheck.status === 413 ? 413 : 400,
        bodyCheck.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const testimonial = await transitionTestimonialModeration(
      staff,
      id,
      action,
      bodyCheck.data
    );
    revalidatePublicTestimonialsPaths();
    return NextResponse.json({ success: true, testimonial });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
