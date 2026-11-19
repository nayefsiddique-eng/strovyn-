import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { MAX_EDITORIAL_IMAGE_BYTES } from '@/lib/cms/imageInspection';
import {
  deleteOrphanEditorialMediaAsset,
  listEditorialMediaAssets,
  uploadEditorialMediaAsset,
} from '@/lib/cms/mediaService';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { UuidParamSchema } from '@/lib/cms/validators';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

export async function GET(req: Request) {
  try {
    await requireStaffSession({ action: 'article:read_unpublished' });
    const url = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};
    for (const key of ['page', 'pageSize', 'articleId']) {
      const val = url.searchParams.get(key);
      if (val !== null && val !== '') {
        rawQuery[key] = val;
      }
    }

    const result = await listEditorialMediaAssets(rawQuery);
    return NextResponse.json(
      { success: true, ...result },
      {
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
      }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'media_upload', 30, 300_000);
    const staff = await requireStaffSession({ action: 'media:upload' });

    const contentLengthHeader = req.headers.get('content-length');
    if (contentLengthHeader !== null) {
      const declaredLen = Number(contentLengthHeader);
      // Allow modest multipart wrapper overhead beyond 5MB image payload
      if (Number.isFinite(declaredLen) && declaredLen > MAX_EDITORIAL_IMAGE_BYTES + 256 * 1024) {
        throw new EditorialHttpError(
          413,
          'PAYLOAD_TOO_LARGE',
          'Uploaded media payload exceeds maximum allowed size.'
        );
      }
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Malformed multipart form upload.');
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Image file is required.');
    }

    if (file.size > MAX_EDITORIAL_IMAGE_BYTES) {
      throw new EditorialHttpError(
        413,
        'PAYLOAD_TOO_LARGE',
        `Image exceeds maximum permitted size of ${MAX_EDITORIAL_IMAGE_BYTES / (1024 * 1024)}MB.`
      );
    }

    const altRaw = formData.get('altText');
    const altText = typeof altRaw === 'string' ? altRaw : '';
    const articleIdRaw = formData.get('articleId');
    let articleId: string | null = null;
    if (typeof articleIdRaw === 'string' && articleIdRaw.trim()) {
      const parsedId = UuidParamSchema.safeParse(articleIdRaw.trim());
      if (!parsedId.success) {
        throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid articleId.');
      }
      articleId = parsedId.data;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await uploadEditorialMediaAsset(staff, {
      buffer,
      filename: file.name,
      mimeType: file.type,
      altText,
      articleId,
    });

    return NextResponse.json(
      { success: true, asset },
      {
        status: 201,
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
      }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'media_delete', 30, 300_000);
    const staff = await requireStaffSession({ action: 'media:delete_orphan' });

    const url = new URL(req.url);
    const queryId = url.searchParams.get('id');
    let payload: unknown;

    if (queryId) {
      payload = { id: queryId };
    } else {
      const bodyCheck = await readJsonBodyWithLimit(req, 4096);
      if (!bodyCheck.ok) {
        throw new EditorialHttpError(
          bodyCheck.status === 413 ? 413 : 400,
          bodyCheck.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
          bodyCheck.error ?? 'Media asset identifier is required.'
        );
      }
      payload = bodyCheck.data;
    }

    const result = await deleteOrphanEditorialMediaAsset(staff, payload);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
