'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDuration, scoreAttempt } from '@/lib/examEngine';
import { AttemptRecord, ExamArea, ExamSession, Question, areaOfSubject } from '@/lib/types';
import { useAppContext } from './PuterProvider';

const LETTERS = ['A', 'B', 'C', 'D'];

interface ExamRunnerProps {
  session: ExamSession;
  bank: Question[];
  onSubmitted: (attempt: AttemptRecord) => void;
  onDiscard: () => void;
}

export function ExamRunner({ session, bank, onSubmitted, onDiscard }: ExamRunnerProps) {
  const { updateActiveSession, recordAttempt } = useAppContext();

  const byId = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paletteOpenMobile, setPaletteOpenMobile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(session.durationSeconds);

  const submittedRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const bankRef = useRef(bank);
  bankRef.current = bank;
  const onSubmittedRef = useRef(onSubmitted);
  onSubmittedRef.current = onSubmitted;

  const currentIdx = Math.min(
    Math.max(0, session.currentIndex),
    Math.max(0, session.questions.length - 1)
  );
  const answers = session.answers;
  const marked = session.marked;

  const submitNow = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const snap = sessionRef.current;
    const spent = Math.floor((Date.now() - snap.startedAt) / 1000);
    const record = scoreAttempt(snap, bankRef.current, spent);
    await recordAttempt(record);
    onSubmittedRef.current(record);
  }, [recordAttempt]);

  // Countdown tick + auto-submit on expiry (depends only on stable session timing fields)
  useEffect(() => {
    submittedRef.current = false;
    const computeRemaining = () =>
      Math.max(0, session.durationSeconds - Math.floor((Date.now() - session.startedAt) / 1000));

    const first = computeRemaining();
    setRemainingSeconds(first);
    if (first === 0) {
      void submitNow();
      return;
    }

    const id = window.setInterval(() => {
      const rem = computeRemaining();
      setRemainingSeconds(rem);
      if (rem === 0 && !submittedRef.current) {
        window.clearInterval(id);
        void submitNow();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [session.sessionId, session.durationSeconds, session.startedAt, submitNow]);

  // Section quick-jump markers
  const areaMarkers = useMemo(() => {
    const seen = new Map<ExamArea, { startIdx: number; count: number }>();
    session.questions.forEach((sq, idx) => {
      const q = byId.get(sq.id);
      if (!q) return;
      const area = areaOfSubject(q.subject);
      const existing = seen.get(area);
      if (!existing) {
        seen.set(area, { startIdx: idx, count: 1 });
      } else {
        existing.count += 1;
      }
    });
    return Array.from(seen.entries());
  }, [byId, session.questions]);

  const currentSQ = session.questions[currentIdx];
  const currentQ = currentSQ ? byId.get(currentSQ.id) : undefined;

  const answeredCount = useMemo(
    () => session.questions.filter((sq) => answers[sq.id] !== undefined).length,
    [answers, session.questions]
  );
  const markedCount = useMemo(
    () => session.questions.filter((sq) => marked[sq.id]).length,
    [marked, session.questions]
  );
  const unansweredCount = session.questions.length - answeredCount;

  if (!currentSQ || !currentQ) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-600">Loading exam questions…</p>
      </div>
    );
  }

  const chosenOriginalIdx = answers[currentQ.id];
  const isMarked = Boolean(marked[currentQ.id]);
  const lowTime = remainingSeconds <= 300;

  const goToQuestion = (idx: number) => {
    const clamped = Math.min(Math.max(0, idx), session.questions.length - 1);
    updateActiveSession((prev) =>
      prev && prev.currentIndex !== clamped ? { ...prev, currentIndex: clamped } : prev
    );
  };

  const selectOption = (originalOptionIdx: number) => {
    updateActiveSession((prev) =>
      prev
        ? { ...prev, answers: { ...prev.answers, [currentQ.id]: originalOptionIdx } }
        : prev
    );
  };

  const clearOption = () => {
    updateActiveSession((prev) => {
      if (!prev || prev.answers[currentQ.id] === undefined) return prev;
      const nextAnswers = { ...prev.answers };
      delete nextAnswers[currentQ.id];
      return { ...prev, answers: nextAnswers };
    });
  };

  const toggleMarked = () => {
    updateActiveSession((prev) =>
      prev
        ? { ...prev, marked: { ...prev.marked, [currentQ.id]: !prev.marked[currentQ.id] } }
        : prev
    );
  };

  const paletteGrid = (onPick?: () => void) => (
    <>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[11px] font-semibold">
        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-emerald-800">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
          Ans: {answeredCount}
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-amber-800">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Mark: {markedCount}
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-slate-700">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          Left: {unansweredCount}
        </div>
      </div>

      <div className="mt-3 grid max-h-[340px] grid-cols-5 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-8 lg:grid-cols-5">
        {session.questions.map((sq, idx) => {
          const isCurrent = idx === currentIdx;
          const isAns = answers[sq.id] !== undefined;
          const isMark = Boolean(marked[sq.id]);
          return (
            <button
              key={sq.id}
              type="button"
              onClick={() => {
                goToQuestion(idx);
                onPick?.();
              }}
              className={`relative h-9 rounded-lg text-xs font-semibold tabular-nums transition ${
                isCurrent
                  ? 'bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-1'
                  : isMark
                    ? 'border border-amber-300 bg-amber-100 text-amber-900'
                    : isAns
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {/* Exam Header Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
                {session.mode}
              </span>
              <span className="text-xs font-medium text-slate-500">
                +1.00 Correct · -0.50 Wrong · 0 Skip
              </span>
            </div>
            <h1 className="mt-1 truncate text-base font-bold text-slate-900 sm:text-lg">
              {session.title}
            </h1>
            {session.scaledNote && (
              <p className="mt-0.5 text-xs text-amber-700">{session.scaledNote}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2.5 sm:justify-end">
            <div
              className={`rounded-xl border px-3.5 py-1.5 text-left sm:text-right ${
                lowTime
                  ? 'border-rose-300 bg-rose-50 text-rose-800'
                  : 'border-slate-200 bg-slate-50 text-slate-900'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                Time Left
              </div>
              <div className="font-mono text-base font-extrabold tabular-nums leading-tight sm:text-lg">
                {formatDuration(remainingSeconds)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={submitting}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Exam'}
            </button>
          </div>
        </div>

        {/* Section Quick-Jump Pills (horizontally scrollable on mobile) */}
        {areaMarkers.length > 1 && (
          <div className="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 pt-3">
            <span className="shrink-0 text-xs font-semibold text-slate-500">Sections:</span>
            {areaMarkers.map(([area, info]) => {
              const currentArea = areaOfSubject(currentQ.subject);
              const isCurrent = currentArea === area;
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => goToQuestion(info.startIdx)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    isCurrent
                      ? 'bg-teal-700 text-white shadow-2xs'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {area} ({info.count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile Collapsible OMR Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm lg:hidden">
        <button
          type="button"
          onClick={() => setPaletteOpenMobile((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-800">
              OMR Palette
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              {answeredCount}/{session.questions.length} answered
            </span>
          </div>
          <span className="text-xs font-semibold text-teal-700">
            {paletteOpenMobile ? 'Hide Grid ▲' : 'Jump to Q# ▼'}
          </span>
        </button>

        {paletteOpenMobile && (
          <div className="mt-2 border-t border-slate-100 pt-2">
            {paletteGrid(() => setPaletteOpenMobile(false))}
          </div>
        )}
      </div>

      {/* Main Split: Question Card + Desktop OMR Palette */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Question Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold tabular-nums text-white">
                Q {currentIdx + 1} / {session.questions.length}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                {currentQ.part === 'Medical' ? `Medical · ${currentQ.subject}` : currentQ.subject}
              </span>
              {currentQ.topic && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {currentQ.topic}
                </span>
              )}
              <span className="text-xs text-slate-500">{currentQ.sourceExam}</span>
            </div>

            <button
              type="button"
              onClick={toggleMarked}
              className={`min-h-[34px] rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                isMarked
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {isMarked ? '★ Marked' : '☆ Mark Review'}
            </button>
          </div>

          <p className="mt-5 max-w-3xl text-base font-semibold leading-relaxed text-slate-900 sm:text-lg">
            {currentQ.question}
          </p>

          <div className="mt-5 max-w-3xl space-y-2.5">
            {currentSQ.order.map((origOptIdx, displayIdx) => {
              const optionText = currentQ.options[origOptIdx];
              const isSelected = chosenOriginalIdx === origOptIdx;
              return (
                <button
                  key={displayIdx}
                  type="button"
                  onClick={() => selectOption(origOptIdx)}
                  className={`flex min-h-[50px] w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/85 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-300 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {LETTERS[displayIdx]}
                  </span>
                  <span className="pt-0.5 text-sm font-medium leading-relaxed text-slate-900 sm:text-base">
                    {optionText}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom Controls */}
          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearOption}
                disabled={chosenOriginalIdx === undefined}
                className="min-h-[40px] rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear Choice (Avoid -0.50)
              </button>
              <button
                type="button"
                onClick={onDiscard}
                className="min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                Quit Exam
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <button
                type="button"
                onClick={() => goToQuestion(currentIdx - 1)}
                disabled={currentIdx === 0}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                ← Previous
              </button>
              {currentIdx < session.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goToQuestion(currentIdx + 1)}
                  className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-emerald-700 hover:to-teal-700"
                >
                  Review &amp; Submit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Desktop OMR Question Palette */}
        <aside className="hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm lg:block">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">OMR Question Palette</h2>
            <span className="text-xs font-semibold tabular-nums text-slate-500">
              {answeredCount}/{session.questions.length}
            </span>
          </div>
          {paletteGrid()}
        </aside>
      </div>

      {/* Submit Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Submit 51st BCS Mock Exam?</h3>
            <p className="mt-1 text-xs text-slate-500">
              Marking scheme: +1.00 for correct, -0.50 for wrong, 0 for unanswered.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 p-3">
                <div className="text-lg font-bold tabular-nums text-emerald-800">
                  {answeredCount}
                </div>
                <div className="text-[11px] font-medium text-emerald-700">Answered</div>
              </div>
              <div className="rounded-xl bg-slate-100 p-3">
                <div className="text-lg font-bold tabular-nums text-slate-800">
                  {unansweredCount}
                </div>
                <div className="text-[11px] font-medium text-slate-600">Unanswered</div>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <div className="text-lg font-bold tabular-nums text-amber-800">{markedCount}</div>
                <div className="text-[11px] font-medium text-amber-700">Marked</div>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="min-h-[42px] rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Continue Exam
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  void submitNow();
                }}
                disabled={submitting}
                className="min-h-[42px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
