import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { containsUnsafeHtmlPattern } from './contentSecurity';
import { EditorialHttpError } from './http';
import {
  inspectEditorialImageUpload,
  verifyDownloadedEditorialImageBytes,
} from './imageInspection';
import {
  buildCanonicalEditorialMediaRef,
  buildStaffMediaPreviewRef,
  EDITORIAL_PRIVATE_MEDIA_BUCKET,
  parseEditorialMediaRef,
} from './mediaUrlPolicy';
import type { StaffProfile } from './roles';
import { DeleteMediaSchema, ListMediaQuerySchema, UuidParamSchema } from './validators';

export const SIGNED_PREVIEW_TTL_SECONDS = 300; // 5-minute short-lived staff preview URLs

export type MediaDeleteState =
  | 'active'
  | 'pending_delete'
  | 'deleted'
  | 'delete_failed';

export interface MediaAssetRecord {
  id: string;
  bucket_id: string;
  storage_path: string;
  visibility: 'private';
  public_url: null;
  delete_state: MediaDeleteState;
  delete_error: string | null;
  mime_type: string;
  byte_size: number;
  width: number;
  height: number;
  alt_text: string;
  article_id: string | null;
  uploaded_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAssetClientView {
  id: string;
  bucket_id: string;
  storage_path: string;
  visibility: 'private';
  media_ref: string;
  staff_preview_url: string;
  public_url: null;
  signed_preview_url: string | null;
  signed_expires_at: string | null;
  mime_type: string;
  byte_size: number;
  width: number;
  height: number;
  alt_text: string;
  article_id: string | null;
  created_at: string;
}

function getClient(override?: SupabaseClient): SupabaseClient {
  return override ?? createServiceRoleClient();
}

async function createShortLivedSignedUrl(
  client: SupabaseClient,
  storagePath: string,
  ttlSeconds: number = SIGNED_PREVIEW_TTL_SECONDS
): Promise<{ signedUrl: string | null; expiresAt: string | null }> {
  try {
    const storageBucket = client.storage.from(EDITORIAL_PRIVATE_MEDIA_BUCKET);
    if (typeof storageBucket.createSignedUrl !== 'function') {
      return { signedUrl: null, expiresAt: null };
    }
    const { data, error } = await storageBucket.createSignedUrl(
      storagePath,
      ttlSeconds
    );
    if (error || !data?.signedUrl) {
      return { signedUrl: null, expiresAt: null };
    }
    return {
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  } catch (err) {
    console.error('[CMS-2] Failed to generate signed preview URL:', err);
    return { signedUrl: null, expiresAt: null };
  }
}

async function toClientMediaView(
  client: SupabaseClient,
  row: MediaAssetRecord,
  includeSignedUrl: boolean
): Promise<MediaAssetClientView> {
  let signedUrl: string | null = null;
  let signedExpiresAt: string | null = null;

  if (includeSignedUrl && row.deleted_at === null && row.delete_state === 'active') {
    const signed = await createShortLivedSignedUrl(client, row.storage_path);
    signedUrl = signed.signedUrl;
    signedExpiresAt = signed.expiresAt;
  }

  return {
    id: row.id,
    bucket_id: row.bucket_id,
    storage_path: row.storage_path,
    visibility: 'private',
    media_ref: buildCanonicalEditorialMediaRef(row.id),
    staff_preview_url: buildStaffMediaPreviewRef(row.id),
    public_url: null,
    signed_preview_url: signedUrl,
    signed_expires_at: signedExpiresAt,
    mime_type: row.mime_type,
    byte_size: row.byte_size,
    width: row.width,
    height: row.height,
    alt_text: row.alt_text,
    article_id: row.article_id,
    created_at: row.created_at,
  };
}

async function insertMediaAuditRow(
  client: SupabaseClient,
  payload: {
    asset_id: string;
    actor_staff_id: string | null;
    actor_email: string | null;
    actor_role: string | null;
    action:
      | 'media_upload'
      | 'media_attach'
      | 'media_detach'
      | 'media_delete'
      | 'media_delete_failed';
    storage_path: string;
    metadata: Record<string, unknown>;
  }
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    const { error } = await client.from('editorial_media_audit_log').insert(payload);
    if (error) {
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export async function listEditorialMediaAssets(
  rawQuery: Record<string, unknown>,
  clientOverride?: SupabaseClient
) {
  const parsed = ListMediaQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid media query parameters.'
    );
  }

  const { page, pageSize, articleId } = parsed.data;
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  const client = getClient(clientOverride);
  let query = client
    .from('editorial_media_assets')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .eq('delete_state', 'active');

  if (articleId) {
    query = query.eq('article_id', articleId);
  }

  query = query.order('created_at', { ascending: false }).range(fromIdx, toIdx);

  const { data, count, error } = await query;
  if (error) throw error;

  const rows = (data as unknown as MediaAssetRecord[]) ?? [];
  const items = await Promise.all(
    rows.map((row) => toClientMediaView(client, row, true))
  );

  return {
    items,
    pagination: {
      page,
      pageSize,
      total: count ?? items.length,
      totalPages: Math.max(1, Math.ceil((count ?? items.length) / pageSize)),
    },
  };
}

/**
 * Authenticated staff-only private preview access (used by `/api/admin/insights/media/[id]`).
 * Generates a short-lived signed URL for an active private asset without exposing it publicly.
 */
export async function getAuthenticatedMediaAccess(
  assetId: string,
  clientOverride?: SupabaseClient
): Promise<{
  id: string;
  visibility: 'private';
  mimeType: string;
  signedUrl: string;
  signedExpiresAt: string | null;
}> {
  const parsedId = UuidParamSchema.safeParse(assetId);
  if (!parsedId.success) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid media asset identifier.');
  }

  const client = getClient(clientOverride);
  const { data, error } = await client
    .from('editorial_media_assets')
    .select('*')
    .eq('id', parsedId.data)
    .is('deleted_at', null)
    .eq('delete_state', 'active')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Media asset not found.');
  }

  const row = data as MediaAssetRecord;
  const signed = await createShortLivedSignedUrl(client, row.storage_path);
  if (!signed.signedUrl) {
    throw new EditorialHttpError(
      500,
      'STORAGE_ERROR',
      'Unable to generate short-lived preview URL for private media asset.'
    );
  }

  return {
    id: row.id,
    visibility: 'private',
    mimeType: row.mime_type,
    signedUrl: signed.signedUrl,
    signedExpiresAt: signed.expiresAt,
  };
}

/**
 * Publication-gated public image delivery resolver (used exclusively by
 * `GET /api/editorial-media/[id]`). Calls indexed PostgreSQL function
 * `cms_resolve_public_editorial_media(UUID)` which succeeds ONLY if:
 *   - Asset is active (`deleted_at IS NULL AND delete_state = 'active'`)
 *   - At least one referencing article via `article_media_references` has
 *     `status = 'published' AND published_at IS NOT NULL AND published_at <= NOW()`
 * Streams raw bytes directly from the private `editorial-media` bucket; never
 * redirects or exposes a Supabase public/signed storage URL.
 */
export async function resolvePublishedEditorialMediaBytes(
  assetId: string,
  clientOverride?: SupabaseClient
): Promise<{
  buffer: Buffer;
  mimeType: string;
  byteSize: number;
} | null> {
  const parsedId = UuidParamSchema.safeParse(assetId);
  if (!parsedId.success) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid media asset identifier.');
  }

  const client = getClient(clientOverride);
  const { data, error } = await client.rpc(
    'cms_resolve_public_editorial_media',
    { p_asset_id: parsedId.data }
  );

  if (error) {
    throw error;
  }

  const authorized = (Array.isArray(data) ? data[0] : data) as
    | { id: string; storage_path: string; mime_type: string; byte_size: number }
    | null
    | undefined;

  if (!authorized || !authorized.storage_path) {
    return null;
  }

  const { data: blobData, error: dlErr } = await client.storage
    .from(EDITORIAL_PRIVATE_MEDIA_BUCKET)
    .download(authorized.storage_path);

  if (dlErr || !blobData) {
    console.error('[CMS-2] Failed downloading authorized published media bytes:', {
      assetId: parsedId.data,
      dlErr,
    });
    return null;
  }

  const buffer = Buffer.from(await blobData.arrayBuffer());
  const verification = verifyDownloadedEditorialImageBytes(
    buffer,
    authorized.mime_type,
    authorized.byte_size
  );

  if (!verification.valid) {
    console.error('[CMS-2.3] Downloaded editorial image failed integrity check:', {
      assetId: parsedId.data,
      reason: verification.reason,
      expectedMime: authorized.mime_type,
      expectedByteSize: authorized.byte_size,
      actualByteSize: buffer.length,
    });
    throw new EditorialHttpError(
      500,
      'STORAGE_ERROR',
      'Editorial image failed integrity verification.'
    );
  }

  return {
    buffer,
    mimeType: verification.mimeType,
    byteSize: buffer.length,
  };
}

export async function resolveMediaUrlsForPreview(
  urls: string[],
  clientOverride?: SupabaseClient
): Promise<Map<string, string>> {
  const refMap = new Map<string, string>();
  const idToRefs = new Map<string, Set<string>>();

  for (const raw of urls) {
    const id = parseEditorialMediaRef(raw);
    if (id) {
      if (!idToRefs.has(id)) idToRefs.set(id, new Set());
      idToRefs.get(id)!.add(raw);
    }
  }

  if (idToRefs.size === 0) {
    return refMap;
  }

  const client = getClient(clientOverride);
  for (const [id, rawRefs] of idToRefs.entries()) {
    const { data, error } = await client
      .from('editorial_media_assets')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .eq('delete_state', 'active')
      .maybeSingle();

    if (error) {
      console.error('[CMS-2] Failed loading media asset for preview:', error);
      continue;
    }
    if (!data) continue;

    const row = data as MediaAssetRecord;
    const signed = await createShortLivedSignedUrl(client, row.storage_path);
    if (signed.signedUrl) {
      for (const rawRef of rawRefs) {
        refMap.set(rawRef, signed.signedUrl);
      }
    }
  }

  return refMap;
}

export async function uploadEditorialMediaAsset(
  staff: StaffProfile,
  params: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    altText: string;
    articleId?: string | null;
  },
  clientOverride?: SupabaseClient
): Promise<MediaAssetClientView> {
  const trimmedAlt = (params.altText || '').trim();
  if (
    trimmedAlt.length < 3 ||
    trimmedAlt.length > 300 ||
    containsUnsafeHtmlPattern(trimmedAlt)
  ) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      'Valid accessibility alt text (3-300 plain characters) is required for editorial media uploads.'
    );
  }

  const inspection = inspectEditorialImageUpload(
    params.buffer,
    params.filename,
    params.mimeType
  );
  if (
    !inspection.valid ||
    !inspection.detectedMime ||
    !inspection.sanitizedFilename ||
    !inspection.dimensions
  ) {
    const status = inspection.status ?? 400;
    const code =
      status === 413
        ? 'PAYLOAD_TOO_LARGE'
        : status === 415
          ? 'UNSUPPORTED_MEDIA_TYPE'
          : 'BAD_REQUEST';
    throw new EditorialHttpError(
      status,
      code,
      inspection.error ?? 'Invalid editorial image upload.'
    );
  }

  const client = getClient(clientOverride);

  if (params.articleId) {
    const { data: art, error: artErr } = await client
      .from('articles')
      .select('id')
      .eq('id', params.articleId)
      .maybeSingle();
    if (artErr) throw artErr;
    if (!art) {
      throw new EditorialHttpError(
        404,
        'NOT_FOUND',
        'Target articleId does not exist.'
      );
    }
  }

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const storagePath = `articles/${year}/${month}/${inspection.sanitizedFilename}`;

  const { error: uploadErr } = await client.storage
    .from(EDITORIAL_PRIVATE_MEDIA_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: inspection.detectedMime,
      upsert: false,
    });

  if (uploadErr) {
    console.error('[CMS-2] Private editorial media storage upload failed:', uploadErr);
    throw new EditorialHttpError(
      500,
      'STORAGE_ERROR',
      'Failed to store editorial image object cleanly.'
    );
  }

  let assetRow: unknown = null;
  let insertErr: unknown = null;
  try {
    const res = await client
      .from('editorial_media_assets')
      .insert({
        bucket_id: EDITORIAL_PRIVATE_MEDIA_BUCKET,
        storage_path: storagePath,
        visibility: 'private',
        public_url: null,
        public_bucket_id: null,
        public_storage_path: null,
        delete_state: 'active',
        mime_type: inspection.detectedMime,
        byte_size: params.buffer.length,
        width: inspection.dimensions.width,
        height: inspection.dimensions.height,
        alt_text: trimmedAlt,
        article_id: params.articleId ?? null,
        uploaded_by: staff.id,
      })
      .select('*')
      .single();
    assetRow = res.data;
    insertErr = res.error;
  } catch (err) {
    insertErr = err;
  }

  if (insertErr || !assetRow) {
    let storageCleanupOk = false;
    try {
      const rem = await client.storage
        .from(EDITORIAL_PRIVATE_MEDIA_BUCKET)
        .remove([storagePath]);
      storageCleanupOk = !rem.error;
      if (rem.error) {
        console.error(
          '[CMS-2] Upload DB insert failed AND storage cleanup returned error:',
          { insertErr, storageCleanupError: rem.error, storagePath }
        );
      }
    } catch (remThrown) {
      console.error(
        '[CMS-2] Upload DB insert failed AND storage cleanup threw exception:',
        { insertErr, storageCleanupThrown: remThrown, storagePath }
      );
    }
    if (!storageCleanupOk) {
      throw new EditorialHttpError(
        500,
        'STORAGE_ERROR',
        'Failed to persist media metadata and compensating storage cleanup failed.'
      );
    }
    throw new EditorialHttpError(
      500,
      'INTERNAL_ERROR',
      'Failed to persist editorial media metadata record.'
    );
  }

  const asset = assetRow as MediaAssetRecord;

  const auditRes = await insertMediaAuditRow(client, {
    asset_id: asset.id,
    actor_staff_id: staff.id,
    actor_email: staff.email,
    actor_role: staff.role,
    action: 'media_upload',
    storage_path: asset.storage_path,
    metadata: {
      visibility: 'private',
      mime_type: asset.mime_type,
      byte_size: asset.byte_size,
      width: asset.width,
      height: asset.height,
      article_id: asset.article_id,
    },
  });

  if (!auditRes.ok) {
    console.error('[CMS-2] Media upload audit insert failed; compensating upload:', {
      assetId: asset.id,
      storagePath,
      auditError: auditRes.error,
    });

    let storageCleaned = false;
    let metadataCleaned = false;
    let storageCleanupErr: unknown = null;
    let metadataCleanupErr: unknown = null;

    try {
      const rem = await client.storage
        .from(EDITORIAL_PRIVATE_MEDIA_BUCKET)
        .remove([storagePath]);
      if (rem.error) {
        storageCleanupErr = rem.error;
      } else {
        storageCleaned = true;
      }
    } catch (err) {
      storageCleanupErr = err;
    }

    try {
      const delRes = await client
        .from('editorial_media_assets')
        .delete()
        .eq('id', asset.id);
      if (delRes.error) {
        metadataCleanupErr = delRes.error;
      } else {
        metadataCleaned = true;
      }
    } catch (err) {
      metadataCleanupErr = err;
    }

    if (!metadataCleaned) {
      try {
        await client
          .from('editorial_media_assets')
          .update({
            delete_state: 'delete_failed',
            delete_error: 'Audit log insert failed and compensating metadata delete failed.',
          })
          .eq('id', asset.id);
      } catch {
        // Logged below
      }
    }

    if (!storageCleaned || !metadataCleaned) {
      console.error('[CMS-2] CRITICAL: Media upload compensation partially/fully failed:', {
        assetId: asset.id,
        storagePath,
        storageCleaned,
        metadataCleaned,
        storageCleanupErr,
        metadataCleanupErr,
      });
    }

    throw new EditorialHttpError(
      500,
      'INTERNAL_ERROR',
      storageCleaned && metadataCleaned
        ? 'Editorial media upload could not be audited and was rolled back.'
        : 'Editorial media upload audit failed and cleanup requires operator verification.'
    );
  }

  return toClientMediaView(client, asset, true);
}

export async function deleteOrphanEditorialMediaAsset(
  staff: StaffProfile,
  rawPayload: unknown,
  clientOverride?: SupabaseClient
): Promise<{ deletedId: string; storagePath: string }> {
  const parsed = DeleteMediaSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new EditorialHttpError(
      400,
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid media asset identifier.'
    );
  }

  const { id } = parsed.data;
  const client = getClient(clientOverride);

  const { data: existing, error: fetchErr } = await client
    .from('editorial_media_assets')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existing) {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Media asset not found.');
  }

  const asset = existing as MediaAssetRecord;
  if (asset.delete_state === 'pending_delete') {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'Media asset deletion is already in progress.'
    );
  }
  if (asset.delete_state === 'deleted') {
    throw new EditorialHttpError(404, 'NOT_FOUND', 'Media asset not found.');
  }

  // Indexed lookup against authoritative trigger-maintained article_media_references
  const { data: refRows, error: refErr } = await client
    .from('article_media_references')
    .select('article_id')
    .eq('asset_id', asset.id)
    .limit(1);

  if (refErr) throw refErr;

  if (refRows && refRows.length > 0) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'Cannot delete media asset while it is referenced by one or more articles. Detach it first.'
    );
  }

  const { data: pendingRows, error: pendingErr } = await client
    .from('editorial_media_assets')
    .update({
      delete_state: 'pending_delete',
      delete_error: null,
    })
    .eq('id', asset.id)
    .is('deleted_at', null)
    .in('delete_state', ['active', 'delete_failed'])
    .select('id');

  if (pendingErr) throw pendingErr;
  if (!pendingRows || pendingRows.length === 0) {
    throw new EditorialHttpError(
      409,
      'CONFLICT',
      'Media asset state changed concurrently; reload before deleting.'
    );
  }

  let storageRemoveErr: unknown = null;
  try {
    const privRes = await client.storage
      .from(EDITORIAL_PRIVATE_MEDIA_BUCKET)
      .remove([asset.storage_path]);
    if (privRes.error) {
      storageRemoveErr = privRes.error;
    }
  } catch (err) {
    storageRemoveErr = err;
  }

  if (storageRemoveErr) {
    console.error('[CMS-2] Storage object removal failed:', {
      assetId: asset.id,
      storagePath: asset.storage_path,
      error: storageRemoveErr,
    });

    await client
      .from('editorial_media_assets')
      .update({
        delete_state: 'delete_failed',
        delete_error: 'Storage object removal failed; retry deletion.',
      })
      .eq('id', asset.id);

    const failAudit = await insertMediaAuditRow(client, {
      asset_id: asset.id,
      actor_staff_id: staff.id,
      actor_email: staff.email,
      actor_role: staff.role,
      action: 'media_delete_failed',
      storage_path: asset.storage_path,
      metadata: {
        bucket_id: asset.bucket_id,
        reason: 'storage_remove_failed',
      },
    });
    if (!failAudit.ok) {
      console.error('[CMS-2] Failed to record media_delete_failed audit entry:', failAudit.error);
    }

    throw new EditorialHttpError(
      500,
      'STORAGE_ERROR',
      'Failed to remove editorial image object from storage.'
    );
  }

  const deletedAtIso = new Date().toISOString();
  const { error: softDelErr } = await client
    .from('editorial_media_assets')
    .update({
      delete_state: 'deleted',
      delete_error: null,
      deleted_at: deletedAtIso,
      deleted_by: staff.id,
    })
    .eq('id', asset.id)
    .eq('delete_state', 'pending_delete');

  if (softDelErr) {
    console.error('[CMS-2] Failed to finalize deleted_at after storage removal:', {
      assetId: asset.id,
      softDelErr,
    });
    await client
      .from('editorial_media_assets')
      .update({
        delete_state: 'delete_failed',
        delete_error: 'Storage removed cleanly, but database finalization failed.',
      })
      .eq('id', asset.id);
    throw new EditorialHttpError(
      500,
      'INTERNAL_ERROR',
      'Storage object removed, but database deletion record could not be finalized.'
    );
  }

  const auditRes = await insertMediaAuditRow(client, {
    asset_id: asset.id,
    actor_staff_id: staff.id,
    actor_email: staff.email,
    actor_role: staff.role,
    action: 'media_delete',
    storage_path: asset.storage_path,
    metadata: {
      bucket_id: asset.bucket_id,
    },
  });

  if (!auditRes.ok) {
    console.error('[CMS-2] Media deletion audit insert failed after storage removal:', {
      assetId: asset.id,
      auditError: auditRes.error,
    });
    await client
      .from('editorial_media_assets')
      .update({
        delete_state: 'delete_failed',
        deleted_at: null,
        delete_error: 'Storage removed cleanly, but media_delete audit log insert failed.',
      })
      .eq('id', asset.id);
    throw new EditorialHttpError(
      500,
      'INTERNAL_ERROR',
      'Storage object removed, but required deletion audit log entry failed.'
    );
  }

  return {
    deletedId: asset.id,
    storagePath: asset.storage_path,
  };
}

export function extractMediaRefsFromArticleFields(input: {
  featured_image_url?: string | null;
  og_image_url?: string | null;
  content_json?: unknown;
}): string[] {
  const ids = new Set<string>();
  const inspectUrl = (url: unknown) => {
    if (typeof url === 'string') {
      const id = parseEditorialMediaRef(url);
      if (id) ids.add(id);
    }
  };

  inspectUrl(input.featured_image_url);
  inspectUrl(input.og_image_url);

  if (input.content_json && typeof input.content_json === 'object') {
    const stack: unknown[] = [input.content_json];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) {
        for (const item of node) stack.push(item);
        continue;
      }
      const obj = node as Record<string, unknown>;
      if (
        obj.type === 'image' &&
        obj.attrs &&
        typeof obj.attrs === 'object' &&
        'src' in obj.attrs
      ) {
        inspectUrl((obj.attrs as Record<string, unknown>).src);
      }
      if (Array.isArray(obj.content)) {
        for (const child of obj.content) stack.push(child);
      }
    }
  }

  return Array.from(ids);
}

export async function assertReferencedMediaAssetsExist(
  input: {
    featured_image_url?: string | null;
    og_image_url?: string | null;
    content_json?: unknown;
  },
  clientOverride?: SupabaseClient
): Promise<void> {
  const ids = extractMediaRefsFromArticleFields(input);
  if (ids.length === 0) return;

  const client = getClient(clientOverride);
  for (const assetId of ids) {
    const { data, error } = await client
      .from('editorial_media_assets')
      .select('id, deleted_at, delete_state, alt_text')
      .eq('id', assetId)
      .maybeSingle();
    if (error) throw error;
    const row = data as {
      id: string;
      deleted_at: string | null;
      delete_state: string;
      alt_text: string | null;
    } | null;
    if (!row || row.deleted_at !== null || row.delete_state !== 'active') {
      throw new EditorialHttpError(
        422,
        'ARTICLE_INCOMPLETE',
        `Referenced editorial media asset '${assetId}' does not exist or has been deleted.`
      );
    }
    if (!row.alt_text || row.alt_text.trim().length < 3) {
      throw new EditorialHttpError(
        422,
        'ARTICLE_INCOMPLETE',
        'All referenced editorial images require descriptive alt text.'
      );
    }
  }
}
