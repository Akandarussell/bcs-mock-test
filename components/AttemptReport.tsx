'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  aggregateByArea,
  formatDuration,
  formatScore,
  getModeBadgeColor,
} from '@/lib/examEngine';
import {
  AttemptRecord,
  EXAM_AREAS,
  MEDICAL_SUBJECTS,
  Question,
} from '@/lib/types';
import { useAppContext } from './PuterProvider';

type ReviewFilter = 'all' | 'wrong' | 'unanswered' | 'correct';

interface AttemptReportProps {
  attempt: AttemptRecord;
  bank: Question[];
  onCompareWith?: (attemptId: string) => void;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export function AttemptReport({ attempt, bank, onCompareWith }: AttemptReportProps) {
  const router = useRouter();
  const { startRetakeSame, startRetryWrong, startFullExam } = useAppContext();

  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');

  const byId = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank]);
  const areaStats = useMemo(
    () => aggregateByArea(attempt.subjectBreakdown),
    [attempt.subjectBreakdown]
  );

  const accuracyPct =
    attempt.totalAttempted > 0
      ? ((attempt.correctCount / attempt.totalAttempted) * 100).toFixed(1)
      : '0.0';

  const missedCount = attempt.wrongCount + attempt.unansweredCount;

  const medicalSubRows = useMemo(
    () =>
      MEDICAL_SUBJECTS.map((subj) => ({
        subject: subj,
        stats: attempt.subjectBreakdown[subj],
      })).filter((row) => row.stats && row.stats.total > 0),
    [attempt.subjectBreakdown]
  );

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    for (const qid of attempt.questionIds) {
      const q = byId.get(qid);
      if (q) set.add(q.subject);
    }
    return Array.from(set);
  }, [attempt.questionIds, byId]);

  const reviewItems = useMemo(() => {
    return attempt.questionIds
      .map((qid, idx) => {
        const q = byId.get(qid);
        if (!q) return null;
        const chosen = attempt.userAnswers[qid];
        const status: 'correct' | 'wrong' | 'unanswered' =
          chosen === undefined
            ? 'unanswered'
            : chosen === q.correctIndex
              ? 'correct'
              : 'wrong';
        return { index: idx + 1, question: q, chosen, status };
      })
      .filter((item): item is NonNullable<typeof item> => {
        if (!item) return false;
        if (reviewFilter !== 'all' && item.status !== reviewFilter) return false;
        if (subjectFilter !== 'ALL' && item.question.subject !== subjectFilter) return false;
        return true;
      });
  }, [attempt.questionIds, attempt.userAnswers, byId, reviewFilter, subjectFilter]);

  const handleRetakeSame = () => {
    const sess = startRetakeSame(attempt);
    if (sess) router.push('/exam/');
  };

  const handleRetryWrong = () => {
    const sess = startRetryWrong(attempt);
    if (sess) router.push('/exam/');
  };

  const handleStartFresh = () => {
    const sess = startFullExam();
    if (sess) router.push('/exam/');
  };

  return (
    <div className="space-y-6">
      {/* Header & Retake Actions */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getModeBadgeColor(
                  attempt.mode
                )}`}
              >
                {attempt.mode}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(attempt.timestamp).toLocaleString()}
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-bold text-slate-900">
              {attempt.title || '51st Special BCS Attempt'}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={handleRetakeSame}
              className="min-h-[40px] rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-900 transition hover:bg-sky-100"
            >
              Retake Exact Same
            </button>
            <button
              type="button"
              onClick={handleRetryWrong}
              disabled={missedCount === 0}
              className="min-h-[40px] rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Retry Missed ({missedCount})
            </button>
            {onCompareWith ? (
              <button
                type="button"
                onClick={() => onCompareWith(attempt.attemptId)}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Compare Attempt
              </button>
            ) : (
              <Link
                href={`/compare/?b=${encodeURIComponent(attempt.attemptId)}`}
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Compare Attempt
              </Link>
            )}
            <button
              type="button"
              onClick={handleStartFresh}
              className="min-h-[40px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:from-emerald-700 hover:to-teal-700"
            >
              Start Fresh Full 200
            </button>
          </div>
        </div>

        {/* Score Cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
            <div className="text-xs font-medium text-emerald-800">Net Score</div>
            <div className="mt-1 text-2xl font-bold text-emerald-950">
              {formatScore(attempt.netScore)}
              <span className="text-sm font-medium text-emerald-700">
                /{attempt.maxScore}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5">
            <div className="text-xs font-medium text-rose-800">Negative Deducted</div>
            <div className="mt-1 text-2xl font-bold text-rose-900">
              -{formatScore(attempt.negativeMarks)}
            </div>
            <div className="text-[11px] text-rose-700">{attempt.wrongCount} × 0.50</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-xs font-medium text-slate-600">Accuracy</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{accuracyPct}%</div>
            <div className="text-[11px] text-slate-500">
              {attempt.totalAttempted}/{attempt.totalQuestions} attempted
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-white p-3.5">
            <div className="text-xs font-medium text-slate-600">Correct (+1.00)</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">
              {attempt.correctCount}
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 bg-white p-3.5">
            <div className="text-xs font-medium text-slate-600">Wrong (-0.50)</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{attempt.wrongCount}</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="text-xs font-medium text-slate-600">Unanswered / Time</div>
            <div className="mt-1 text-2xl font-bold text-slate-800">
              {attempt.unansweredCount}
            </div>
            <div className="text-[11px] text-slate-500">
              Time: {formatDuration(attempt.timeSpentSeconds)}
            </div>
          </div>
        </div>
      </div>

      {/* 7 Exam Areas Breakdown */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-base font-bold text-slate-900">
          7-Area 51st Special BCS Breakdown
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2.5 pr-4">Exam Area</th>
                <th className="py-2.5 px-3 text-right">Questions</th>
                <th className="py-2.5 px-3 text-right">Attempted</th>
                <th className="py-2.5 px-3 text-right text-emerald-700">Correct</th>
                <th className="py-2.5 px-3 text-right text-rose-700">Wrong</th>
                <th className="py-2.5 px-3 text-right">Net Score</th>
                <th className="py-2.5 pl-3 text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {EXAM_AREAS.map((area) => {
                const st = areaStats[area];
                if (!st || st.total === 0) return null;
                return (
                  <tr key={area} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-4 font-medium text-slate-900">{area}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{st.total}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{st.attempted}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                      {st.correct}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-rose-700">
                      {st.wrong}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatScore(st.netScore)}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {st.accuracyPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MBBS Sub-disciplines Breakdown */}
      {medicalSubRows.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-base font-bold text-slate-900">
            MBBS Medical Science Sub-Discipline Breakdown
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {medicalSubRows.map(({ subject, stats }) => {
              const barPct = stats.total > 0 ? Math.max(0, (stats.netScore / stats.total) * 100) : 0;
              return (
                <div
                  key={subject}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{subject}</span>
                    <span className="text-xs font-bold tabular-nums text-emerald-700">
                      {formatScore(stats.netScore)}/{stats.total}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500"
                      style={{ width: `${Math.min(100, barPct)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                    <span>
                      ✓ {stats.correct} · ✕ {stats.wrong} · ○ {stats.total - stats.attempted}
                    </span>
                    <span className="font-medium">{stats.accuracyPct.toFixed(0)}% acc</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filterable Answer Review */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Answer Review & Explanations
            </h3>
            <p className="text-xs text-slate-500">
              Showing {reviewItems.length} of {attempt.questionIds.length} questions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['all', `All (${attempt.questionIds.length})`],
                ['wrong', `Wrong Only (${attempt.wrongCount})`],
                ['unanswered', `Unanswered (${attempt.unansweredCount})`],
                ['correct', `Correct (${attempt.correctCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setReviewFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  reviewFilter === key
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}

            <select
              aria-label="Filter review by subject"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
            >
              <option value="ALL">All Subjects</option>
              {availableSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {reviewItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              No questions match this filter.
            </div>
          ) : (
            reviewItems.map(({ index, question, chosen, status }) => (
              <div
                key={question.id}
                className={`rounded-xl border p-4 ${
                  status === 'correct'
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : status === 'wrong'
                      ? 'border-rose-200 bg-rose-50/30'
                      : 'border-slate-200 bg-slate-50/40'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                      Q{index}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {question.subject}
                    </span>
                    {question.topic && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {question.topic}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">{question.sourceExam}</span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      status === 'correct'
                        ? 'bg-emerald-100 text-emerald-800'
                        : status === 'wrong'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {status === 'correct'
                      ? 'Correct (+1.00)'
                      : status === 'wrong'
                        ? 'Wrong (-0.50)'
                        : 'Unanswered (0.00)'}
                  </span>
                </div>

                <p className="mt-2.5 text-sm font-semibold leading-relaxed text-slate-900">
                  {question.question}
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {question.options.map((opt, optIdx) => {
                    const isCorrect = optIdx === question.correctIndex;
                    const isChosen = optIdx === chosen;
                    return (
                      <div
                        key={optIdx}
                        className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                          isCorrect
                            ? 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-950'
                            : isChosen
                              ? 'border-rose-400 bg-rose-50 font-semibold text-rose-950'
                              : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <span>
                          <strong className="mr-1.5">{LETTERS[optIdx]}.</strong>
                          {opt}
                        </span>
                        {isCorrect && (
                          <span className="shrink-0 text-[11px] font-bold text-emerald-700">
                            ✓ Answer
                          </span>
                        )}
                        {isChosen && !isCorrect && (
                          <span className="shrink-0 text-[11px] font-bold text-rose-700">
                            ✕ Your Pick
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {question.explanation && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs leading-relaxed text-slate-700">
                    <span className="font-bold text-slate-900">Explanation: </span>
                    {question.explanation}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

