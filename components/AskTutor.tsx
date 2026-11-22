'use client';

import React, { useRef, useState } from 'react';

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  model?: string;
}

interface AskTutorProps {
  assessmentContext?: string;
  compact?: boolean;
}

const DEFAULT_STARTERS = [
  'Give me a high-yield revision strategy for 51st Special BCS Medicine & Surgery.',
  'How should I avoid -0.50 negative marking traps in the 200-MCQ exam?',
  'বাংলাদেশ ও আন্তর্জাতিক বিষয়াবলি দ্রুত মনে রাখার কৌশল বলুন।',
  'Explain the key differences between nephritic and nephrotic syndrome for MBBS MCQ.',
];

function renderFormattedText(text: string) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }

        // Render inline **bold** segments safely without dangerouslySetInnerHTML
        const renderInline = (raw: string) => {
          const parts = raw.split(/(\*\*[^*]+\*\*)/g);
          return parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
              return (
                <strong key={idx} className="font-semibold text-slate-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <React.Fragment key={idx}>{part}</React.Fragment>;
          });
        };

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={i} className="pt-1 text-sm font-bold text-emerald-900">
              {renderInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={i} className="pt-1.5 text-sm font-extrabold text-slate-900">
              {renderInline(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
              <span>{renderInline(trimmed.slice(2))}</span>
            </div>
          );
        }
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

export function AskTutor({ assessmentContext, compact = false }: AskTutorProps) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interactionId, setInteractionId] = useState<string | undefined>(undefined);
  const [activeModel, setActiveModel] = useState<string | undefined>(undefined);
  const listRef = useRef<HTMLDivElement | null>(null);

  const starters = assessmentContext
    ? [
        'Based on my self-assessment results, give me a personalized 7-day study completion plan.',
        'Which weak subjects should I tackle first to maximize my 51st Special BCS score?',
        'বাংলায় আমার দুর্বল বিষয়গুলো দ্রুত শেষ করার রুটিন তৈরি করে দিন।',
        DEFAULT_STARTERS[1],
      ]
    : DEFAULT_STARTERS;

  const sendMessage = async (promptText: string) => {
    const cleaned = promptText.trim();
    if (!cleaned || loading) return;

    setError(null);
    setInput('');
    const userMsg: TutorMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: cleaned,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });

    try {
      const res = await fetch('/api/tutor/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleaned,
          previousInteractionId: interactionId,
          preferredModel: activeModel,
          assessmentContext,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        interactionId?: string;
        model?: string;
        error?: string;
      };

      if (!res.ok || !data.reply) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      setInteractionId(data.interactionId);
      setActiveModel(data.model);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: data.reply!,
          model: data.model,
        },
      ]);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to contact BCS Tutor.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleReset = () => {
    setMessages([]);
    setInteractionId(undefined);
    setActiveModel(undefined);
    setError(null);
  };

  return (
    <div
      className={`flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm ${
        compact ? 'h-full' : ''
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/60 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-xs font-extrabold text-white shadow-xs">
            AI
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Ask BCS Tutor (Gemini AI)</h3>
            <p className="text-[11px] text-slate-500">
              51st Special BCS MBBS &amp; General Tutor · English &amp; বাংলা
              {assessmentContext ? ' · Connected to your Self-Assessment' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeModel && (
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 sm:inline-flex">
              {activeModel}
            </span>
          )}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              New Chat
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={listRef}
        className={`flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5 ${
          compact ? 'min-h-[260px]' : 'max-h-[460px] min-h-[240px]'
        }`}
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 text-xs leading-relaxed text-slate-700">
              Ask me anything about <strong>51st Special BCS (Assistant Surgeon — MBBS)</strong>:
              clinical medicine, surgery, pharmacology mnemonics, Bangla/English grammar, Bangladesh
              &amp; International Affairs, math shortcuts, or a personalized study roadmap.
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {starters.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-950 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-sm text-white shadow-xs'
                    : 'border border-slate-200/80 bg-slate-50/70 text-slate-800'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                ) : (
                  renderFormattedText(msg.text)
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              BCS Tutor is thinking…
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
            {error}
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-100 bg-slate-50/50 p-3 sm:p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="Ask BCS Tutor anything (English or বাংলা)… Press Enter to send"
            disabled={loading}
            className="min-h-[48px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex min-h-[46px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Ask Tutor'}
          </button>
        </div>
      </form>
    </div>
  );
}
