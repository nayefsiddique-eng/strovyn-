'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Send, MessageCircle, FileText, RotateCcw } from 'lucide-react';
import { WHATSAPP_DETAILS } from '@/lib/constants';
import { StroLogo } from './StroLogo';

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  showHandoff?: boolean;
  isError?: boolean;
}

const INITIAL_GREETING: ChatMessage = {
  sender: 'assistant',
  text: "Welcome to Strovyn. I'm STRO, your digital assistant. I can help you explore our painting services, understand finishes and get your project enquiry started.",
  showHandoff: false,
};

const SUGGESTED_ACTIONS = [
  {
    label: 'Explore Painting Services',
    query: 'What painting services does Strovyn Painting Co. offer?',
  },
  {
    label: 'Understand Paint Finishes',
    query: 'How should I choose between paint finishes and sheen levels?',
  },
  {
    label: 'Request a Quote',
    query: 'I would like to start a quote enquiry for my project.',
  },
  {
    label: 'Contact Strovyn',
    query: 'How can I contact Strovyn directly in Adelaide?',
  },
];

export const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState<'Digital Assistant' | 'Live AI Connected' | 'Offline Fallback'>('Digital Assistant');

  const shouldReduceMotion = useReducedMotion();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [messages, loading, isOpen, shouldReduceMotion]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const handleReset = () => {
    if (loading) return;
    setMessages([INITIAL_GREETING]);
    setStatusLabel('Digital Assistant');
    inputRef.current?.focus();
  };

  const handleSend = async (e?: React.FormEvent, directPrompt?: string) => {
    if (e) e.preventDefault();
    const query = (directPrompt ?? inputVal).trim();
    if (!query || loading) return;

    if (!directPrompt) setInputVal('');

    // Build last 6 turns for multi-turn continuity (excluding initial greeting)
    const historyPayload = messages
      .slice(1)
      .slice(-6)
      .map((m) => ({
        role: m.sender,
        content: m.text.slice(0, 1000),
      }));

    setMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: query,
          history: historyPayload,
        }),
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (res.ok && data.success && data.message) {
        setStatusLabel(data.connected ? 'Live AI Connected' : 'Digital Assistant');
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: data.message,
            showHandoff: true,
          },
        ]);
      } else {
        setStatusLabel('Offline Fallback');
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text:
              data?.error ||
              'STRO is temporarily unable to process that request. You can submit your project details via /contact or message our Adelaide team on WhatsApp (+61 406 646 061).',
            showHandoff: true,
            isError: true,
          },
        ]);
      }
    } catch {
      clearTimeout(timeoutId);
      setStatusLabel('Offline Fallback');
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Connection was interrupted. You can try again, or reach our Adelaide team directly via WhatsApp (+61 406 646 061) or the quote form (/contact).',
          showHandoff: true,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const whatsappHref = `${WHATSAPP_DETAILS.chatUrl}?text=${WHATSAPP_DETAILS.defaultEnquiryMessage}`;

  return (
    <>
      {/* STRO Floating Launcher (Bottom-Left; sits above mobile contact bar on <768px) */}
      <aside
        aria-label="STRO Digital Assistant Launcher"
        className="fixed bottom-16 left-4 md:bottom-6 md:left-6 z-40 font-sans"
      >
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls="stro-assistant-dialog"
          aria-label={isOpen ? 'Close STRO assistant' : 'Open STRO assistant'}
          className="group h-12 px-3.5 bg-ivory-light dark:bg-[#1E1F1D] hover:bg-white dark:hover:bg-[#262724] text-charcoal dark:text-[#F4F1EA] border border-warm-grey/70 dark:border-white/20 flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze focus-visible:ring-offset-2"
        >
          <div className="w-7 h-7 bg-ivory dark:bg-[#141513] border border-warm-grey/50 dark:border-white/15 flex items-center justify-center shrink-0">
            <StroLogo size={20} className="text-charcoal dark:text-[#F4F1EA]" />
          </div>
          <div className="flex flex-col text-left leading-tight">
            <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-charcoal dark:text-[#F4F1EA] group-hover:text-bronze dark:group-hover:text-[#C9B28F] transition-colors">
              STRO
            </span>
            <span className="text-[10px] font-sans text-warm-grey-dark dark:text-[#B5B2AA] hidden sm:block">
              Digital Assistant
            </span>
          </div>
        </button>
      </aside>

      {/* STRO Conversational Dialog */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="stro-assistant-dialog"
            role="dialog"
            aria-modal="false"
            aria-label="STRO — Strovyn Digital Assistant"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: shouldReduceMotion ? 0.1 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-32 left-4 md:bottom-21 md:left-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] max-h-[min(560px,calc(100dvh-9rem))] md:max-h-[min(580px,calc(100dvh-7rem))] bg-ivory-light dark:bg-[#1A1B19] text-charcoal dark:text-[#F4F1EA] border border-warm-grey/70 dark:border-white/20 shadow-2xl flex flex-col font-sans overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-warm-grey/40 dark:border-white/15 flex items-center justify-between bg-white dark:bg-[#141513] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-ivory dark:bg-[#20211F] border border-warm-grey/50 dark:border-white/15 flex items-center justify-center shrink-0">
                  <StroLogo size={22} className="text-charcoal dark:text-[#F4F1EA]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-[0.22em] font-bold text-charcoal dark:text-white">
                      STRO
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-warm-grey-dark dark:text-[#B5B2AA]">
                      <span
                        className={`w-1.5 h-1.5 rounded-full inline-block ${
                          statusLabel === 'Offline Fallback'
                            ? 'bg-amber-600 dark:bg-amber-400'
                            : 'bg-bronze dark:bg-[#C9B28F]'
                        }`}
                        aria-hidden="true"
                      />
                      <span>{statusLabel}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-warm-grey-dark dark:text-[#B5B2AA] truncate">
                    Your guide to better finishes.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 1 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={loading}
                    title="New conversation"
                    aria-label="Reset conversation"
                    className="p-1.5 text-warm-grey-dark dark:text-[#B5B2AA] hover:text-charcoal dark:hover:text-white transition-colors cursor-pointer disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    launcherRef.current?.focus();
                  }}
                  aria-label="Close STRO assistant"
                  className="p-1.5 text-warm-grey-dark dark:text-[#B5B2AA] hover:text-charcoal dark:hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Suggested Actions Bar */}
            <div className="px-3 py-2.5 bg-ivory dark:bg-[#161715] border-b border-warm-grey/30 dark:border-white/10 flex flex-wrap gap-1.5 shrink-0">
              {SUGGESTED_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSend(undefined, action.query)}
                  className="text-[10px] font-mono uppercase tracking-[0.08em] bg-white dark:bg-[#242523] hover:bg-bronze dark:hover:bg-[#7E6340] text-charcoal dark:text-[#F4F1EA] hover:text-white border border-warm-grey/50 dark:border-white/15 px-2.5 py-1 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
                >
                  {action.label}
                </button>
              ))}
            </div>

            {/* Message Stream */}
            <div
              id="ai-assistant-messages"
              className="p-4 flex-1 overflow-y-auto space-y-3.5 text-xs sm:text-[13px] leading-relaxed"
              aria-live="polite"
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`p-3 max-w-[88%] ${
                      m.sender === 'user'
                        ? 'bg-charcoal dark:bg-[#F4F1EA] text-white dark:text-charcoal'
                        : m.isError
                        ? 'bg-rose-50 dark:bg-rose-950/30 text-charcoal dark:text-[#F4F1EA] border border-rose-300 dark:border-rose-700/50'
                        : 'bg-white dark:bg-[#242523] text-charcoal dark:text-[#F4F1EA] border border-warm-grey/40 dark:border-white/10'
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>

                    {m.showHandoff && m.sender === 'assistant' && (
                      <div className="mt-3 pt-2.5 border-t border-warm-grey/30 dark:border-white/15 flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider">
                        <Link
                          href="/contact"
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1.5 bg-charcoal dark:bg-[#F4F1EA] hover:bg-black dark:hover:bg-white text-white dark:text-charcoal px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
                        >
                          <FileText size={12} aria-hidden="true" />
                          <span>Request a Quote</span>
                        </Link>
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-[#1B7A43] hover:bg-[#156336] text-white px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
                        >
                          <MessageCircle size={12} aria-hidden="true" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-start">
                  <div className="px-3 py-2.5 bg-white dark:bg-[#242523] border border-warm-grey/40 dark:border-white/10 text-[11px] font-mono text-warm-grey-dark dark:text-[#B5B2AA]">
                    STRO is preparing a response...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => handleSend(e)}
              className="p-3 border-t border-warm-grey/40 dark:border-white/15 bg-white dark:bg-[#141513] flex gap-2 shrink-0"
            >
              <label htmlFor="stro-assistant-input" className="sr-only">
                Ask STRO a question
              </label>
              <input
                ref={inputRef}
                id="stro-assistant-input"
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={loading}
                placeholder="Ask about services, finishes, or your project..."
                className="flex-1 min-w-0 bg-ivory-light dark:bg-[#242523] border border-warm-grey/60 dark:border-white/20 px-3 py-2 text-xs text-charcoal dark:text-white focus:outline-none focus:border-bronze dark:focus:border-[#C9B28F] disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !inputVal.trim()}
                className="px-3.5 bg-bronze hover:bg-bronze-hover disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
                aria-label="Send message to STRO"
              >
                <Send size={14} aria-hidden="true" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIAssistant;
