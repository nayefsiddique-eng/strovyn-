export interface StroActionChip {
  type: 'open_quote_builder' | 'link' | 'whatsapp';
  label: string;
  href?: string;
  prefillService?: string;
}

export interface StroAssistantEnvelope {
  role: 'assistant';
  content: string;
}

export type StroInlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: StroInlineNode[] }
  | { type: 'em'; children: StroInlineNode[] }
  | { type: 'code'; value: string }
  | { type: 'link'; label: string; href: string; external: boolean };

export type StroBlockNode =
  | { type: 'paragraph'; lines: StroInlineNode[][] }
  | { type: 'heading'; content: StroInlineNode[] }
  | { type: 'unordered_list'; items: StroInlineNode[][] }
  | { type: 'ordered_list'; start: number; items: StroInlineNode[][] }
  | { type: 'code_block'; language?: string; code: string };

export interface StroNormalizationResult {
  ok: boolean;
  content: string;
  unwrappedFromJson: boolean;
  strippedFence: boolean;
  convertedEscapedNewlines: boolean;
  preserveCodeBlocks: boolean;
  reason?: string;
}

const APPROVED_STATIC_INTERNAL_ROUTES = new Set<string>([
  '/',
  '/about',
  '/services',
  '/services/interior-architectural-painting',
  '/services/exterior-facade-restoration',
  '/services/fine-cabinetry-millwork',
  '/services/artisanal-plasters-lime-washes',
  '/services/historic-heritage-conservation',
  '/services/commercial-hospitality-finishes',
  '/projects',
  '/insights',
  '/contact',
  '/careers',
  '/feedback',
  '/visualiser',
]);

export function isApprovedStroInternalRoute(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return false;
  if (trimmed.includes('..') || /[\x00-\x1f\s"'<>\\]/.test(trimmed)) return false;

  const [pathname, query] = trimmed.split('?');
  if (/^\/(?:admin|api)(?:\/|$)/i.test(pathname)) return false;

  if (APPROVED_STATIC_INTERNAL_ROUTES.has(pathname)) {
    if (query !== undefined && pathname !== '/contact') {
      return false;
    }
    return true;
  }

  if (/^\/(?:projects|insights)\/[a-z0-9][a-z0-9-]{1,90}$/.test(pathname) && query === undefined) {
    return true;
  }

  return false;
}

export function isSafeStroExternalHref(href: string): boolean {
  const trimmed = href.trim();
  if (/[\x00-\x1f\s"'<>]/.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'wa.me' && parsed.pathname === '/61406646061') {
      return true;
    }
    if (host === 'www.yourhome.gov.au' || host === 'yourhome.gov.au') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function userExplicitlyRequestedCodeOrJson(userMessage?: string): boolean {
  if (!userMessage || typeof userMessage !== 'string') return false;
  return /\b(?:json|xml|yaml|javascript|typescript|html|css|sql|python|code(?:\s+(?:snippet|block|example|sample|format))?|json\s+(?:schema|object|payload)|javascript\s+object|api\s+payload|in\s+json|as\s+json|format\s+as\s+(?:json|code|xml|yaml))\b/i.test(
    userMessage
  );
}

export function extractGeminiCandidateText(aiData: unknown): {
  text: string;
  finishReason?: string;
  blocked: boolean;
} {
  if (!aiData || typeof aiData !== 'object') {
    return { text: '', blocked: false };
  }

  const root = aiData as Record<string, unknown>;
  const promptFeedback = root.promptFeedback as Record<string, unknown> | undefined;
  const blockReason =
    typeof promptFeedback?.blockReason === 'string' ? promptFeedback.blockReason : undefined;

  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  const firstCandidate =
    candidates[0] && typeof candidates[0] === 'object'
      ? (candidates[0] as Record<string, unknown>)
      : undefined;

  if (!firstCandidate) {
    return { text: '', blocked: Boolean(blockReason) };
  }

  const finishReason =
    typeof firstCandidate.finishReason === 'string' ? firstCandidate.finishReason : undefined;

  const content =
    firstCandidate.content && typeof firstCandidate.content === 'object'
      ? (firstCandidate.content as Record<string, unknown>)
      : undefined;
  const parts = Array.isArray(content?.parts) ? content.parts : [];

  const textSegments: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const p = part as Record<string, unknown>;
    if (p.thought === true) continue;
    if (typeof p.text === 'string' && p.text.length > 0) {
      textSegments.push(p.text);
    }
  }

  const joined = textSegments.join('');
  const isBlockedFinish =
    finishReason === 'SAFETY' ||
    finishReason === 'RECITATION' ||
    finishReason === 'BLOCKLIST' ||
    finishReason === 'PROHIBITED_CONTENT' ||
    finishReason === 'SPII';

  return {
    text: joined,
    finishReason,
    blocked: Boolean((blockReason || isBlockedFinish) && joined.trim().length === 0),
  };
}

const DIRECT_TEXT_KEYS = [
  'answer',
  'reply',
  'response',
  'content',
  'message',
  'text',
  'explanation',
  'advice',
  'recommendation',
  'summary',
  'output',
] as const;

const NESTED_ENVELOPE_KEYS = [
  'reply',
  'message',
  'response',
  'data',
  'result',
  'output',
] as const;

const INTERNAL_OR_ERROR_KEYS = new Set([
  'candidates',
  'promptFeedback',
  'usageMetadata',
  'errorCode',
  'stack',
  'trace',
  'systemInstruction',
]);

function cleanListItems(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const items: string[] = [];
  for (const entry of arr) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      items.push(entry.trim().replace(/^[-*•]\s+|^\d+[.)]\s+/, ''));
    } else if (entry && typeof entry === 'object') {
      const rec = entry as Record<string, unknown>;
      const label =
        typeof rec.title === 'string'
          ? rec.title.trim()
          : typeof rec.heading === 'string'
            ? rec.heading.trim()
            : typeof rec.label === 'string'
              ? rec.label.trim()
              : '';
      const body =
        typeof rec.text === 'string'
          ? rec.text.trim()
          : typeof rec.content === 'string'
            ? rec.content.trim()
            : typeof rec.description === 'string'
              ? rec.description.trim()
              : typeof rec.detail === 'string'
                ? rec.detail.trim()
                : '';
      if (label && body) {
        items.push(`**${label}:** ${body}`);
      } else if (body) {
        items.push(body);
      } else if (label) {
        items.push(label);
      }
    }
  }
  return items;
}

export function extractSupportedJsonAnswer(parsed: unknown, depth = 0): string | null {
  if (depth > 4 || parsed === null || parsed === undefined) return null;

  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    if (!trimmed) return null;
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const inner = JSON.parse(trimmed);
        return extractSupportedJsonAnswer(inner, depth + 1);
      } catch {
        return null;
      }
    }
    return trimmed;
  }

  if (Array.isArray(parsed)) {
    const items = cleanListItems(parsed);
    if (items.length === 0 || items.length !== parsed.length) return null;
    return items.length === 1 ? items[0] : items.map((item) => `- ${item}`).join('\n');
  }

  if (typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;

    for (const badKey of INTERNAL_OR_ERROR_KEYS) {
      if (badKey in obj) return null;
    }
    if ('error' in obj && obj.error !== null && obj.error !== undefined && obj.error !== false) {
      return null;
    }
    if (obj.success === false) {
      return null;
    }

    // Check structured composite schemas (e.g. intro/summary + bullets/steps/sections + followUp)
    const compositeParts: string[] = [];
    const leadText =
      typeof obj.intro === 'string'
        ? obj.intro.trim()
        : typeof obj.greeting === 'string'
          ? obj.greeting.trim()
          : '';
    if (leadText) compositeParts.push(leadText);

    let mainDirectText = '';
    for (const key of DIRECT_TEXT_KEYS) {
      const val = obj[key];
      if (typeof val === 'string' && val.trim().length > 0) {
        const nestedCheck = extractSupportedJsonAnswer(val, depth + 1);
        if (nestedCheck) {
          mainDirectText = nestedCheck;
          break;
        }
      }
    }
    if (mainDirectText) {
      compositeParts.push(mainDirectText);
    }

    const bullets = cleanListItems(obj.bullets ?? obj.points ?? obj.options ?? obj.recommendations);
    if (bullets.length > 0) {
      compositeParts.push(bullets.map((b) => `- ${b}`).join('\n'));
    }

    const steps = cleanListItems(obj.steps ?? obj.preparationSteps ?? obj.instructions);
    if (steps.length > 0) {
      compositeParts.push(steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n'));
    }

    if (Array.isArray(obj.sections)) {
      for (const sec of obj.sections) {
        if (!sec || typeof sec !== 'object') continue;
        const sRec = sec as Record<string, unknown>;
        const heading =
          typeof sRec.heading === 'string'
            ? sRec.heading.trim()
            : typeof sRec.title === 'string'
              ? sRec.title.trim()
              : '';
        const paragraphs = Array.isArray(sRec.paragraphs)
          ? sRec.paragraphs.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          : typeof sRec.body === 'string' && sRec.body.trim().length > 0
            ? [sRec.body.trim()]
            : typeof sRec.content === 'string' && sRec.content.trim().length > 0
              ? [sRec.content.trim()]
              : [];
        if (heading && paragraphs.length > 0) {
          compositeParts.push(`**${heading}**\n${paragraphs.map((p) => p.trim()).join('\n\n')}`);
        } else if (paragraphs.length > 0) {
          compositeParts.push(paragraphs.map((p) => p.trim()).join('\n\n'));
        }
      }
    }

    const followUp =
      typeof obj.followUp === 'string'
        ? obj.followUp.trim()
        : typeof obj.follow_up === 'string'
          ? obj.follow_up.trim()
          : typeof obj.closing === 'string'
            ? obj.closing.trim()
            : '';
    if (followUp && !compositeParts.includes(followUp)) {
      compositeParts.push(followUp);
    }

    if (compositeParts.length > 0) {
      return compositeParts.join('\n\n').trim();
    }

    // Check nested envelopes (e.g. { message: { role: 'assistant', content: '...' } })
    for (const key of NESTED_ENVELOPE_KEYS) {
      const nested = obj[key];
      if (nested && typeof nested === 'object') {
        const extracted = extractSupportedJsonAnswer(nested, depth + 1);
        if (extracted) return extracted;
      }
    }
  }

  return null;
}

function stripOuterMarkdownFence(text: string): {
  unwrapped: string;
  stripped: boolean;
  fenceLang: string;
} {
  const trimmed = text.trim();
  const match = trimmed.match(/^```([a-zA-Z0-9_-]*)[ \t]*\r?\n([\s\S]*?)\r?\n?```$/);
  if (!match) {
    const inlineFence = trimmed.match(/^```(?:json|markdown|md|text)?\s+([\s\S]+?)\s*```$/i);
    if (inlineFence && !inlineFence[1].includes('```')) {
      return {
        unwrapped: inlineFence[1].trim(),
        stripped: true,
        fenceLang: 'inline',
      };
    }
    return { unwrapped: trimmed, stripped: false, fenceLang: '' };
  }

  const inner = match[2];
  // Only strip if there isn't another closing/reopening fence inside (meaning multiple separate blocks)
  if (inner.includes('```')) {
    return { unwrapped: trimmed, stripped: false, fenceLang: '' };
  }

  return {
    unwrapped: inner.trim(),
    stripped: true,
    fenceLang: (match[1] || '').toLowerCase(),
  };
}

function looksLikeMalformedJsonPayload(text: string): boolean {
  const t = text.trim();
  if (/^\{\s*"[A-Za-z0-9_ -]+"\s*:/.test(t)) return true;
  if (/^\{\s*'[A-Za-z0-9_ -]+'\s*:/.test(t)) return true;
  if (/^\[\s*\{\s*"[A-Za-z0-9_ -]+"\s*:/.test(t)) return true;
  if (/^\{\s*\n\s*"[A-Za-z0-9_ -]+"\s*:/.test(t)) return true;
  return false;
}

function normalizeEscapedLineBreaks(text: string): {
  value: string;
  converted: boolean;
} {
  let converted = false;
  let next = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Convert literal HTML <br> tags to clean line breaks without executing HTML
  if (/<br\s*\/?>/i.test(next)) {
    next = next.replace(/<br\s*\/?>/gi, '\n');
    converted = true;
  }

  if (next.includes('\\r\\n') || next.includes('\\n')) {
    const replaced = next
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ');
    if (replaced !== next) {
      converted = true;
      next = replaced;
      if (next.includes('\\"')) {
        next = next.replace(/\\"/g, '"');
      }
    }
  }

  return { value: next, converted };
}

function stripRoboticBoilerplate(text: string): string {
  let clean = text.replace(/^\[Strovyn Guidance\]\s*/i, '').trim();

  // Remove repetitive robotic opening sentence ONLY when followed by a real answer body
  const preambleMatch = clean.match(
    /^(?:As STRO,\s*(?:the\s+|your\s+)?(?:official\s+)?AI\s+(?:digital\s+)?assistant(?:\s+for\s+Strovyn(?:\s+Painting\s+Co\.?)?)?,?\s*|As (?:an?\s+|your\s+)?AI\s+(?:language\s+model|digital\s+assistant|assistant)(?:\s+for\s+Strovyn(?:\s+Painting\s+Co\.?)?)?,?\s*)I\s+(?:can|am happy to|would be happy to|am glad to)\s+(?:offer|provide|help(?:\s+(?:clarify|explain|answer|you\s+with))?|explain|clarify|share)[^.!?\n]*[.!:]\s+([\s\S]{35,})$/i
  );
  if (preambleMatch) {
    clean = preambleMatch[1].trim();
  }

  return clean;
}

export function trimIncompleteTrailingFragment(text: string, minKeepRatio = 0.55): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (/[.!?)"'\]`]$/.test(trimmed)) return trimmed;

  // Find the last clean sentence-ending punctuation
  let lastBoundary = -1;
  const sentenceRegex = /[.!?](?:["')\]]+)?(?=\s|$)/g;
  let match: RegExpExecArray | null;
  while ((match = sentenceRegex.exec(trimmed)) !== null) {
    lastBoundary = match.index + match[0].length;
  }

  if (lastBoundary >= Math.floor(trimmed.length * minKeepRatio)) {
    return trimmed.slice(0, lastBoundary).trim();
  }

  return trimmed;
}

export function clampAtSentenceBoundary(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const windowSlice = trimmed.slice(0, maxChars);
  const cleanSentence = trimIncompleteTrailingFragment(windowSlice, 0.5);
  if (cleanSentence.length < windowSlice.length) {
    return cleanSentence;
  }

  const lastSpace = windowSlice.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.7) {
    return `${windowSlice.slice(0, lastSpace).trimEnd()}…`;
  }
  return `${windowSlice.trimEnd()}…`;
}

export function normalizeStroAssistantText(
  rawInput: unknown,
  options?: {
    userMessage?: string;
    finishReason?: string;
  }
): StroNormalizationResult {
  const preserveCodeBlocks = userExplicitlyRequestedCodeOrJson(options?.userMessage);

  // Handle non-string inputs (e.g. pre-parsed envelope objects)
  if (rawInput !== null && typeof rawInput === 'object') {
    const extracted = extractSupportedJsonAnswer(rawInput);
    if (!extracted) {
      return {
        ok: false,
        content: '',
        unwrappedFromJson: false,
        strippedFence: false,
        convertedEscapedNewlines: false,
        preserveCodeBlocks,
        reason: 'UNEXPECTED_OBJECT_PAYLOAD',
      };
    }
    return normalizeStroAssistantText(extracted, options);
  }

  if (typeof rawInput !== 'string') {
    return {
      ok: false,
      content: '',
      unwrappedFromJson: false,
      strippedFence: false,
      convertedEscapedNewlines: false,
      preserveCodeBlocks,
      reason: 'EMPTY_OR_NON_STRING',
    };
  }

  const initialTrim = rawInput.trim();
  if (!initialTrim) {
    return {
      ok: false,
      content: '',
      unwrappedFromJson: false,
      strippedFence: false,
      convertedEscapedNewlines: false,
      preserveCodeBlocks,
      reason: 'EMPTY_RESPONSE',
    };
  }

  // Strip dangerous script/style blocks unconditionally
  let working = initialTrim
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .trim();

  if (preserveCodeBlocks) {
    working = working.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (options?.finishReason === 'MAX_TOKENS' && !working.includes('```')) {
      working = trimIncompleteTrailingFragment(working);
    }
    return {
      ok: working.length > 0,
      content: working,
      unwrappedFromJson: false,
      strippedFence: false,
      convertedEscapedNewlines: false,
      preserveCodeBlocks: true,
      reason: working.length > 0 ? undefined : 'EMPTY_AFTER_SANITIZE',
    };
  }

  let strippedFence = false;
  let unwrappedFromJson = false;

  // 1. Strip outer wrapping markdown fence if present
  const fenceCheck = stripOuterMarkdownFence(working);
  if (fenceCheck.stripped) {
    working = fenceCheck.unwrapped;
    strippedFence = true;
  }

  // 2. Detect JSON-encoded responses or malformed JSON payloads
  if (working.startsWith('{') || working.startsWith('[')) {
    try {
      const parsed = JSON.parse(working);
      const extracted = extractSupportedJsonAnswer(parsed);
      if (!extracted) {
        return {
          ok: false,
          content: '',
          unwrappedFromJson: false,
          strippedFence,
          convertedEscapedNewlines: false,
          preserveCodeBlocks: false,
          reason: 'UNEXPECTED_JSON_SCHEMA',
        };
      }
      working = extracted;
      unwrappedFromJson = true;
    } catch {
      if (fenceCheck.fenceLang === 'json' || looksLikeMalformedJsonPayload(working)) {
        return {
          ok: false,
          content: '',
          unwrappedFromJson: false,
          strippedFence,
          convertedEscapedNewlines: false,
          preserveCodeBlocks: false,
          reason: 'MALFORMED_JSON_RESPONSE',
        };
      }
    }
  }

  // 3. Convert escaped literal newlines (\n, \r\n) & <br> into real newlines
  const newlineNormalized = normalizeEscapedLineBreaks(working);
  working = newlineNormalized.value;

  // 4. Remove stray non-code fences in normal prose (e.g. ```markdown ... ```)
  if (working.includes('```')) {
    working = working.replace(/```(?:json|markdown|md|text|yaml|xml)?[ \t]*\n?/gi, '');
    strippedFence = true;
  }

  // If stripping inner fences exposed a raw JSON payload, re-check safely
  const retrimmed = working.trim();
  if ((retrimmed.startsWith('{') || retrimmed.startsWith('[')) && !unwrappedFromJson) {
    try {
      const parsed = JSON.parse(retrimmed);
      const extracted = extractSupportedJsonAnswer(parsed);
      if (!extracted) {
        return {
          ok: false,
          content: '',
          unwrappedFromJson: false,
          strippedFence,
          convertedEscapedNewlines: newlineNormalized.converted,
          preserveCodeBlocks: false,
          reason: 'UNEXPECTED_JSON_SCHEMA',
        };
      }
      working = extracted;
      unwrappedFromJson = true;
    } catch {
      if (looksLikeMalformedJsonPayload(retrimmed)) {
        return {
          ok: false,
          content: '',
          unwrappedFromJson: false,
          strippedFence,
          convertedEscapedNewlines: newlineNormalized.converted,
          preserveCodeBlocks: false,
          reason: 'MALFORMED_JSON_RESPONSE',
        };
      }
    }
  }

  // 5. Clean robotic preambles & leaked tags
  working = stripRoboticBoilerplate(working);

  // 6. If truncated by MAX_TOKENS, trim trailing partial word/clause cleanly
  if (options?.finishReason === 'MAX_TOKENS') {
    working = trimIncompleteTrailingFragment(working);
  }

  // 7. Normalize excessive blank lines & line spacing
  working = working
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!working) {
    return {
      ok: false,
      content: '',
      unwrappedFromJson,
      strippedFence,
      convertedEscapedNewlines: newlineNormalized.converted,
      preserveCodeBlocks: false,
      reason: 'EMPTY_AFTER_NORMALIZATION',
    };
  }

  return {
    ok: true,
    content: working,
    unwrappedFromJson,
    strippedFence,
    convertedEscapedNewlines: newlineNormalized.converted,
    preserveCodeBlocks: false,
  };
}

export function extractClientAssistantPayload(
  data: unknown,
  httpStatus = 200,
  userMessage?: string
): {
  ok: boolean;
  content: string;
  actions?: StroActionChip[];
  preserveCodeBlocks: boolean;
} {
  const defaultErr =
    httpStatus === 429
      ? 'Too many messages sent right now. Please pause a moment and try again.'
      : 'STRO could not respond just now. You can retry below or message our Adelaide team on WhatsApp (+61 406 646 061).';

  if (!data || typeof data !== 'object') {
    return { ok: false, content: defaultErr, preserveCodeBlocks: false };
  }

  const obj = data as Record<string, unknown>;
  const actions = Array.isArray(obj.actions) ? (obj.actions as StroActionChip[]) : undefined;

  if (httpStatus >= 400 || obj.success === false) {
    let errStr = '';
    if (typeof obj.error === 'string' && obj.error.trim().length > 0) {
      errStr = obj.error.trim();
    } else if (obj.error && typeof obj.error === 'object') {
      const errObj = obj.error as Record<string, unknown>;
      if (typeof errObj.message === 'string' && errObj.message.trim().length > 0) {
        errStr = errObj.message.trim();
      }
    } else if (obj.reply && typeof obj.reply === 'object') {
      const replyObj = obj.reply as Record<string, unknown>;
      if (typeof replyObj.content === 'string') errStr = replyObj.content.trim();
    }

    const cleanErr = normalizeStroAssistantText(errStr || defaultErr);
    return {
      ok: false,
      content: cleanErr.ok ? cleanErr.content : defaultErr,
      actions,
      preserveCodeBlocks: false,
    };
  }

  // Prefer structured `reply.content`, then `message.content`, then string `message`
  let rawCandidate: unknown = undefined;
  if (obj.reply && typeof obj.reply === 'object') {
    rawCandidate = (obj.reply as Record<string, unknown>).content;
  }
  if (rawCandidate === undefined && obj.message && typeof obj.message === 'object') {
    rawCandidate = (obj.message as Record<string, unknown>).content;
  }
  if (rawCandidate === undefined) {
    rawCandidate = obj.message;
  }

  const normalized = normalizeStroAssistantText(rawCandidate, { userMessage });
  if (!normalized.ok) {
    return { ok: false, content: defaultErr, actions, preserveCodeBlocks: false };
  }

  return {
    ok: true,
    content: normalized.content,
    actions,
    preserveCodeBlocks: normalized.preserveCodeBlocks,
  };
}

const INLINE_TOKEN_PATTERN =
  /(`[^`\n]+`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*\n]+|\*(?!\*)[^*\n]*)+\*\*)|(__([^_\n]+|_(?!_)[^_\n]*)+__)|((?<![*\w])\*([^*\n]+)\*(?![*\w]))|((?:^|(?<=[\s(]))(\/(?:about|services(?:\/[a-z0-9-]+)?|projects(?:\/[a-z0-9-]+)?|insights(?:\/[a-z0-9-]+)?|contact|careers|feedback|visualiser))(?=$|[\s).,!?;:]))/g;

export function parseStroInlineTokens(line: string, depth = 0): StroInlineNode[] {
  if (!line) return [];
  if (depth > 3) return [{ type: 'text', value: line }];

  const nodes: StroInlineNode[] = [];
  let lastIndex = 0;

  const regex = new RegExp(INLINE_TOKEN_PATTERN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', value: line.slice(lastIndex, match.index) });
    }

    const full = match[0];

    if (match[1]) {
      // Inline code `...`
      nodes.push({ type: 'code', value: full.slice(1, -1) });
    } else if (match[2]) {
      // Markdown link [label](href)
      const label = match[3].trim();
      const rawHref = match[4].trim();
      if (isApprovedStroInternalRoute(rawHref)) {
        nodes.push({ type: 'link', label, href: rawHref, external: false });
      } else if (isSafeStroExternalHref(rawHref)) {
        nodes.push({ type: 'link', label, href: rawHref, external: true });
      } else {
        // Untrusted or malformed external link: render label safely as plain text
        nodes.push(...parseStroInlineTokens(label, depth + 1));
      }
    } else if (match[5] || match[7]) {
      // Bold **...** or __...__
      const inner = full.slice(2, -2);
      nodes.push({ type: 'strong', children: parseStroInlineTokens(inner, depth + 1) });
    } else if (match[9]) {
      // Italic *...*
      const inner = match[10];
      nodes.push({ type: 'em', children: parseStroInlineTokens(inner, depth + 1) });
    } else if (match[11]) {
      // Bare approved internal route (e.g. /contact, /visualiser)
      const routePath = match[12];
      if (isApprovedStroInternalRoute(routePath)) {
        nodes.push({ type: 'link', label: routePath, href: routePath, external: false });
      } else {
        nodes.push({ type: 'text', value: full });
      }
    } else {
      nodes.push({ type: 'text', value: full });
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < line.length) {
    nodes.push({ type: 'text', value: line.slice(lastIndex) });
  }

  return nodes;
}

function parseTextSegmentIntoBlocks(segment: string): StroBlockNode[] {
  const blocks: StroBlockNode[] = [];
  const rawLines = segment.split('\n');

  let paragraphLines: StroInlineNode[][] = [];
  let bulletItems: StroInlineNode[][] = [];
  let orderedItems: StroInlineNode[][] = [];
  let orderedStart = 1;

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', lines: paragraphLines });
      paragraphLines = [];
    }
  };

  const flushBullets = () => {
    if (bulletItems.length > 0) {
      blocks.push({ type: 'unordered_list', items: bulletItems });
      bulletItems = [];
    }
  };

  const flushOrdered = () => {
    if (orderedItems.length > 0) {
      blocks.push({ type: 'ordered_list', start: orderedStart, items: orderedItems });
      orderedItems = [];
      orderedStart = 1;
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushOrdered();
  };

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    // Markdown Heading (#, ##, ###, ####)
    const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      flushAll();
      blocks.push({
        type: 'heading',
        content: parseStroInlineTokens(headingMatch[1].trim()),
      });
      continue;
    }

    // Unordered Bullet List (-, *, •)
    const bulletMatch = trimmed.match(/^(?:[-*•])\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      flushOrdered();
      bulletItems.push(parseStroInlineTokens(bulletMatch[1].trim()));
      continue;
    }

    // Ordered Numbered List (1., 2))
    const orderedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      flushBullets();
      if (orderedItems.length === 0) {
        orderedStart = Number.parseInt(orderedMatch[1], 10) || 1;
      }
      orderedItems.push(parseStroInlineTokens(orderedMatch[2].trim()));
      continue;
    }

    // Standard prose line
    flushBullets();
    flushOrdered();
    paragraphLines.push(parseStroInlineTokens(trimmed));
  }

  flushAll();
  return blocks;
}

export function parseStroRichTextBlocks(
  content: string,
  options?: { allowCodeBlocks?: boolean }
): StroBlockNode[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  if (!options?.allowCodeBlocks || !normalized.includes('```')) {
    const defenced = normalized.replace(/```[a-zA-Z0-9_-]*[ \t]*\n?/g, '');
    return parseTextSegmentIntoBlocks(defenced);
  }

  const blocks: StroBlockNode[] = [];
  const fenceRegex = /```([a-zA-Z0-9_-]*)[ \t]*\n([\s\S]*?)```/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(normalized)) !== null) {
    if (match.index > lastIdx) {
      const before = normalized.slice(lastIdx, match.index).trim();
      if (before) {
        blocks.push(...parseTextSegmentIntoBlocks(before));
      }
    }

    blocks.push({
      type: 'code_block',
      language: match[1] ? match[1].toLowerCase() : undefined,
      code: match[2].replace(/\n$/, ''),
    });

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < normalized.length) {
    const tail = normalized.slice(lastIdx).trim();
    if (tail) {
      blocks.push(...parseTextSegmentIntoBlocks(tail));
    }
  }

  return blocks;
}
