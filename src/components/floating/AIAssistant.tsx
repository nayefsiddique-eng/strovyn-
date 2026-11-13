'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { X, Send, MessageCircle, FileText } from 'lucide-react';
import { WHATSAPP_DETAILS } from '@/lib/constants';

export const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; notice?: string; showHandoff?: boolean }>>([
    {
      sender: 'assistant',
      text: "Hello, I'm VYN. Your guide to Strovyn's painting services, projects and enquiries across Adelaide.",
      showHandoff: true,
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e?: React.FormEvent, directPrompt?: string) => {
    if (e) e.preventDefault();
    const query = directPrompt || inputVal.trim();
    if (!query || loading) return;

    setInputVal('');
    setMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });

      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: data.message,
            notice: data.notice,
            showHandoff: true,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: "I'm here to assist with Strovyn's architectural finishes, surface preparation, and Adelaide on-site consultations. For direct scope scheduling, please connect with our team on WhatsApp.",
            showHandoff: true,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: "I'm available to help navigate Strovyn's services and project archives. Please connect directly via WhatsApp (0406 646 061) or submit an enquiry.",
          showHandoff: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* VYN Monogram Launcher Button (Bottom-Left) */}
      <aside aria-label="VYN Project Guide" className="fixed bottom-6 left-6 z-40 hidden sm:block font-sans">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="group h-12 px-4 bg-[#181917] hover:bg-black text-white border border-bronze/60 flex items-center gap-3 transition-all duration-300 shadow-2xl cursor-pointer"
          aria-label="VYN | Strovyn Project Guide"
        >
          {/* Custom Geometric V Monogram Icon */}
          <div className="w-6 h-6 bg-charcoal border border-bronze flex items-center justify-center font-serif text-xs font-bold text-bronze relative overflow-hidden">
            <span>V</span>
            <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-brand-red" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-mono text-xs uppercase tracking-widest font-bold text-white group-hover:text-bronze transition-colors">
              VYN
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-warm-grey-dark">
              Project Guide
            </span>
          </div>
        </button>
      </aside>

      {/* VYN Interactive Dialogue Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="VYN | Strovyn Project Guide"
          className="fixed bottom-20 left-6 z-50 w-[350px] sm:w-[390px] bg-[#1A1B19] text-white border border-warm-grey/30 shadow-2xl flex flex-col max-h-[540px] animate-in fade-in slide-in-from-bottom-3 font-sans"
        >
          {/* Branded Header */}
          <div className="p-4 border-b border-warm-grey/20 flex items-center justify-between bg-[#141513]">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-charcoal border border-bronze flex items-center justify-center font-serif text-sm font-bold text-bronze relative">
                <span>V</span>
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-brand-red" />
              </div>
              <div>
                <span className="font-mono text-xs uppercase tracking-widest font-bold text-white block">
                  VYN | Strovyn Project Guide
                </span>
                <span className="text-[10px] text-warm-grey-dark font-mono block">
                  Adelaide Architectural Consultation
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-warm-grey hover:text-white transition-colors cursor-pointer p-1"
              aria-label="Close assistant"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick Action Chips */}
          <div className="p-3 bg-[#161715] border-b border-white/10 flex flex-wrap gap-1.5">
            {[
              { label: 'Explore Services', query: 'What painting and architectural finishing services does Strovyn offer?' },
              { label: 'View Projects', query: 'Show me Strovyn’s completed architectural projects in Adelaide.' },
              { label: 'Request a Quote', query: 'How does the Strovyn on-site consultation and quote process work?' },
              { label: 'Contact Strovyn', query: 'What is the WhatsApp number and contact info for Strovyn Adelaide?' },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleSend(undefined, chip.query)}
                className="text-[10px] font-mono uppercase tracking-wider bg-white/5 hover:bg-bronze hover:text-white border border-white/10 px-2 py-1 transition-colors cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Message Stream */}
          <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs font-sans">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`p-3 max-w-[85%] leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-bronze text-white'
                      : 'bg-[#222420] text-warm-grey-light border border-white/10'
                  }`}
                >
                  <p>{m.text}</p>

                  {/* Informational Scope Note */}
                  {m.notice && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-warm-grey-dark italic">
                      {m.notice}
                    </div>
                  )}

                  {/* Direct Contact Handoffs */}
                  {m.showHandoff && m.sender === 'assistant' && (
                    <div className="mt-3 pt-2 border-t border-white/15 flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider">
                      <a
                        href={`${WHATSAPP_DETAILS.chatUrl}?text=${WHATSAPP_DETAILS.defaultEnquiryMessage}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-emerald-800/80 hover:bg-emerald-700 text-white px-2.5 py-1 border border-emerald-600/40"
                      >
                        <MessageCircle size={12} />
                        <span>WhatsApp Chat</span>
                      </a>
                      <Link
                        href="/contact"
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 border border-white/20"
                      >
                        <FileText size={12} />
                        <span>Request a Quote</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-[11px] font-mono text-bronze animate-pulse">
                <span>VYN is consulting architectural records...</span>
              </div>
            )}
          </div>

          {/* User Input Field */}
          <form onSubmit={(e) => handleSend(e)} className="p-3 border-t border-warm-grey/20 bg-[#141513] flex gap-2">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Ask about painting services, prep, or quotes..."
              className="flex-1 bg-[#1F201D] border border-white/15 px-3 py-2 text-xs text-white placeholder-warm-grey-dark focus:outline-none focus:border-bronze"
            />
            <button
              type="submit"
              disabled={loading || !inputVal.trim()}
              className="px-3 bg-bronze hover:bg-bronze-hover disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Send inquiry"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
