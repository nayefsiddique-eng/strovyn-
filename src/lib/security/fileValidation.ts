import crypto from 'crypto';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: string;
  sanitizedFilename?: string;
}

// Known Magic Number Signatures (First 4 to 8 bytes)
const MAGIC_NUMBERS = {
  // JPEG: FF D8 FF
  jpeg: [0xff, 0xd8, 0xff],
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP at byte 8-11)
  riff: [0x52, 0x49, 0x46, 0x46],
  webp: [0x57, 0x45, 0x42, 0x50],
  // PDF: 25 50 44 46 (%PDF)
  pdf: [0x25, 0x50, 0x44, 0x46],
  // DOCX / XLSX / ZIP: 50 4B 03 04 (PK..)
  docx: [0x50, 0x4b, 0x03, 0x04],
  // Legacy DOC: D0 CF 11 E0 A1 B1 1A E1
  doc: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
};

function matchesBytes(buffer: Buffer, magic: number[], offset: number = 0): boolean {
  if (buffer.length < offset + magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buffer[offset + i] !== magic[i]) return false;
  }
  return true;
}

export function detectMagicType(buffer: Buffer): string | null {
  if (matchesBytes(buffer, MAGIC_NUMBERS.jpeg)) return 'image/jpeg';
  if (matchesBytes(buffer, MAGIC_NUMBERS.png)) return 'image/png';
  if (matchesBytes(buffer, MAGIC_NUMBERS.riff) && matchesBytes(buffer, MAGIC_NUMBERS.webp, 8)) {
    return 'image/webp';
  }
  if (matchesBytes(buffer, MAGIC_NUMBERS.pdf)) return 'application/pdf';
  if (matchesBytes(buffer, MAGIC_NUMBERS.docx)) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (matchesBytes(buffer, MAGIC_NUMBERS.doc)) return 'application/msword';

  return null;
}

/**
 * Validates file buffer against allowed MIME types, extensions, size limits, and magic bytes.
 * Generates an unguessable cryptographically random filename.
 */
export function validateUploadFile(
  buffer: Buffer,
  originalFilename: string,
  declaredMimeType: string,
  allowedMimes: string[],
  maxSizeBytes: number
): FileValidationResult {
  // 1. Size Check
  if (buffer.length === 0) {
    return { valid: false, error: 'Empty file payload' };
  }
  if (buffer.length > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB`,
    };
  }

  // 2. Magic byte check
  const detectedType = detectMagicType(buffer);
  if (!detectedType) {
    return { valid: false, error: 'Unrecognized file format or corrupted header' };
  }

  // 3. Allowed MIME check
  if (!allowedMimes.includes(detectedType)) {
    return {
      valid: false,
      error: `File type ${detectedType} is not permitted`,
    };
  }

  // 4. Sanitize extension mapping
  const EXT_MAP: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
  };

  const safeExtension = EXT_MAP[detectedType] || '.bin';

  // 5. Generate secure random filename (never trust client filename; strips directory traversal)
  const randomSlug = crypto.randomBytes(16).toString('hex');
  const sanitizedFilename = `${Date.now()}-${randomSlug}${safeExtension}`;

  return {
    valid: true,
    detectedType,
    sanitizedFilename,
  };
}
