import { detectMagicType, validateUploadFile } from '@/lib/security/fileValidation';
import {
  EDITORIAL_MEDIA_BUCKET,
  EDITORIAL_PRIVATE_MEDIA_BUCKET,
  FORBIDDEN_CUSTOMER_BUCKET,
  validateApprovedEditorialMediaUrl,
} from './mediaUrlPolicy';

export {
  EDITORIAL_MEDIA_BUCKET,
  EDITORIAL_PRIVATE_MEDIA_BUCKET,
  FORBIDDEN_CUSTOMER_BUCKET,
  validateApprovedEditorialMediaUrl,
};

export const ALLOWED_EDITORIAL_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type AllowedEditorialImageMime =
  (typeof ALLOWED_EDITORIAL_IMAGE_MIMES)[number];

export const MAX_EDITORIAL_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const MIN_IMAGE_DIMENSION = 16;
export const MAX_IMAGE_DIMENSION = 8192;
export const MAX_IMAGE_PIXELS = 36_000_000;

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface InspectedEditorialImage {
  valid: boolean;
  status?: 400 | 413 | 415 | 422;
  error?: string;
  detectedMime?: AllowedEditorialImageMime;
  sanitizedFilename?: string;
  dimensions?: ImageDimensions;
}

const MIME_TO_EXTENSIONS: Record<AllowedEditorialImageMime, readonly string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

function parsePngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

function parseJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 3 < buffer.length) {
    // Skip any fill 0xFF bytes
    while (offset < buffer.length && buffer[offset] !== 0xff) {
      offset += 1;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= buffer.length) break;

    const marker = buffer[offset];
    offset += 1;

    // Standalone markers (RST0..RST7, SOI, EOI, TEM) have no length payload
    if (
      marker === 0x01 ||
      marker === 0xd8 ||
      marker === 0xd9 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      continue;
    }

    if (offset + 2 > buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      return null;
    }

    // Start Of Frame markers carrying image dimensions (excluding DHT=0xC4, JPG=0xC8, DAC=0xCC)
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isSof) {
      if (segmentLength < 7 || offset + 7 > buffer.length) return null;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return { width, height };
    }

    // SOS (0xDA) starts compressed scan stream
    if (marker === 0xda) break;

    offset += segmentLength;
  }

  return null;
}

function parseWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30) return null;
  if (
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }

  const chunkHeader = buffer.toString('ascii', 12, 16);

  if (chunkHeader === 'VP8 ') {
    // Lossy keyframe: start code 0x9d 0x01 0x2a at bytes 23..25
    if (
      buffer[23] !== 0x9d ||
      buffer[24] !== 0x01 ||
      buffer[25] !== 0x2a
    ) {
      return null;
    }
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }

  if (chunkHeader === 'VP8L') {
    // Lossless signature byte 0x2f at byte 20
    if (buffer[20] !== 0x2f) return null;
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }

  if (chunkHeader === 'VP8X') {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }

  return null;
}

export function parseImageDimensions(
  buffer: Buffer,
  mimeType: AllowedEditorialImageMime
): ImageDimensions | null {
  switch (mimeType) {
    case 'image/png':
      return parsePngDimensions(buffer);
    case 'image/jpeg':
      return parseJpegDimensions(buffer);
    case 'image/webp':
      return parseWebpDimensions(buffer);
    default:
      return null;
  }
}

/**
 * Validates an uploaded editorial image buffer against:
 *  - non-empty / <= 5MB limit (413 on excess)
 *  - SVG & path traversal rejection
 *  - magic-byte signature verification (415 on unsupported/spoofed format)
 *  - strict binary pixel-dimension parsing (400/422 on corrupted or extreme dims)
 */
export function inspectEditorialImageUpload(
  buffer: Buffer,
  originalFilename: string,
  declaredMimeType: string
): InspectedEditorialImage {
  if (!buffer || buffer.length === 0) {
    return { valid: false, status: 400, error: 'Image file payload cannot be empty.' };
  }

  if (buffer.length > MAX_EDITORIAL_IMAGE_BYTES) {
    return {
      valid: false,
      status: 413,
      error: `Image exceeds the maximum permitted size of ${MAX_EDITORIAL_IMAGE_BYTES / (1024 * 1024)}MB.`,
    };
  }

  const trimmedName = (originalFilename || '').trim();
  if (
    !trimmedName ||
    trimmedName.includes('..') ||
    trimmedName.includes('/') ||
    trimmedName.includes('\\') ||
    trimmedName.includes('\0')
  ) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid uploaded filename.',
    };
  }

  const lowerDeclared = (declaredMimeType || '').trim().toLowerCase();
  const lowerExt = trimmedName.slice(trimmedName.lastIndexOf('.')).toLowerCase();
  const snippetHead = buffer
    .subarray(0, Math.min(buffer.length, 512))
    .toString('utf8')
    .trimStart()
    .toLowerCase();

  if (
    lowerExt === '.svg' ||
    lowerDeclared.includes('svg') ||
    snippetHead.startsWith('<svg') ||
    (snippetHead.startsWith('<?xml') && snippetHead.includes('<svg'))
  ) {
    return {
      valid: false,
      status: 415,
      error: 'SVG images are prohibited in editorial media.',
    };
  }

  const detected = detectMagicType(buffer);
  if (
    !detected ||
    !(ALLOWED_EDITORIAL_IMAGE_MIMES as readonly string[]).includes(detected)
  ) {
    return {
      valid: false,
      status: 415,
      error: 'Unsupported or corrupted image format. Only JPEG, PNG, and WebP are allowed.',
    };
  }

  const detectedMime = detected as AllowedEditorialImageMime;

  // Detect explicit MIME spoofing (e.g., PNG bytes uploaded as declared image/jpeg or text/html)
  if (
    lowerDeclared &&
    lowerDeclared !== 'application/octet-stream' &&
    lowerDeclared !== detectedMime &&
    !(detectedMime === 'image/jpeg' && lowerDeclared === 'image/jpg')
  ) {
    return {
      valid: false,
      status: 415,
      error: 'Declared Content-Type does not match actual image signature.',
    };
  }

  // Reject deceptive mismatched extensions when an extension is provided
  const validExts = MIME_TO_EXTENSIONS[detectedMime];
  if (lowerExt && lowerExt.startsWith('.') && !validExts.includes(lowerExt)) {
    return {
      valid: false,
      status: 415,
      error: 'File extension does not match actual image signature.',
    };
  }

  const fileCheck = validateUploadFile(
    buffer,
    trimmedName,
    declaredMimeType,
    [...ALLOWED_EDITORIAL_IMAGE_MIMES],
    MAX_EDITORIAL_IMAGE_BYTES
  );
  if (!fileCheck.valid || !fileCheck.sanitizedFilename) {
    return {
      valid: false,
      status: 415,
      error: fileCheck.error ?? 'Failed image validation.',
    };
  }

  const dimensions = parseImageDimensions(buffer, detectedMime);
  if (!dimensions) {
    return {
      valid: false,
      status: 400,
      error: 'Unable to verify image dimensions from file header.',
    };
  }

  const { width, height } = dimensions;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < MIN_IMAGE_DIMENSION ||
    height < MIN_IMAGE_DIMENSION ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    return {
      valid: false,
      status: 422,
      error: `Image dimensions must be between ${MIN_IMAGE_DIMENSION}px and ${MAX_IMAGE_DIMENSION}px (${MAX_IMAGE_PIXELS / 1_000_000}MP max).`,
    };
  }

  return {
    valid: true,
    detectedMime,
    sanitizedFilename: fileCheck.sanitizedFilename,
    dimensions,
  };
}

/**
 * Verifies downloaded Storage object bytes immediately prior to public HTTP
 * streaming: enforces explicit editorial MIME allowlist, non-zero <= 5MB cap,
 * exact byte_size parity against PostgreSQL metadata, and magic-byte match.
 */
export function verifyDownloadedEditorialImageBytes(
  buffer: Buffer,
  expectedMime: string,
  expectedByteSize: number
): { valid: true; mimeType: AllowedEditorialImageMime } | { valid: false; reason: string } {
  if (!(ALLOWED_EDITORIAL_IMAGE_MIMES as readonly string[]).includes(expectedMime)) {
    return { valid: false, reason: 'Recorded MIME type is not in the editorial image allowlist.' };
  }

  if (
    !Number.isInteger(expectedByteSize) ||
    expectedByteSize <= 0 ||
    expectedByteSize > MAX_EDITORIAL_IMAGE_BYTES
  ) {
    return { valid: false, reason: 'Recorded byte size violates editorial media limits.' };
  }

  if (!buffer || buffer.length === 0) {
    return { valid: false, reason: 'Downloaded editorial image payload is empty.' };
  }

  if (buffer.length > MAX_EDITORIAL_IMAGE_BYTES) {
    return { valid: false, reason: 'Downloaded editorial image exceeds 5MB limit.' };
  }

  if (buffer.length !== expectedByteSize) {
    return { valid: false, reason: 'Downloaded byte size does not match recorded asset size.' };
  }

  const detected = detectMagicType(buffer);
  if (!detected || detected !== expectedMime) {
    return { valid: false, reason: 'Downloaded image magic bytes do not match recorded MIME type.' };
  }

  return { valid: true, mimeType: expectedMime as AllowedEditorialImageMime };
}
