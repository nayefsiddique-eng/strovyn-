'use client';

import React, { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Unlink,
} from 'lucide-react';
import type { TiptapDoc } from '@/lib/cms/contentSecurity';
import { validateApprovedEditorialMediaUrl } from '@/lib/cms/mediaUrlPolicy';
import { resolveEditorPreviewImageSrc } from '@/lib/cms/editorHelpers';

export interface UploadedEditorialImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface PendingEditorialImageInsert {
  requestId: number;
  url: string;
  alt: string;
  width?: number | null;
  height?: number | null;
}

export interface EditorialRichTextEditorProps {
  value: TiptapDoc;
  onChange: (doc: TiptapDoc) => void;
  documentKey?: string | number;
  disabled?: boolean;
  onUploadImage?: (file: File, altText: string) => Promise<UploadedEditorialImage>;
  onOpenMediaLibrary?: () => void;
  pendingImageInsert?: PendingEditorialImageInsert | null;
  ariaLabel?: string;
}

/**
 * Custom Tiptap Image node extension whose ProseMirror attributes and `renderHTML`
 * strictly retain canonical `/api/editorial-media/<uuid>` URLs while visually
 * rendering authenticated `/api/admin/insights/media/<uuid>` preview streams in
 * the interactive editor DOM.
 */
function buildEditorialPreviewImageExtension() {
  if (typeof Image?.extend !== 'function') {
    return Image;
  }
  return Image.extend({
    addNodeView() {
      return ({ node }) => {
        const wrapper = document.createElement('figure');
        wrapper.className = 'my-4 border border-warm-grey/40 bg-ivory-light/60 p-2';
        wrapper.setAttribute('data-editorial-image-node', 'true');

        const img = document.createElement('img');
        img.className = 'max-w-full h-auto block mx-auto';

        const caption = document.createElement('figcaption');
        caption.className = 'mt-1.5 font-mono text-[10px] text-warm-grey-dark truncate';

        const applyNodeAttrs = (currentNode: typeof node) => {
          const canonicalSrc =
            typeof currentNode.attrs.src === 'string' ? currentNode.attrs.src : '';
          img.src = resolveEditorPreviewImageSrc(canonicalSrc);
          img.alt = typeof currentNode.attrs.alt === 'string' ? currentNode.attrs.alt : '';
          if (currentNode.attrs.width) {
            img.setAttribute('width', String(currentNode.attrs.width));
          } else {
            img.removeAttribute('width');
          }
          if (currentNode.attrs.height) {
            img.setAttribute('height', String(currentNode.attrs.height));
          } else {
            img.removeAttribute('height');
          }
          caption.textContent = canonicalSrc
            ? `${img.alt || 'Editorial image'} · ${canonicalSrc}`
            : img.alt || 'Editorial image';
        };

        applyNodeAttrs(node);
        wrapper.appendChild(img);
        wrapper.appendChild(caption);

        return {
          dom: wrapper,
          update(updatedNode) {
            if (updatedNode.type.name !== 'image') return false;
            applyNodeAttrs(updatedNode);
            return true;
          },
        };
      };
    },
  });
}

const DEFAULT_EMPTY_DOC: TiptapDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

export interface EditorSyncCheckInput {
  incomingSerialized: string;
  lastEmittedSerialized: string | null;
  lastAppliedExternalSerialized: string | null;
  currentEditorSerialized: string;
}

export function computeExternalSyncPlan(input: EditorSyncCheckInput): {
  shouldSync: boolean;
  reason:
    | 'matches_last_emitted'
    | 'already_applied'
    | 'matches_editor'
    | 'external_update';
} {
  if (input.incomingSerialized === input.lastEmittedSerialized) {
    return { shouldSync: false, reason: 'matches_last_emitted' };
  }
  if (input.incomingSerialized === input.lastAppliedExternalSerialized) {
    return { shouldSync: false, reason: 'already_applied' };
  }
  if (input.incomingSerialized === input.currentEditorSerialized) {
    return { shouldSync: false, reason: 'matches_editor' };
  }
  return { shouldSync: true, reason: 'external_update' };
}

function isSafeClientHref(rawHref: string): boolean {
  const trimmed = rawHref.trim();
  if (!trimmed || /[\x00-\x1f\s]/.test(trimmed)) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === 'https:' ||
      parsed.protocol === 'http:' ||
      parsed.protocol === 'mailto:'
    );
  } catch {
    return false;
  }
}

export function isSafeClientImageUrl(rawUrl: string): boolean {
  return validateApprovedEditorialMediaUrl(rawUrl).valid;
}

function ToolbarButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-pressed={Boolean(active)}
      title={label}
      className={`inline-flex items-center justify-center px-2.5 py-1.5 text-xs font-sans border transition-colors ${
        active
          ? 'bg-charcoal text-ivory border-charcoal'
          : 'bg-white text-charcoal border-warm-grey/50 hover:border-charcoal'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

/**
 * Reusable Tiptap rich-text editor foundation aligned strictly with the
 * server-side `TiptapDocSchema` allowlist. Disallows raw HTML entry and
 * outputs canonical ProseMirror/Tiptap JSON (`immediatelyRender: false` for SSR).
 */
export function EditorialRichTextEditor({
  value,
  onChange,
  documentKey,
  disabled = false,
  onUploadImage,
  onOpenMediaLibrary,
  pendingImageInsert = null,
  ariaLabel = 'Article body editor',
}: EditorialRichTextEditorProps) {
  const [activePopover, setActivePopover] = useState<'none' | 'link' | 'image'>('none');
  const [linkInput, setLinkInput] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageAltInput, setImageAltInput] = useState('');
  const [controlError, setControlError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastHandledInsertRef = useRef<number | null>(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const initialDoc = value || DEFAULT_EMPTY_DOC;
  const lastEmittedRef = useRef<string | null>(null);
  const lastAppliedExternalRef = useRef<string | null>(JSON.stringify(initialDoc));
  const prevDocumentKeyRef = useRef<string | number | undefined>(documentKey);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
        },
      }),
      buildEditorialPreviewImageExtension().configure({
        inline: false,
        allowBase64: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
      }),
    ],
    content: initialDoc,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel,
        class:
          'min-h-[340px] px-5 py-4 focus:outline-none font-sans text-base leading-relaxed text-charcoal space-y-4 [&_h2]:font-display [&_h2]:text-2xl [&_h3]:font-display [&_h3]:text-xl [&_h4]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-bronze [&_blockquote]:pl-4 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-bronze [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_hr]:border-warm-grey/40',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const nextDoc = ed.getJSON() as TiptapDoc;
      lastEmittedRef.current = JSON.stringify(nextDoc);
      onChangeRef.current(nextDoc);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;

    const incomingDoc = value || DEFAULT_EMPTY_DOC;
    const incomingSerialized = JSON.stringify(incomingDoc);
    const keyChanged = prevDocumentKeyRef.current !== documentKey;
    prevDocumentKeyRef.current = documentKey;

    if (keyChanged) {
      lastEmittedRef.current = null;
      lastAppliedExternalRef.current = incomingSerialized;
      setActivePopover('none');
      setControlError(null);
      editor.commands.setContent(incomingDoc, { emitUpdate: false });
      return;
    }

    const currentEditorSerialized = JSON.stringify(editor.getJSON());
    const syncPlan = computeExternalSyncPlan({
      incomingSerialized,
      lastEmittedSerialized: lastEmittedRef.current,
      lastAppliedExternalSerialized: lastAppliedExternalRef.current,
      currentEditorSerialized,
    });

    if (!syncPlan.shouldSync) {
      return;
    }

    const prevSelection = editor.state.selection;
    lastAppliedExternalRef.current = incomingSerialized;
    editor.commands.setContent(incomingDoc, { emitUpdate: false });

    const maxPos = editor.state.doc.content.size;
    if (prevSelection && maxPos >= 0) {
      const clampedFrom = Math.max(0, Math.min(prevSelection.from, maxPos));
      const clampedTo = Math.max(0, Math.min(prevSelection.to, maxPos));
      try {
        editor.commands.setTextSelection({ from: clampedFrom, to: clampedTo });
      } catch {
        // Ignore selection restoration if document structure shifted completely
      }
    }
  }, [editor, value, documentKey]);

  useEffect(() => {
    if (!editor || !pendingImageInsert || disabled) return;
    if (lastHandledInsertRef.current === pendingImageInsert.requestId) return;
    const urlCheck = validateApprovedEditorialMediaUrl(pendingImageInsert.url);
    if (!urlCheck.valid) return;
    lastHandledInsertRef.current = pendingImageInsert.requestId;
    editor
      .chain()
      .focus()
      .setImage({
        src: urlCheck.url,
        alt: pendingImageInsert.alt.trim(),
      })
      .run();
  }, [editor, pendingImageInsert, disabled]);

  const handleApplyLink = () => {
    if (!editor) return;
    setControlError(null);
    const trimmed = linkInput.trim();
    if (!isSafeClientHref(trimmed)) {
      setControlError('Enter a valid https://, http://, mailto:, or internal / path.');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
    setLinkInput('');
    setActivePopover('none');
  };

  const handleInsertImageByUrl = () => {
    if (!editor) return;
    setControlError(null);
    const url = imageUrlInput.trim();
    const alt = imageAltInput.trim();
    if (!isSafeClientImageUrl(url)) {
      setControlError(
        'Image URL must target editorial-media, Unsplash, or local /images/*.jpg|png|webp.'
      );
      return;
    }
    if (alt.length < 3 || alt.length > 300) {
      setControlError('Accessible alt text (3-300 characters) is required.');
      return;
    }
    editor.chain().focus().setImage({ src: url, alt }).run();
    setImageUrlInput('');
    setImageAltInput('');
    setActivePopover('none');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editor || !onUploadImage) return;

    const alt = imageAltInput.trim();
    if (alt.length < 3 || alt.length > 300) {
      setControlError('Enter descriptive alt text (3-300 characters) before uploading.');
      return;
    }

    setControlError(null);
    setIsUploadingImage(true);
    try {
      const uploaded = await onUploadImage(file, alt);
      editor
        .chain()
        .focus()
        .setImage({
          src: uploaded.url,
          alt: uploaded.alt,
        })
        .run();
      setImageAltInput('');
      setActivePopover('none');
    } catch (err) {
      setControlError(
        err instanceof Error ? err.message : 'Unable to upload editorial image.'
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="border border-warm-grey/50 bg-white">
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Editorial formatting controls"
        className="flex flex-wrap items-center gap-1.5 border-b border-warm-grey/40 bg-ivory/70 px-3 py-2"
      >
        <ToolbarButton
          label="Paragraph"
          active={editor?.isActive('paragraph')}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor?.isActive('heading', { level: 2 })}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={editor?.isActive('heading', { level: 3 })}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 4"
          active={editor?.isActive('heading', { level: 4 })}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()}
        >
          <Heading4 className="w-3.5 h-3.5" />
        </ToolbarButton>

        <span className="w-px h-5 bg-warm-grey/40 mx-1" aria-hidden="true" />

        <ToolbarButton
          label="Bold"
          active={editor?.isActive('bold')}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor?.isActive('italic')}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>

        <span className="w-px h-5 bg-warm-grey/40 mx-1" aria-hidden="true" />

        <ToolbarButton
          label="Bulleted list"
          active={editor?.isActive('bulletList')}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor?.isActive('orderedList')}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Blockquote"
          active={editor?.isActive('blockquote')}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Horizontal rule"
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="w-3.5 h-3.5" />
        </ToolbarButton>

        <span className="w-px h-5 bg-warm-grey/40 mx-1" aria-hidden="true" />

        <ToolbarButton
          label="Align left"
          active={editor?.isActive({ textAlign: 'left' })}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          active={editor?.isActive({ textAlign: 'center' })}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Align right"
          active={editor?.isActive({ textAlign: 'right' })}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="w-3.5 h-3.5" />
        </ToolbarButton>

        <span className="w-px h-5 bg-warm-grey/40 mx-1" aria-hidden="true" />

        <ToolbarButton
          label="Insert link"
          active={activePopover === 'link' || editor?.isActive('link')}
          disabled={disabled || !editor}
          onClick={() => {
            setControlError(null);
            setLinkInput((editor?.getAttributes('link').href as string) || '');
            setActivePopover((cur) => (cur === 'link' ? 'none' : 'link'));
          }}
        >
          <Link2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        {editor?.isActive('link') && (
          <ToolbarButton
            label="Remove link"
            disabled={disabled}
            onClick={() => editor.chain().focus().unsetLink().run()}
          >
            <Unlink className="w-3.5 h-3.5" />
          </ToolbarButton>
        )}

        <ToolbarButton
          label="Insert editorial image"
          active={activePopover === 'image'}
          disabled={disabled || !editor}
          onClick={() => {
            setControlError(null);
            setActivePopover((cur) => (cur === 'image' ? 'none' : 'image'));
          }}
        >
          <ImagePlus className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Controlled Link Popover */}
      {activePopover === 'link' && !disabled && (
        <div className="border-b border-warm-grey/40 bg-ivory/40 px-4 py-3 flex flex-wrap items-center gap-2">
          <label htmlFor="cms-editor-link-input" className="sr-only">
            Link URL
          </label>
          <input
            id="cms-editor-link-input"
            type="url"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://... or /insights/..."
            className="flex-1 min-w-[220px] border border-warm-grey/60 bg-white px-3 py-1.5 text-xs text-charcoal"
          />
          <button
            type="button"
            onClick={handleApplyLink}
            className="px-3 py-1.5 text-xs bg-charcoal text-ivory uppercase tracking-wider"
          >
            Apply Link
          </button>
        </div>
      )}

      {/* Controlled Editorial Media Popover */}
      {activePopover === 'image' && !disabled && (
        <div className="border-b border-warm-grey/40 bg-ivory/40 px-4 py-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="cms-editor-img-alt"
                className="block font-mono text-[11px] uppercase tracking-wider text-charcoal/70 mb-1"
              >
                Required Alt Text
              </label>
              <input
                id="cms-editor-img-alt"
                type="text"
                value={imageAltInput}
                onChange={(e) => setImageAltInput(e.target.value)}
                placeholder="Describe architectural finish or substrate"
                className="w-full border border-warm-grey/60 bg-white px-3 py-1.5 text-xs text-charcoal"
              />
            </div>
            <div>
              <label
                htmlFor="cms-editor-img-url"
                className="block font-mono text-[11px] uppercase tracking-wider text-charcoal/70 mb-1"
              >
                Approved Media URL
              </label>
              <input
                id="cms-editor-img-url"
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="/api/editorial-media/<uuid> or https://images.unsplash.com/..."
                className="w-full border border-warm-grey/60 bg-white px-3 py-1.5 text-xs text-charcoal"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleInsertImageByUrl}
              className="px-3 py-1.5 text-xs bg-charcoal text-ivory uppercase tracking-wider cursor-pointer"
            >
              Insert Image URL
            </button>

            {onOpenMediaLibrary && (
              <button
                type="button"
                onClick={() => {
                  setActivePopover('none');
                  onOpenMediaLibrary();
                }}
                className="px-3 py-1.5 text-xs border border-bronze text-bronze hover:bg-bronze hover:text-ivory transition-colors uppercase tracking-wider cursor-pointer"
              >
                Choose from Media Library
              </button>
            )}

            {onUploadImage && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs border border-charcoal text-charcoal uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  {isUploadingImage ? 'Uploading...' : 'Upload JPEG/PNG/WebP'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {controlError && (
        <p role="alert" className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">
          {controlError}
        </p>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
