'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/components/PuterProvider';
import { formatDuration, formatScore } from '@/lib/examEngine';
import { SECONDS_PER_QUESTION } from '@/lib/types';

const CUSTOM_PACK_NAME = 'Custom Questions Part 1';
const LETTERS = ['A', 'B', 'C', 'D'];

export default function CustomQuestionsPart1Page() {
  const router = useRouter();
  const { bank, bankLoading, attempts, activeSession, startCustomPractice } = useAppContext();

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [shuffleOrder, setShuffleOrder] = useState<boolean>(true);
  const [studyTopicFilter, setStudyTopicFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [showAnswers, setShowAnswers] = useState<boolean>(true);

  const packQuestions = useMemo(
    () => bank.filter((q) => q.customPack === CUSTOM_PACK_NAME),
    [bank]
  );

  const topicGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of packQuestions) {
      const t = q.topic?.trim() || 'সাধারণ আন্তর্জাতিক বিষয়াবলি';
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([topic, count]) => ({ topic, count }));
  }, [packQuestions]);

  const activeExamPool = useMemo(() => {
    if (selectedTopics.length === 0) return packQuestions;
    const allowed = new Set(selectedTopics);
    return packQuestions.filter((q) => allowed.has(q.topic?.trim() || 'সাধারণ আন্তর্জাতিক বিষয়াবলি'));
  }, [packQuestions, selectedTopics]);

  const customAttempts = useMemo(
    () => attempts.filter((a) => a.mode === 'Custom Pack'),
    [attempts]
  );

  const studyQuestions = useMemo(() => {
    const qLower = search.trim().toLowerCase();
    return packQuestions.filter((item) => {
      const topicName = item.topic?.trim() || 'সাধারণ আন্তর্জাতিক বিষয়াবলি';
      if (studyTopicFilter !== 'ALL' && topicName !== studyTopicFilter) return false;
      if (qLower) {
        const hay = `${item.question} ${item.options.join(' ')} ${topicName} ${item.explanation}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
  }, [packQuestions, studyTopicFilter, search]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const launchExam = (count: number, customTitle?: string, poolOverride = activeExamPool) => {
    if (poolOverride.length === 0) return;
    const actualCount = Math.min(count, poolOverride.length);
    const title =
      customTitle ??
      (selectedTopics.length === 0
        ? `Custom Part 1 Mock (${actualCount} MCQs)`
        : selectedTopics.length === 1
          ? `Custom Part 1 · ${selectedTopics[0]} (${actualCount} MCQs)`
          : `Custom Part 1 · ${selectedTopics.length} Topics (${actualCount} MCQs)`);
    const sess = startCustomPractice(poolOverride, actualCount, title, shuffleOrder);
    if (sess) router.push('/exam/');
  };

  if (bankLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Loading Custom Questions Part 1…
      </div>
    );
  }

  const fullMinutes = Math.max(1, Math.round((activeExamPool.length * SECONDS_PER_QUESTION) / 60));

  return (
    <div className="space-y-6">
      {/* Active Session Banner */}
      {activeSession && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 to-orange-50/70 p-4 shadow-sm sm:flex-row sm:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Exam In Progress
            </div>
            <div className="mt-0.5 text-sm font-bold text-amber-950">{activeSession.title}</div>
            <div className="text-xs text-amber-800">
              {Object.keys(activeSession.answers).length} of {activeSession.questions.length} answered
            </div>
          </div>
          <Link
            href="/exam/"
            className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-amber-800"
          >
            Resume Active Exam →
          </Link>
        </div>
      )}

      {/* Hero & Dedicated Exam Launcher */}
      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/60 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white px-3 py-0.5 text-xs font-semibold text-teal-800">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
            Custom Questions Part 1 · বাংলা সংস্করণ
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600">
            Genesis 51st Special BCS Digest (pp. 459–468)
          </span>
        </div>

        <h1 className="mt-2.5 text-2xl font-bold text-slate-900">
          Custom Questions Part 1 ({packQuestions.length} Bengali MCQs)
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
          Dedicated exam &amp; study workspace for the newly added Bengali{' '}
          <strong>International Affairs</strong> question set. Take the full {packQuestions.length}-MCQ
          mock test or target specific chapters below with standard{' '}
          <strong className="text-emerald-700">+1.00</strong> /{' '}
          <strong className="text-rose-700">-0.50</strong> BCS marking.
        </p>

        {/* Order Toggle */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Question Order:</span>
          <button
            type="button"
            onClick={() => setShuffleOrder(true)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              shuffleOrder
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Shuffled (Unseen First)
          </button>
          <button
            type="button"
            onClick={() => setShuffleOrder(false)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              !shuffleOrder
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Digest Sequence (1 → {activeExamPool.length})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={activeExamPool.length === 0}
            onClick={() => launchExam(activeExamPool.length)}
            className="min-h-[46px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-xs transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
          >
            {selectedTopics.length === 0
              ? `Start Full ${activeExamPool.length}-MCQ Exam (~${fullMinutes} Min)`
              : `Start Selected Topics (${activeExamPool.length} MCQs · ~${fullMinutes} Min)`}
          </button>

          {[20, 30, 50].map((preset) => {
            if (activeExamPool.length <= preset) return null;
            const mins = Math.max(1, Math.round((preset * SECONDS_PER_QUESTION) / 60));
            return (
              <button
                key={preset}
                type="button"
                onClick={() => launchExam(preset)}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-2xs transition hover:border-teal-300 hover:bg-teal-50/50"
              >
                {preset} MCQs ({mins} Min)
              </button>
            );
          })}

          {selectedTopics.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTopics([])}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Clear Topic Selection ({selectedTopics.length})
            </button>
          )}
        </div>
      </section>

      {/* Bengali Topic-Wise Drills */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Practice by Topic ({topicGroups.length} Topics)
            </h2>
            <p className="text-xs text-slate-500">
              Click topics to combine them for a custom exam above, or launch any single topic directly.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Selected pool: {activeExamPool.length} MCQs
          </span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {topicGroups.map(({ topic, count }) => {
            const isSelected = selectedTopics.includes(topic);
            return (
              <div
                key={topic}
                className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition ${
                  isSelected
                    ? 'border-teal-500 bg-teal-50/70 ring-1 ring-teal-500'
                    : 'border-slate-200/80 bg-slate-50/60 hover:border-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                      isSelected
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300 bg-white text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{topic}</div>
                    <div className="text-[11px] text-slate-500">{count} MCQs</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const pool = packQuestions.filter(
                      (q) => (q.topic?.trim() || 'সাধারণ আন্তর্জাতিক বিষয়াবলি') === topic
                    );
                    launchExam(pool.length, `Custom Part 1 · ${topic} (${pool.length} MCQs)`, pool);
                  }}
                  className="shrink-0 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  Exam →
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Attempts on Custom Part 1 */}
      {customAttempts.length > 0 && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Recent Custom Part 1 Attempts ({customAttempts.length})
            </h2>
            <Link
              href="/history/"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Open Full History →
            </Link>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {customAttempts.slice(0, 6).map((a) => (
              <div
                key={a.attemptId}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5"
              >
                <div className="truncate text-xs font-bold text-slate-900">
                  {a.title || 'Custom Part 1'}
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-lg font-extrabold text-emerald-700">
                    {formatScore(a.netScore)} / {a.maxScore}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formatDuration(a.timeSpentSeconds)}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-600">
                  ✓ {a.correctCount} · ✗ {a.wrongCount} · — {a.unansweredCount}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Study & Revision List */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Study &amp; Revise All {packQuestions.length} Bengali MCQs
            </h2>
            <p className="text-xs text-slate-500">
              Showing {studyQuestions.length} of {packQuestions.length} questions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by topic"
              value={studyTopicFilter}
              onChange={(e) => setStudyTopicFilter(e.target.value)}
              className="min-h-[38px] rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Topics ({packQuestions.length})</option>
              {topicGroups.map(({ topic, count }) => (
                <option key={topic} value={topic}>
                  {topic} ({count})
                </option>
              ))}
            </select>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="প্রশ্ন বা টপিক খুঁজুন…"
              className="min-h-[38px] w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 sm:w-56"
            />

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={showAnswers}
                onChange={(e) => setShowAnswers(e.target.checked)}
                className="rounded border-slate-300"
              />
              Show answers &amp; explanations
            </label>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {studyQuestions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              No questions match this search.
            </div>
          ) : (
            studyQuestions.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">
                    #{idx + 1}
                  </span>
                  {item.topic && (
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800">
                      {item.topic}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500">{item.sourceExam}</span>
                </div>

                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-900">
                  {item.question}
                </p>

                <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                  {item.options.map((opt, i) => {
                    const isAns = showAnswers && i === item.correctIndex;
                    return (
                      <div
                        key={i}
                        className={`rounded-lg border px-3 py-1.5 text-xs ${
                          isAns
                            ? 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-950'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <strong className="mr-1">{LETTERS[i]}.</strong>
                        {opt}
                      </div>
                    );
                  })}
                </div>

                {showAnswers && item.explanation && (
                  <p className="mt-2.5 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700">
                    <strong className="text-slate-800">ব্যাখ্যা: </strong>
                    {item.explanation}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

