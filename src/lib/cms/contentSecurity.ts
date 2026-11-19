import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { escapeHtml } from '@/lib/security/escapeHtml';
import {
  isApprovedPreviewImageUrl,
  validateApprovedEditorialMediaUrl,
} from './mediaUrlPolicy';

const MAX_DOCUMENT_NODES = 1500;
const MAX_NESTING_DEPTH = 8;

const TEXT_ALIGN_VALUES = ['left', 'center', 'right'] as const;

export type SafeLinkResult =
  | { valid: true; href: string; isExternal: boolean }
  | { valid: false; reason: string };

/**
 * Validates link targets strictly to safe http(s), mailto, or single-slash
 * relative paths (`/...`, excluding `//...`). Rejects `javascript:`, `data:`,
 * `vbscript:`, `file:`, and control characters.
 */
export function validateSafeEditorialHref(rawHref: string): SafeLinkResult {
  const trimmed = rawHref.trim();
  if (!trimmed || trimmed.length > 1000) {
    return { valid: false, reason: 'Link href is empty or exceeds maximum length.' };
  }

  // Check for ASCII control chars, whitespace, or encoded scheme smuggling
  if (/[\x00-\x1f\s]/.test(trimmed)) {
    return { valid: false, reason: 'Link href contains invalid whitespace or control characters.' };
  }

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return { valid: true, href: trimmed, isExternal: false };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Malformed link URL.' };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol === 'https:' || protocol === 'http:') {
    return { valid: true, href: parsed.toString(), isExternal: true };
  }

  if (protocol === 'mailto:') {
    return { valid: true, href: parsed.toString(), isExternal: true };
  }

  return {
    valid: false,
    reason: `Unsupported or unsafe link protocol '${protocol}'.`,
  };
}

/**
 * Detects dangerous raw HTML patterns inside text/payload strings so unsafe
 * payloads fail loudly instead of silently executing or losing markup.
 */
export function containsUnsafeHtmlPattern(input: string): boolean {
  return /<\s*\/?\s*(?:script|iframe|object|embed|style|svg|math|form|input|button|link|meta|base)\b|on[a-z]+\s*=|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html/i.test(
    input
  );
}

const BoldMarkSchema = z
  .object({
    type: z.literal('bold'),
  })
  .strict();

const ItalicMarkSchema = z
  .object({
    type: z.literal('italic'),
  })
  .strict();

const LinkMarkSchema = z
  .object({
    type: z.literal('link'),
    attrs: z
      .object({
        href: z.string().min(1).max(1000),
        target: z.enum(['_blank', '_self']).optional().nullable(),
        rel: z
          .string()
          .max(120)
          .refine((val) => !containsUnsafeHtmlPattern(val), {
            message: 'Link rel contains unsafe characters.',
          })
          .optional()
          .nullable(),
        class: z
          .string()
          .max(120)
          .refine((val) => !containsUnsafeHtmlPattern(val), {
            message: 'Link class contains unsafe characters.',
          })
          .optional()
          .nullable(),
        title: z
          .string()
          .trim()
          .max(200)
          .refine((val) => !containsUnsafeHtmlPattern(val), {
            message: 'Link title contains unsafe markup.',
          })
          .optional()
          .nullable(),
      })
      .strict()
      .superRefine((attrs, ctx) => {
        const check = validateSafeEditorialHref(attrs.href);
        if (!check.valid) {
          ctx.addIssue({
            code: 'custom',
            message: check.reason,
          });
        }
      }),
  })
  .strict();

export const TiptapMarkSchema = z.discriminatedUnion('type', [
  BoldMarkSchema,
  ItalicMarkSchema,
  LinkMarkSchema,
]);

const TextNodeSchema = z
  .object({
    type: z.literal('text'),
    text: z
      .string()
      .min(1)
      .max(10000)
      .refine((txt) => !containsUnsafeHtmlPattern(txt), {
        message: 'Text content must not contain embedded HTML or script payloads.',
      }),
    marks: z.array(TiptapMarkSchema).max(6).optional(),
  })
  .strict();

const HardBreakNodeSchema = z
  .object({
    type: z.literal('hardBreak'),
  })
  .strict();

export const InlineNodeSchema = z.discriminatedUnion('type', [
  TextNodeSchema,
  HardBreakNodeSchema,
]);

const AlignAttrsSchema = z
  .object({
    textAlign: z.enum(TEXT_ALIGN_VALUES).optional().nullable(),
  })
  .strict();

const ParagraphNodeSchema = z
  .object({
    type: z.literal('paragraph'),
    attrs: AlignAttrsSchema.optional(),
    content: z.array(InlineNodeSchema).max(500).optional(),
  })
  .strict();

const HeadingNodeSchema = z
  .object({
    type: z.literal('heading'),
    attrs: z
      .object({
        level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
        textAlign: z.enum(TEXT_ALIGN_VALUES).optional().nullable(),
      })
      .strict(),
    content: z.array(InlineNodeSchema).max(200).optional(),
  })
  .strict();

const ImageNodeSchema = z
  .object({
    type: z.literal('image'),
    attrs: z
      .object({
        src: z.string().min(1).max(1000),
        alt: z
          .string()
          .trim()
          .min(3, 'Image alt text must be at least 3 characters.')
          .max(300, 'Image alt text must be at most 300 characters.')
          .refine((alt) => !containsUnsafeHtmlPattern(alt), {
            message: 'Alt text contains unsafe characters.',
          }),
        title: z.string().trim().max(200).optional().nullable(),
        width: z.number().int().min(16).max(8192).optional().nullable(),
        height: z.number().int().min(16).max(8192).optional().nullable(),
      })
      .strict()
      .superRefine((attrs, ctx) => {
        const res = validateApprovedEditorialMediaUrl(attrs.src);
        if (!res.valid) {
          ctx.addIssue({
            code: 'custom',
            message: res.reason,
          });
        }
      }),
  })
  .strict();

const HorizontalRuleNodeSchema = z
  .object({
    type: z.literal('horizontalRule'),
  })
  .strict();

export type ListItemNode = {
  type: 'listItem';
  content: Array<
    | z.infer<typeof ParagraphNodeSchema>
    | BulletListNode
    | OrderedListNode
  >;
};

export type BulletListNode = {
  type: 'bulletList';
  content: ListItemNode[];
};

export type OrderedListNode = {
  type: 'orderedList';
  attrs?: {
    start?: number | null;
    type?: '1' | 'a' | 'A' | 'i' | 'I' | null;
  };
  content: ListItemNode[];
};

const ListItemNodeSchema: z.ZodType<ListItemNode> = z.lazy(() =>
  z
    .object({
      type: z.literal('listItem'),
      content: z
        .array(
          z.union([
            ParagraphNodeSchema,
            BulletListNodeSchema,
            OrderedListNodeSchema,
          ])
        )
        .min(1)
        .max(100),
    })
    .strict()
);

const BulletListNodeSchema: z.ZodType<BulletListNode> = z.lazy(() =>
  z
    .object({
      type: z.literal('bulletList'),
      content: z.array(ListItemNodeSchema).min(1).max(200),
    })
    .strict()
);

const OrderedListNodeSchema: z.ZodType<OrderedListNode> = z.lazy(() =>
  z
    .object({
      type: z.literal('orderedList'),
      attrs: z
        .object({
          start: z.number().int().min(1).max(1000).optional().nullable(),
          type: z.enum(['1', 'a', 'A', 'i', 'I']).optional().nullable(),
        })
        .strict()
        .optional(),
      content: z.array(ListItemNodeSchema).min(1).max(200),
    })
    .strict()
);

const BlockquoteNodeSchema = z
  .object({
    type: z.literal('blockquote'),
    content: z
      .array(
        z.union([
          ParagraphNodeSchema,
          BulletListNodeSchema,
          OrderedListNodeSchema,
        ])
      )
      .min(1)
      .max(100),
  })
  .strict();

export const TopLevelBlockSchema = z.union([
  ParagraphNodeSchema,
  HeadingNodeSchema,
  BlockquoteNodeSchema,
  BulletListNodeSchema,
  OrderedListNodeSchema,
  ImageNodeSchema,
  HorizontalRuleNodeSchema,
]);

export const TiptapDocSchema = z
  .object({
    type: z.literal('doc'),
    content: z.array(TopLevelBlockSchema).min(1).max(500),
  })
  .strict();

export type TiptapDoc = z.infer<typeof TiptapDocSchema>;
type AnyTiptapNode =
  | TiptapDoc
  | z.infer<typeof TopLevelBlockSchema>
  | z.infer<typeof InlineNodeSchema>
  | ListItemNode;

function countNodesAndDepth(
  node: AnyTiptapNode,
  depth: number = 1
): { count: number; maxDepth: number } {
  if (depth > MAX_NESTING_DEPTH) {
    throw new Error(`Document exceeds maximum nesting depth of ${MAX_NESTING_DEPTH}.`);
  }

  let total = 1;
  let maxD = depth;

  if ('content' in node && Array.isArray(node.content)) {
    for (const child of node.content) {
      const sub = countNodesAndDepth(child as AnyTiptapNode, depth + 1);
      total += sub.count;
      if (sub.maxDepth > maxD) maxD = sub.maxDepth;
      if (total > MAX_DOCUMENT_NODES) {
        throw new Error(`Document exceeds maximum node limit of ${MAX_DOCUMENT_NODES}.`);
      }
    }
  }

  return { count: total, maxDepth: maxD };
}

function buildSanitizeOptions(options: { allowSignedPreviewUrls?: boolean } = {}): sanitizeHtml.IOptions {
  return {
    allowedTags: [
      'p',
      'h2',
      'h3',
      'h4',
      'strong',
      'em',
      'blockquote',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'hr',
      'br',
    ],
    allowedAttributes: {
      p: ['class'],
      h2: ['class'],
      h3: ['class'],
      h4: ['class'],
      ol: ['start', 'type'],
      a: ['href', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'width', 'height'],
    },
    allowedClasses: {
      p: ['text-left', 'text-center', 'text-right'],
      h2: ['text-left', 'text-center', 'text-right'],
      h3: ['text-left', 'text-center', 'text-right'],
      h4: ['text-left', 'text-center', 'text-right'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (tagName, attribs) => {
        const hrefCheck = validateSafeEditorialHref(attribs.href || '');
        if (!hrefCheck.valid) {
          return { tagName: 'span', attribs: {} };
        }
        const nextAttribs: Record<string, string> = {
          href: hrefCheck.href,
        };
        if (hrefCheck.isExternal) {
          nextAttribs.target = '_blank';
          nextAttribs.rel = 'noopener noreferrer nofollow';
        } else {
          nextAttribs.rel = 'noopener noreferrer';
        }
        const trimmedTitle = attribs.title?.trim();
        if (trimmedTitle && !containsUnsafeHtmlPattern(trimmedTitle)) {
          nextAttribs.title = trimmedTitle;
        }
        return { tagName, attribs: nextAttribs };
      },
      img: (tagName, attribs) => {
        const rawSrc = attribs.src || '';
        let resolvedUrl: string | null = null;
        if (options.allowSignedPreviewUrls) {
          if (isApprovedPreviewImageUrl(rawSrc)) {
            resolvedUrl = rawSrc.trim();
          }
        } else {
          const urlCheck = validateApprovedEditorialMediaUrl(rawSrc);
          if (urlCheck.valid) {
            resolvedUrl = urlCheck.url;
          }
        }
        if (!resolvedUrl) {
          return { tagName: 'span', attribs: {} };
        }
        // Pass unescaped alt text to sanitize-html, which HTML-escapes attribute values on serialization.
        const nextAttribs: Record<string, string> = {
          src: resolvedUrl,
          alt: (attribs.alt || '').trim(),
        };
        if (attribs.width && /^\d{2,4}$/.test(attribs.width)) {
          nextAttribs.width = attribs.width;
        }
        if (attribs.height && /^\d{2,4}$/.test(attribs.height)) {
          nextAttribs.height = attribs.height;
        }
        return { tagName, attribs: nextAttribs };
      },
    },
  };
}

export const STRICT_HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = buildSanitizeOptions();

function renderInlineNodes(nodes: z.infer<typeof InlineNodeSchema>[] | undefined): {
  html: string;
  text: string;
} {
  if (!nodes || nodes.length === 0) {
    return { html: '', text: '' };
  }

  let html = '';
  let text = '';

  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      html += '<br />';
      text += '\n';
      continue;
    }

    let segmentHtml = escapeHtml(node.text);
    text += node.text;

    if (node.marks && node.marks.length > 0) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') {
          segmentHtml = `<strong>${segmentHtml}</strong>`;
        } else if (mark.type === 'italic') {
          segmentHtml = `<em>${segmentHtml}</em>`;
        } else if (mark.type === 'link') {
          const check = validateSafeEditorialHref(mark.attrs.href);
          if (!check.valid) {
            throw new Error(check.reason);
          }
          const relAttr = check.isExternal
            ? 'noopener noreferrer nofollow'
            : 'noopener noreferrer';
          const targetAttr = check.isExternal ? ' target="_blank"' : '';
          const titleAttr = mark.attrs.title?.trim()
            ? ` title="${escapeHtml(mark.attrs.title.trim())}"`
            : '';
          segmentHtml = `<a href="${escapeHtml(check.href)}"${targetAttr} rel="${relAttr}"${titleAttr}>${segmentHtml}</a>`;
        }
      }
    }

    html += segmentHtml;
  }

  return { html, text };
}

function alignClassAttribute(textAlign?: 'left' | 'center' | 'right' | null): string {
  if (!textAlign || textAlign === 'left') return '';
  return ` class="text-${textAlign}"`;
}

function renderListNode(node: BulletListNode | OrderedListNode): {
  html: string;
  textBlocks: string[];
} {
  const tag = node.type === 'bulletList' ? 'ul' : 'ol';
  const startAttr =
    node.type === 'orderedList' &&
    node.attrs?.start &&
    node.attrs.start !== 1
      ? ` start="${node.attrs.start}"`
      : '';
  const typeAttr =
    node.type === 'orderedList' && node.attrs?.type
      ? ` type="${node.attrs.type}"`
      : '';

  let itemsHtml = '';
  const textBlocks: string[] = [];

  for (const li of node.content) {
    let liInnerHtml = '';
    for (const child of li.content) {
      if (child.type === 'paragraph') {
        const rendered = renderInlineNodes(child.content);
        liInnerHtml += `<p${alignClassAttribute(child.attrs?.textAlign)}>${rendered.html}</p>`;
        if (rendered.text.trim()) {
          textBlocks.push(rendered.text.trim());
        }
      } else {
        const nested = renderListNode(child);
        liInnerHtml += nested.html;
        textBlocks.push(...nested.textBlocks);
      }
    }
    itemsHtml += `<li>${liInnerHtml}</li>`;
  }

  return {
    html: `<${tag}${startAttr}${typeAttr}>${itemsHtml}</${tag}>`,
    textBlocks,
  };
}

export interface CompiledEditorialContent {
  contentJson: TiptapDoc;
  contentHtml: string;
  plainText: string;
  readingTimeMinutes: number;
}

/**
 * Sanitizes an editorial HTML string via `sanitize-html` after rejecting any
 * raw dangerous embedded payloads (prevents silent XSS retention or stripping).
 */
export function sanitizeEditorialHtml(
  rawHtml: string,
  options: { rejectDangerousMarkup?: boolean; allowSignedPreviewUrls?: boolean } = {}
): string {
  if (options.rejectDangerousMarkup && containsUnsafeHtmlPattern(rawHtml)) {
    throw new Error(
      'HTML payload contains prohibited elements, event handlers, or unsafe URL schemes.'
    );
  }
  return sanitizeHtml(
    rawHtml,
    options.allowSignedPreviewUrls
      ? buildSanitizeOptions({ allowSignedPreviewUrls: true })
      : STRICT_HTML_SANITIZE_OPTIONS
  );
}

/**
 * Validates Tiptap JSON against the explicit strict node/mark allowlist,
 * renders semantic HTML deterministically, passes it through the server-side
 * `sanitize-html` pipeline, and extracts plain text + reading time.
 */
export function validateAndCompileTiptapContent(
  rawJson: unknown
): { ok: true; compiled: CompiledEditorialContent } | { ok: false; error: string } {
  const parsed = TiptapDocSchema.safeParse(rawJson);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const pathLabel =
      firstIssue && firstIssue.path.length > 0
        ? ` at '${firstIssue.path.join('.')}'`
        : '';
    return {
      ok: false,
      error: `Invalid article content structure${pathLabel}: ${firstIssue?.message ?? 'Unsupported node or mark'}`,
    };
  }

  const doc = parsed.data;
  try {
    countNodesAndDepth(doc);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Article content exceeds structural limits.',
    };
  }

  const htmlParts: string[] = [];
  const textBlocks: string[] = [];

  try {
    for (const block of doc.content) {
      switch (block.type) {
        case 'paragraph': {
          const rendered = renderInlineNodes(block.content);
          htmlParts.push(
            `<p${alignClassAttribute(block.attrs?.textAlign)}>${rendered.html}</p>`
          );
          if (rendered.text.trim()) {
            textBlocks.push(rendered.text.trim());
          }
          break;
        }
        case 'heading': {
          const rendered = renderInlineNodes(block.content);
          const tag = `h${block.attrs.level}`;
          htmlParts.push(
            `<${tag}${alignClassAttribute(block.attrs.textAlign)}>${rendered.html}</${tag}>`
          );
          if (rendered.text.trim()) {
            textBlocks.push(rendered.text.trim());
          }
          break;
        }
        case 'blockquote': {
          const innerParts: string[] = [];
          for (const child of block.content) {
            if (child.type === 'paragraph') {
              const rendered = renderInlineNodes(child.content);
              innerParts.push(
                `<p${alignClassAttribute(child.attrs?.textAlign)}>${rendered.html}</p>`
              );
              if (rendered.text.trim()) {
                textBlocks.push(rendered.text.trim());
              }
            } else {
              const listRes = renderListNode(child);
              innerParts.push(listRes.html);
              textBlocks.push(...listRes.textBlocks);
            }
          }
          htmlParts.push(`<blockquote>${innerParts.join('')}</blockquote>`);
          break;
        }
        case 'bulletList':
        case 'orderedList': {
          const listRes = renderListNode(block);
          htmlParts.push(listRes.html);
          textBlocks.push(...listRes.textBlocks);
          break;
        }
        case 'image': {
          const srcCheck = validateApprovedEditorialMediaUrl(block.attrs.src);
          if (!srcCheck.valid) {
            return { ok: false, error: srcCheck.reason };
          }
          const widthAttr = block.attrs.width ? ` width="${block.attrs.width}"` : '';
          const heightAttr = block.attrs.height ? ` height="${block.attrs.height}"` : '';
          htmlParts.push(
            `<img src="${escapeHtml(srcCheck.url)}" alt="${escapeHtml(block.attrs.alt)}"${widthAttr}${heightAttr} />`
          );
          break;
        }
        case 'horizontalRule': {
          htmlParts.push('<hr />');
          break;
        }
      }
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to compile editorial content.',
    };
  }

  const plainText = textBlocks.join('\n\n').trim();
  if (plainText.length < 20) {
    return {
      ok: false,
      error: 'Article body must contain at least 20 characters of readable text.',
    };
  }

  const sanitizedHtml = sanitizeEditorialHtml(htmlParts.join(''), {
    rejectDangerousMarkup: true,
  });

  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.min(60, Math.ceil(wordCount / 200)));

  return {
    ok: true,
    compiled: {
      contentJson: doc,
      contentHtml: sanitizedHtml,
      plainText,
      readingTimeMinutes,
    },
  };
}
