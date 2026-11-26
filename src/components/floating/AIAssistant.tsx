'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  Paintbrush,
  Palette,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { WHATSAPP_DETAILS } from '@/lib/constants';
import { StroLogo } from './StroLogo';

interface ActionChip {
  type: 'open_quote_builder' | 'link' | 'whatsapp';
  label: string;
  href?: string;
  prefillService?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionChip[];
  isError?: boolean;
  retryPrompt?: string;
}

interface QuoteDraft {
  serviceRequired: string;
  projectLocation: string;
  scopeSummary: string;
  fullName: string;
  email: string;
  phone: string;
  preferredContact: 'email' | 'phone' | 'whatsapp';
}

const QUICK_PROMPTS = [
  {
    id: 'quote',
    label: 'Request a Quote',
    icon: ClipboardList,
    mode: 'quote_builder' as const,
    prompt: 'I would like to request a quote for my painting project.',
  },
  {
    id: 'finishes',
    label: 'Finishes & Sheen',
    icon: Paintbrush,
    mode: 'chat' as const,
    prompt: 'What paint finishes and sheen levels do you recommend for Adelaide homes?',
  },
  {
    id: 'visualiser',
    label: 'Wall Visualiser',
    icon: Palette,
    mode: 'chat' as const,
    prompt: 'How does the Wall Colour Visualiser work?',
  },
  {
    id: 'prep',
    label: 'Prep & Process',
    icon: ShieldCheck,
    mode: 'chat' as const,
    prompt: 'What surface preparation steps do you follow before painting?',
  },
];

const SERVICE_OPTIONS = [
  'Interior Precision Painting',
  'Exterior Cladding & Facade Protection',
  'Cabinet Refinishing & Spraying',
  'Woodwork & Architectural Trim',
  'Commercial & Heritage Painting',
];

const INITIAL_ASSISTANT_GREETING: ChatMessage = {
  role: 'assistant',
  content:
    'Welcome to Strovyn. I’m STRO, your AI assistant for finishes, colour guidance, surface preparation, and getting your project started.',
};

const INITIAL_QUOTE_DRAFT: QuoteDraft = {
  serviceRequired: 'Interior Precision Painting',
  projectLocation: '',
  scopeSummary: '',
  fullName: '',
  email: '',
  phone: '',
  preferredContact: 'email',
};

function createEphemeralSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `stro-${crypto.randomUUID().slice(0, 12)}`;
  }
  return `stro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * AIAssistant (STRO) — Redesigned Strovyn Digital Assistant & Guided Quote Handoff.
 * Coordinated cleanly in the bottom-right stack directly above the WhatsApp button
 * on tablet/desktop, and cleanly above the sticky action bar on phones (< 768px).
 */
export const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [panelView, setPanelView] = useState<'chat' | 'quote'>('chat');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_ASSISTANT_GREETING]);

  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>(INITIAL_QUOTE_DRAFT);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteReceipt, setQuoteReceipt] = useState<{
    id: string;
    notified: boolean;
  } | null>(null);

  const launcherBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<string>('');
  const chatSessionIdRef = useRef<string>('');

  const ensureChatSessionId = (): string => {
    if (!chatSessionIdRef.current) {
      chatSessionIdRef.current = createEphemeralSessionId();
    }
    return chatSessionIdRef.current;
  };

  // Auto-scroll newest reply into view (respecting reduced-motion)
  useEffect(() => {
    if (isOpen && panelView === 'chat') {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      messagesEndRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'end',
      });
    }
  }, [messages, loading, isOpen, panelView]);

  // Escape closes STRO and restores keyboard focus to launcher
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        requestAnimationFrame(() => launcherBtnRef.current?.focus());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const historyPayload = messages
      .filter((m) => !m.isError)
      .slice(-8)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);
    setPanelView('chat');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
          sessionId: ensureChatSessionId(),
        }),
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || typeof data.message !== 'string') {
        const errMsg =
          res.status === 429
            ? data.error || 'Too many requests right now. Please pause a moment and try again.'
            : data.error || 'STRO could not respond just now. You can retry or contact our Adelaide team on WhatsApp.';
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: errMsg,
            isError: true,
            retryPrompt: trimmed,
          },
        ]);
      } else {
        const responseActions = Array.isArray(data.actions)
          ? (data.actions as ActionChip[])
          : undefined;
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.message,
            actions: responseActions,
          },
        ]);
      }
    } catch {
      clearTimeout(timeoutId);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Unable to reach STRO due to a temporary network issue. Please retry below or message our team directly on WhatsApp (+61 406 646 061).',
          isError: true,
          retryPrompt: trimmed,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const openQuoteBuilder = (prefillService?: string) => {
    setQuoteError('');
    if (prefillService && SERVICE_OPTIONS.includes(prefillService)) {
      setQuoteDraft((prev) => ({ ...prev, serviceRequired: prefillService }));
    }
    setPanelView('quote');
  };

  const buildFullFormHref = (): string => {
    const params = new URLSearchParams();
    params.set('service', quoteDraft.serviceRequired);
    if (quoteDraft.projectLocation.trim()) {
      params.set('location', quoteDraft.projectLocation.trim());
    }
    if (quoteDraft.scopeSummary.trim()) {
      params.set('scope', quoteDraft.scopeSummary.trim());
    }
    if (quoteDraft.fullName.trim()) {
      params.set('name', quoteDraft.fullName.trim());
    }
    if (quoteDraft.email.trim()) {
      params.set('email', quoteDraft.email.trim());
    }
    if (quoteDraft.phone.trim()) {
      params.set('phone', quoteDraft.phone.trim());
    }
    return `/contact?${params.toString()}`;
  };

  const buildWhatsAppQuoteHref = (): string => {
    const lines = [
      'Hello Strovyn Painting Co., I would like to discuss a project enquiry from STRO:',
      `• Service: ${quoteDraft.serviceRequired}`,
      quoteDraft.projectLocation.trim()
        ? `• Suburb: ${quoteDraft.projectLocation.trim()}`
        : null,
      quoteDraft.scopeSummary.trim()
        ? `• Scope: ${quoteDraft.scopeSummary.trim()}`
        : null,
      quoteDraft.fullName.trim() ? `• Name: ${quoteDraft.fullName.trim()}` : null,
    ].filter(Boolean);
    return `${WHATSAPP_DETAILS.chatUrl}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quoteSubmitting) return;
    setQuoteError('');

    if (quoteDraft.fullName.trim().length < 2) {
      setQuoteError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!quoteDraft.email.includes('@')) {
      setQuoteError('Please enter a valid email address.');
      return;
    }
    if (quoteDraft.phone.trim().length < 6) {
      setQuoteError('Please enter a valid contact phone number.');
      return;
    }
    if (quoteDraft.scopeSummary.trim().length < 10) {
      setQuoteError('Please share a brief scope description (at least 10 characters).');
      return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    setQuoteSubmitting(true);
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          fullName: quoteDraft.fullName.trim(),
          email: quoteDraft.email.trim(),
          phone: quoteDraft.phone.trim(),
          projectLocation: quoteDraft.projectLocation.trim() || 'Greater Adelaide, SA',
          serviceRequired: quoteDraft.serviceRequired,
          description: quoteDraft.scopeSummary.trim(),
          preferredContact: quoteDraft.preferredContact,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.data?.id) {
        throw new Error(data.error || 'Unable to submit quote request right now.');
      }

      idempotencyKeyRef.current = '';
      setQuoteReceipt({
        id: String(data.data.id),
        notified: Boolean(data.data.notified),
      });
    } catch (err: unknown) {
      setQuoteError(
        err instanceof Error
          ? err.message
          : 'Connection error while submitting enquiry. Please try again or use WhatsApp.'
      );
    } finally {
      setQuoteSubmitting(false);
    }
  };

  const resetAssistant = () => {
    setMessages([INITIAL_ASSISTANT_GREETING]);
    setQuoteDraft(INITIAL_QUOTE_DRAFT);
    setQuoteReceipt(null);
    setQuoteError('');
    setPanelView('chat');
    idempotencyKeyRef.current = '';
    chatSessionIdRef.current = '';
  };

  const whatsappDirectHref = `${WHATSAPP_DETAILS.chatUrl}?text=${WHATSAPP_DETAILS.defaultEnquiryMessage}`;

  return (
    <>
      {/* Coordinated Bottom-Right Concierge Trigger (paired beside WhatsApp on md+, above mobile bar on < md) */}
      <div
        data-floating-stro="true"
        className="fixed right-3.5 bottom-[calc(4.45rem+env(safe-area-inset-bottom))] md:right-[76px] md:bottom-5 z-40 font-sans [perspective:1000px]"
      >
        <button
          ref={launcherBtnRef}
          type="button"
          onClick={() => {
            const next = !isOpen;
            setIsOpen(next);
            if (next) {
              setTimeout(() => inputRef.current?.focus(), 60);
            }
          }}
          aria-expanded={isOpen}
          aria-controls="stro-assistant-dialog"
          aria-label={
            isOpen
              ? 'STRO Finish Guide — Close Digital Assistant'
              : 'STRO Finish Guide — Open Digital Assistant'
          }
          className={`group flex items-center gap-2.5 h-11 px-3.5 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.32)] border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze ${
            isOpen
              ? 'bg-[#20211F] text-[#F4F1EA] border-bronze/70 dark:bg-[#F4F1EA] dark:text-[#20211F] dark:border-bronze'
              : 'bg-ivory-light/98 dark:bg-[#1E1F1D]/98 text-charcoal dark:text-[#F4F1EA] border-charcoal/25 dark:border-white/20 hover:border-bronze hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-8px_rgba(0,0,0,0.38)]'
          }`}
        >
          <StroLogo size={20} className="shrink-0" />
          <div className="flex flex-col items-start text-left leading-none">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]">
              STRO
            </span>{' '}
            <span
              className={`hidden sm:block text-[9.5px] font-sans tracking-wide mt-0.5 ${
                isOpen
                  ? 'text-[#B8B5AE] dark:text-[#20211F]/70'
                  : 'text-warm-grey-dark dark:text-[#B8B5AE]'
              }`}
            >
              Finish Guide
            </span>
          </div>
          <span
            className="w-1.5 h-1.5 bg-[#C41E1E] shrink-0"
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Redesigned Compact Architectural Dialogue Window */}
      {isOpen && (
        <div
          id="stro-assistant-dialog"
          role="dialog"
          aria-modal="false"
          aria-label="STRO — Strovyn's Digital Assistant"
          className="fixed left-3 right-3 bottom-[calc(7.6rem+env(safe-area-inset-bottom))] md:left-auto md:right-5 md:bottom-[124px] z-50 md:w-[392px] max-h-[min(560px,calc(100dvh-8.8rem))] md:max-h-[min(560px,calc(100dvh-148px))] bg-ivory-light dark:bg-[#191A18] border border-warm-grey/60 dark:border-white/20 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.42)] flex flex-col overflow-hidden text-charcoal dark:text-[#F4F1EA]"
        >
          {/* Architectural Header Plate (div rather than <header> so dark globals rules never override) */}
          <div className="shrink-0 bg-charcoal dark:bg-[#121311] text-[#F4F1EA] px-4 py-3 border-b border-white/12 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <StroLogo size={24} className="text-[#F4F1EA] shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-mono text-xs uppercase tracking-[0.22em] font-semibold text-white">
                    STRO
                  </span>
                  <span className="w-1.5 h-1.5 bg-[#C41E1E]" aria-hidden="true" />
                  <span className="font-sans text-[11px] font-medium tracking-wide text-[#C9B28F]">
                    Strovyn&apos;s AI Assistant
                  </span>
                </div>
                <p className="text-[11px] text-[#B8B5AE] font-light mt-0.5">
                  AI guide to finishes &amp; colour.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {(messages.length > 1 || panelView === 'quote') && (
                <button
                  type="button"
                  onClick={resetAssistant}
                  aria-label="Reset conversation"
                  title="New conversation"
                  className="p-1.5 text-[#B8B5AE] hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  requestAnimationFrame(() => launcherBtnRef.current?.focus());
                }}
                aria-label="Close STRO assistant"
                className="p-1.5 text-[#B8B5AE] hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Mode Tabs: Ask STRO / Quick Quote Brief */}
          <div className="shrink-0 grid grid-cols-2 border-b border-warm-grey/35 dark:border-white/10 bg-ivory dark:bg-[#1E1F1D] text-[11px] font-mono uppercase tracking-[0.14em]">
            <button
              type="button"
              onClick={() => setPanelView('chat')}
              className={`py-2 px-3 text-center transition-colors cursor-pointer border-b-2 ${
                panelView === 'chat'
                  ? 'border-[#C41E1E] text-charcoal dark:text-white font-semibold bg-ivory-light dark:bg-[#191A18]'
                  : 'border-transparent text-warm-grey-dark dark:text-[#A8A59E] hover:text-charcoal dark:hover:text-white'
              }`}
            >
              Ask STRO
            </button>
            <button
              type="button"
              onClick={() => setPanelView('quote')}
              className={`py-2 px-3 text-center transition-colors cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
                panelView === 'quote'
                  ? 'border-[#C41E1E] text-charcoal dark:text-white font-semibold bg-ivory-light dark:bg-[#191A18]'
                  : 'border-transparent text-warm-grey-dark dark:text-[#A8A59E] hover:text-charcoal dark:hover:text-white'
              }`}
            >
              <span>Quote Brief</span>
            </button>
          </div>

          {panelView === 'chat' ? (
            <>
              {/* Conversation Viewport */}
              <div className="flex-1 min-h-[210px] overflow-y-auto p-4 space-y-3.5 text-xs bg-ivory-light dark:bg-[#191A18]">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[90%] px-3.5 py-2.5 leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-charcoal text-white dark:bg-[#F4F1EA] dark:text-[#20211F]'
                          : msg.isError
                          ? 'bg-red-50 dark:bg-[#2A1616] border border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-200'
                          : 'bg-white dark:bg-[#222320] border border-warm-grey/40 dark:border-white/12 text-charcoal dark:text-[#F4F1EA] shadow-xs'
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.content}</p>

                      {msg.retryPrompt && (
                        <button
                          type="button"
                          onClick={() => sendMessage(msg.retryPrompt!)}
                          className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider underline hover:opacity-80 cursor-pointer"
                        >
                          <RefreshCw size={11} aria-hidden="true" />
                          <span>Retry Question</span>
                        </button>
                      )}
                    </div>

                    {/* Contextual Handoff Actions */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 max-w-[92%]">
                        {msg.actions.map((action, actionIdx) => {
                          if (action.type === 'open_quote_builder') {
                            return (
                              <button
                                key={actionIdx}
                                type="button"
                                onClick={() => openQuoteBuilder(action.prefillService)}
                                className="px-2.5 py-1.5 bg-bronze hover:bg-bronze-hover text-white font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <ClipboardList size={11} aria-hidden="true" />
                                <span>{action.label}</span>
                              </button>
                            );
                          }
                          if (action.type === 'whatsapp') {
                            return (
                              <a
                                key={actionIdx}
                                href={whatsappDirectHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 bg-[#1B7A43] hover:bg-[#156336] text-white font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1 transition-colors"
                              >
                                <MessageCircle size={11} aria-hidden="true" />
                                <span>{action.label}</span>
                              </a>
                            );
                          }
                          return (
                            <Link
                              key={actionIdx}
                              href={action.href || '/contact'}
                              onClick={() => setIsOpen(false)}
                              className="px-2.5 py-1.5 bg-ivory dark:bg-[#232421] border border-warm-grey/50 dark:border-white/20 hover:border-bronze text-charcoal dark:text-[#F4F1EA] font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1 transition-colors"
                            >
                              <span>{action.label}</span>
                              <ArrowUpRight size={11} aria-hidden="true" />
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {/* Initial Quick-Action Architectural Grid */}
                {messages.length === 1 && !loading && (
                  <div className="pt-1 space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-warm-grey-dark dark:text-[#B8B5AE] block">
                      Quick Actions
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {QUICK_PROMPTS.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              item.mode === 'quote_builder'
                                ? openQuoteBuilder()
                                : sendMessage(item.prompt)
                            }
                            className="flex items-center gap-2 p-2.5 text-left text-[11px] bg-white dark:bg-[#222320] border border-warm-grey/40 dark:border-white/12 hover:border-bronze dark:hover:border-bronze text-charcoal dark:text-[#F4F1EA] transition-colors cursor-pointer"
                          >
                            <Icon
                              size={13}
                              className="text-bronze dark:text-[#C9B28F] shrink-0"
                              aria-hidden="true"
                            />
                            <span className="font-medium leading-tight">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <a
                      href={whatsappDirectHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 bg-[#1B7A43]/10 dark:bg-[#1B7A43]/20 border border-[#1B7A43]/35 text-[#145D32] dark:text-[#8EE0AD] text-[11px] hover:bg-[#1B7A43]/15 transition-colors"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <MessageCircle size={13} aria-hidden="true" />
                        <span>Direct WhatsApp ({WHATSAPP_DETAILS.displayNumber})</span>
                      </span>
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </a>
                  </div>
                )}

                {loading && (
                  <div className="flex justify-start" role="status" aria-live="polite">
                    <div className="bg-white dark:bg-[#222320] border border-warm-grey/40 dark:border-white/12 px-3 py-2 text-warm-grey-dark dark:text-[#B8B5AE] font-mono text-[11px]">
                      STRO is thinking&hellip;
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="shrink-0 p-3 bg-white dark:bg-[#1E1F1D] border-t border-warm-grey/35 dark:border-white/12 flex items-center gap-2"
              >
                <label htmlFor="stro-chat-input" className="sr-only">
                  Ask STRO about finishes, preparation, visualiser or quotes
                </label>
                <input
                  ref={inputRef}
                  id="stro-chat-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={800}
                  placeholder="Ask about finishes, prep, visualiser or quotes..."
                  className="flex-1 min-w-0 text-xs px-3 py-2 border border-warm-grey/50 dark:border-white/15 bg-ivory-light dark:bg-[#141513] text-charcoal dark:text-[#F4F1EA] placeholder:text-warm-grey-dark dark:placeholder:text-[#8E8B82] focus:outline-none focus:border-bronze"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  aria-label="Send message to STRO"
                  className="p-2.5 bg-charcoal dark:bg-[#F4F1EA] hover:bg-bronze dark:hover:bg-bronze text-white dark:text-[#20211F] dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer shrink-0"
                >
                  <Send size={14} aria-hidden="true" />
                </button>
              </form>
            </>
          ) : (
            /* Guided Quote Intake & Verified Backend Handoff View */
            <div className="flex-1 min-h-[240px] overflow-y-auto p-4 bg-ivory-light dark:bg-[#191A18] text-xs space-y-3">
              {quoteReceipt ? (
                <div role="status" className="p-4 bg-white dark:bg-[#222320] border border-bronze/50 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] uppercase tracking-wider font-semibold">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>Quotation Request Logged</span>
                  </div>
                  <p className="text-charcoal/85 dark:text-[#F4F1EA]/85 leading-relaxed">
                    Your enquiry has been recorded in Strovyn&apos;s consultation queue (Ref:{' '}
                    <code className="font-mono text-[11px]">{quoteReceipt.id.slice(0, 8)}</code>).
                    {!quoteReceipt.notified &&
                      ' You can also share a copy directly on WhatsApp below for immediate attention.'}
                  </p>
                  <div className="flex flex-col gap-2 pt-1">
                    <a
                      href={buildWhatsAppQuoteHref()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 bg-[#1B7A43] hover:bg-[#156336] text-white font-mono text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <MessageCircle size={13} aria-hidden="true" />
                      <span>Follow Up on WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setQuoteReceipt(null);
                        setQuoteDraft(INITIAL_QUOTE_DRAFT);
                      }}
                      className="w-full py-2 px-3 border border-warm-grey/50 dark:border-white/20 text-charcoal dark:text-[#F4F1EA] font-mono text-[10px] uppercase tracking-wider hover:border-bronze transition-colors cursor-pointer"
                    >
                      Prepare Another Brief
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleQuoteSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-bronze dark:text-[#C9B28F] font-semibold">
                      Guided Project Intake
                    </p>
                    <p className="text-[11px] text-charcoal/75 dark:text-[#B8B5AE] leading-relaxed">
                      Submit your project brief directly or carry these details into the full{' '}
                      <code className="font-mono text-[10px]">/contact</code> portal (if attaching plans).
                    </p>
                  </div>

                  {quoteError && (
                    <div
                      role="alert"
                      className="p-2.5 bg-red-50 dark:bg-[#2A1616] border border-red-300 dark:border-red-700/60 text-[11px] text-red-900 dark:text-red-200"
                    >
                      {quoteError}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="stro-quote-service"
                      className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark dark:text-[#B8B5AE] mb-1"
                    >
                      Discipline Required
                    </label>
                    <select
                      id="stro-quote-service"
                      value={quoteDraft.serviceRequired}
                      onChange={(e) =>
                        setQuoteDraft((p) => ({ ...p, serviceRequired: e.target.value }))
                      }
                      className="w-full px-2.5 py-2 text-xs border border-warm-grey/50 dark:border-white/15 bg-white dark:bg-[#141513] text-charcoal dark:text-[#F4F1EA] focus:outline-none focus:border-bronze"
                    >
                      {SERVICE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="stro-quote-location"
                        className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark dark:text-[#B8B5AE] mb-1"
                      >
                        Adelaide Suburb
                      </label>
                      <input
                        id="stro-quote-location"
                        type="text"
                        placeholder="e.g. Norwood, Unley"
                        value={quoteDraft.projectLocation}
                        onChange={(e) =>
                          setQuoteDraft((p) => ({ ...p, projectLocation: e.target.value }))
                        }
                        className="w-full px-2.5 py-2 text-xs border border-warm-grey/50 dark:border-white/15 bg-white dark:bg-[#141513] text-charcoal dark:text-[#F4F1EA] focus:outline-none focus:border-bronze"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="stro-quote-name"
                        className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark dark:text-[#B8B5AE] mb-1"
                      >
                        Full Name *
                      </label>
                      <input
                        id="stro-quote-name"
                        type="text"
                        required
                        placeholder="Your name"
                        value={quoteDraft.fullName}
                        onChange={(e) =>
                          setQuoteDraft((p) => ({ ...p, fullName: e.target.value }))
                        }
                        className="w-full px-2.5 py-2 text-xs border border-warm-grey/50 dark:border-white/15 bg-white dark:bg-[#141513] text-charcoal dark:text-[#F4F1EA] focus:outline-none focus:border-bronze"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="stro-quote-email"
                        className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark dark:text-[#B8B5AE] mb-1"
                      >
                        Email *
                      </label>
                      <input
                        id="stro-quote-email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={quoteDraft.email}
                        onChange={(e) =>
                          setQuoteDraft((p) => ({ ...p, email: e.target.value }))
                        }
                        className="w-full px-2.5 py-2 text-xs border border-warm-grey/50 dark:border-white/15 bg-white dark:bg-[#141513] text-charcoal dark:text-[#F4F1EA] focus:outline-none focus:border-bronze"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="stro-quote-phone"
                        className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark dark:text-[#B8B5AE] mb-1"
                      >
                        Phone *
                      </label>
                      <input
                        id="stro-quote-phone"
                        type="tel"
                        required
                        placeholder="0400 000 000"
                        value={quoteDraft.phone}
                        onChange={(e) =>
                          setQuoteDraft((p) => ({ ...p, phone: e.target.value }))
                        }
                        className="w-full px-2.5 py-2 text-xs border border-warm-grey/50 dark:border-white/15 bg-white dark:bg-[#141513] text-charcoal dark:text-[#F4F1EA] focus:outline-none focus:border-bronze"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="stro-quote-scope"
                      className="block font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark dark:text-[#B8B5AE] mb-1"
                    >
                      Project Scope &amp; Rooms *
                    </label>
                    <textarea
                      id="stro-quote-scope"
                      rows={3}
                      required
                      placeholder="e.g. 3 bedrooms + hallway interior walls & ceilings, plaster repair around window reveals..."
                      value={quoteDraft.scopeSummary}
                      onChange={(e) =>
                        setQuoteDraft((p) => ({ ...p, scopeSummary: e.target.value }))
                      }
                      className="w-full px-2.5 py-2 text-xs border border-warm-grey/50 dark:border-white/15 bg-white dark:bg-[#141513] text-charcoal dark:text-[#F4F1EA] focus:outline-none focus:border-bronze"
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="submit"
                      disabled={quoteSubmitting}
                      className="w-full py-2.5 px-3 bg-bronze hover:bg-bronze-hover text-white font-mono text-[11px] uppercase tracking-[0.16em] font-medium transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {quoteSubmitting ? 'Submitting Brief...' : 'Submit Quick Enquiry'}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={buildFullFormHref()}
                        onClick={() => setIsOpen(false)}
                        className="py-2 px-2.5 border border-warm-grey/50 dark:border-white/20 text-center font-mono text-[10px] uppercase tracking-wider text-charcoal dark:text-[#F4F1EA] hover:border-bronze transition-colors flex items-center justify-center gap-1"
                      >
                        <span>Full Form + Files</span>
                        <ArrowUpRight size={11} aria-hidden="true" />
                      </Link>
                      <a
                        href={buildWhatsAppQuoteHref()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-2.5 bg-[#1B7A43] hover:bg-[#156336] text-white text-center font-mono text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                      >
                        <MessageCircle size={11} aria-hidden="true" />
                        <span>WhatsApp Brief</span>
                      </a>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AIAssistant;
