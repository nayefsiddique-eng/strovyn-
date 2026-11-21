import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
  revalidatePublicPortfolioPaths,
} from '@/lib/cms/http';
import { PROJECT_IMAGE_ROLES, type ProjectImageRole } from '@/lib/cms/projectValidators';
import {
  deleteProjectImageSafely,
  updateProjectImagesBatch,
  uploadProjectImage,
} from '@/lib/cms/projectsService';
import { resolveAuthenticatedStaff } from '@/lib/cms/staffAuth';
import { UuidParamSchema } from '@/lib/cms/validators';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseProjectId(rawId: string): string {
  const parsed = UuidParamSchema.safeParse(rawId);
  if (!parsed.success) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid project identifier.');
  }
  return parsed.data;
}

export async function POST(req: Request, context: RouteContext) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'project_images_upload', 40, 60_000);

    const { id } = await context.params;
    const projectId = parseProjectId(id);
    const staff = await resolveAuthenticatedStaff();

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Missing image file in multipart payload.');
    }

    const rawRole = formData.get('imageRole');
    const imageRole =
      typeof rawRole === 'string' &&
      (PROJECT_IMAGE_ROLES as readonly string[]).includes(rawRole)
        ? (rawRole as ProjectImageRole)
        : 'gallery';

    const altText = typeof formData.get('altText') === 'string' ? String(formData.get('altText')) : undefined;
    const caption = typeof formData.get('caption') === 'string' ? String(formData.get('caption')) : undefined;
    const pairKey = typeof formData.get('pairKey') === 'string' ? String(formData.get('pairKey')) : undefined;
    const setAsCover = formData.get('setAsCover') === 'true';

    const result = await uploadProjectImage(staff, projectId, file, {
      imageRole,
      altText,
      caption,
      pairKey,
      setAsCover,
    });
    revalidatePublicPortfolioPaths(result.project.slug);
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'project_images_reorder', 60, 60_000);

    const { id } = await context.params;
    const projectId = parseProjectId(id);
    const staff = await resolveAuthenticatedStaff();

    const bodyCheck = await readJsonBodyWithLimit(req, 64 * 1024);
    if (!bodyCheck.ok) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', bodyCheck.error ?? 'Invalid JSON body.');
    }

    const project = await updateProjectImagesBatch(staff, projectId, bodyCheck.data);
    revalidatePublicPortfolioPaths(project.slug);
    return NextResponse.json({ success: true, project });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'project_images_delete', 40, 60_000);

    const { id } = await context.params;
    const projectId = parseProjectId(id);
    const staff = await resolveAuthenticatedStaff();

    const url = new URL(req.url);
    const imageIdParam = url.searchParams.get('imageId');
    const imageIdParsed = UuidParamSchema.safeParse(imageIdParam);
    if (!imageIdParsed.success) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Valid imageId query parameter is required.');
    }
    const expectedUpdatedAt = url.searchParams.get('expected_updated_at');

    const result = await deleteProjectImageSafely(
      staff,
      projectId,
      imageIdParsed.data,
      expectedUpdatedAt
    );
    revalidatePublicPortfolioPaths(result.project.slug);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
