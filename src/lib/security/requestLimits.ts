export interface JsonBodyResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  status?: number;
}

/**
 * Reads and parses a JSON request body while strictly enforcing a maximum raw byte limit
 * (covering both declared Content-Length and chunked transfer payloads).
 */
export async function readJsonBodyWithLimit(
  req: Request,
  maxBytes: number = 32 * 1024
): Promise<JsonBodyResult> {
  const declaredLenHeader = req.headers.get('content-length');
  if (declaredLenHeader !== null) {
    const declaredLen = Number(declaredLenHeader);
    if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
      return {
        ok: false,
        status: 413,
        error: 'Request payload exceeds maximum allowed size.',
      };
    }
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'Unable to read request body.',
    };
  }

  if (Buffer.byteLength(rawText, 'utf8') > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: 'Request payload exceeds maximum allowed size.',
    };
  }

  if (!rawText.trim()) {
    return {
      ok: false,
      status: 400,
      error: 'Request body cannot be empty.',
    };
  }

  try {
    const parsed: unknown = JSON.parse(rawText);
    return { ok: true, data: parsed };
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'Invalid JSON request format.',
    };
  }
}
