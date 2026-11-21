import { handleTestimonialTransitionPost } from '@/lib/cms/testimonialRouteHelpers';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleTestimonialTransitionPost(req, id, 'approve');
}
