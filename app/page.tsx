'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/components/PuterProvider';
import { formatScore, getBankCountsBySubject, getModeBadgeColor } from '@/lib/examEngine';
import {
  EXAM_BLUEPRINT,
  FULL_EXAM_QUESTIONS,
  GENERAL_SUBJECTS,
  MEDICAL_SUBJECTS,
  Subject,
} from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const {
    bank,
    bankLoading,
    bankError,
    attempts,
    activeSession,
    isSignedIn,
    signIn,
    authBusy,
    startFullExam,
    startSubjectPractice,
    startRetakeSame,
    startRetryWrong,
  } = useAppContext();

  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>(['Medicine']);
  const [practiceCount, setPracticeCount] = useState<number>(20);

  const counts = useMemo(() => getBankCountsBySubject(bank), [bank]);

  const areaAvailability = useMemo(() => {
    return EXAM_BLUEPRINT.map((row) => {
      const available = row.subjects.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
      return { ...row, available };
    });
  }, [counts]);

  const latestAttempt = attempts[0] ?? null;
  const fullAttempts = useMemo(
    () => attempts.filter((a) => a.mode === 'Full 200' || a.totalQuestions === FULL_EXAM_QUESTIONS),
    [attempts]
  );
  const bestFullScore = useMemo(() => {
    if (fullAttempts.length === 0) return null;
    return Math.max(...fullAttempts.map((a) => a.netScore));
  }, [fullAttempts]);

  const practicePoolCount = useMemo(
    () => selectedSubjects.reduce((sum, s) => sum + (counts[s] ?? 0), 0),
    [counts, selectedSubjects]
  );

  const toggleSubject = (s: Subject) => {
    setSelectedSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleStartFull = () => {
    const sess = startFullExam();
    if (sess) router.push('/exam/');
  };

  const handleStartPractice = () => {
    if (selectedSubjects.length === 0) return;
    const count = Math.min(practiceCount, Math.max(1, practicePoolCount));
    const title =
      selectedSubjects.length === 1
        ? `${selectedSubjects[0]} Practice (${count} MCQs)`
        : `${selectedSubjects.length}-Subject Drill (${count} MCQs)`;
    const sess = startSubjectPractice(selectedSubjects, count, title);
    if (sess) router.push('/exam/');
  };

  return (
    <div className="space-y-6">
      {/* Resume Banner */}
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
            Resume Exam →
          </Link>
        </div>
      )}

      {/* Hero Section */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/60 p-5 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              BPSC 51st Special BCS (Health) · Assistant Surgeon (MBBS) Only
            </span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Shamima&apos;s BCS Preparation
            </h1>
            <p className="mt-1 text-sm font-semibold text-teal-800">
              200-Mark MCQ Mock Exam &amp; Subject-Wise Progress Tracker
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              Every <strong>Start Fresh</strong> attempt runs Fisher–Yates shuffling on both
              questions and their 4 options, deprioritizes questions seen in your previous attempt,
              and scores strictly at <strong className="text-emerald-700">+1.00</strong> /{' '}
              <strong className="text-rose-700">-0.50</strong> over <strong>120 minutes</strong>.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row lg:w-64 lg:flex-col">
            <button
              type="button"
              onClick={handleStartFull}
              disabled={bankLoading || bank.length === 0}
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bankLoading ? 'Loading Bank…' : 'Start Fresh Full 200 Mock'}
            </button>
            {!isSignedIn && (
              <button
                type="button"
                onClick={signIn}
                disabled={authBusy}
                className="inline-flex min-h-[42px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
              >
                {authBusy ? 'Connecting…' : 'Sign in with Puter to Sync Progress'}
              </button>
            )}
          </div>
        </div>

        {bankError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {bankError}
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Curated Bank
            </div>
            <div className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
              {bank.length} <span className="text-sm font-semibold text-slate-500">MCQs</span>
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">MBBS + General (BDS excluded)</div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Saved Attempts
            </div>
            <div className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
              {attempts.length}
            </div>
            <div className="mt-0.5 text-[11px] text-teal-700">
              {isSignedIn ? 'Synced to Puter KV' : 'Guest localStorage'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Latest Score
            </div>
            <div className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
              {latestAttempt ? `${formatScore(latestAttempt.netScore)}/${latestAttempt.maxScore}` : '—'}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {latestAttempt ? latestAttempt.mode : 'No attempt yet'}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200/80 bg-white/90 p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Best Full Mock
            </div>
            <div className="mt-1 text-xl font-extrabold text-emerald-700 sm:text-2xl">
              {bestFullScore !== null ? `${formatScore(bestFullScore)}/200` : '—'}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {fullAttempts.length} full mock{fullAttempts.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </section>

      {/* Main 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Official 7-Area Blueprint */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Official 51st Special BCS Distribution
            </h2>
            <Link href="/bank/" className="text-xs font-semibold text-teal-700 hover:underline">
              Explore Bank →
            </Link>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Exact 200-mark Assistant Surgeon (MBBS) MCQ blueprint vs available bank coverage.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3">Exam Area</th>
                  <th className="py-2 px-3 text-right">Target</th>
                  <th className="py-2 pl-3 text-right">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {areaAvailability.map((row) => {
                  const ready = row.available >= row.count;
                  return (
                    <tr key={row.area} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{row.area}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
                        {row.count}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <span
                          className={`inline-flex min-w-[40px] justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                            ready
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70'
                              : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/70'
                          }`}
                        >
                          {row.available}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-slate-200 bg-slate-50/70 font-bold text-slate-900">
                  <td className="py-2.5 pr-3">Total</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">200</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums text-emerald-700">
                    {bank.length}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Subject & MBBS Sub-Discipline Drill */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Subject &amp; MBBS Sub-Discipline Drill
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Select one or more subjects for a timed drill (36s/MCQ, +1.00 / -0.50).
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedSubjects([...MEDICAL_SUBJECTS])}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                All MBBS
              </button>
              <button
                type="button"
                onClick={() => setSelectedSubjects([...GENERAL_SUBJECTS])}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                All General
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Medical Science (MBBS · 12 Subjects)
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MEDICAL_SUBJECTS.map((s) => {
                  const active = selectedSubjects.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSubject(s)}
                      className={`min-h-[34px] rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                        active
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                          : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {s} <span className="opacity-80">({counts[s] ?? 0})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                General Part (6 Subjects)
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {GENERAL_SUBJECTS.map((s) => {
                  const active = selectedSubjects.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSubject(s)}
                      className={`min-h-[34px] rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                        active
                          ? 'border-teal-700 bg-teal-700 text-white shadow-2xs'
                          : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {s} <span className="opacity-80">({counts[s] ?? 0})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <label htmlFor="drill-count" className="text-xs font-semibold text-slate-700">
                Questions:
              </label>
              <select
                id="drill-count"
                value={practiceCount}
                onChange={(e) => setPracticeCount(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
              >
                {[10, 20, 30, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    Up to {n} MCQs
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">({practicePoolCount} available)</span>
            </div>

            <button
              type="button"
              onClick={handleStartPractice}
              disabled={practicePoolCount === 0}
              className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Start Practice Drill →
            </button>
          </div>
        </section>
      </div>

      {/* Recent Attempts */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">Recent Attempts</h2>
          <div className="flex gap-4">
            <Link
              href="/compare/"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
            >
              Compare Attempts
            </Link>
            <Link
              href="/history/"
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline"
            >
              Full History &amp; Review →
            </Link>
          </div>
        </div>

        {attempts.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
            No completed attempts yet. Start a 200-mark Full Mock or a Subject Practice drill to
            track your score, negative marks, and subject-wise progress.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {attempts.slice(0, 5).map((att) => {
              const missed = att.wrongCount + att.unansweredCount;
              return (
                <div
                  key={att.attemptId}
                  className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getModeBadgeColor(
                          att.mode
                        )}`}
                      >
                        {att.mode}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {att.title || att.mode}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(att.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Net:{' '}
                      <strong className="text-slate-900">
                        {formatScore(att.netScore)}/{att.maxScore}
                      </strong>{' '}
                      · Correct: <span className="font-semibold text-emerald-700">{att.correctCount}</span>{' '}
                      · Wrong:{' '}
                      <span className="font-semibold text-rose-700">
                        {att.wrongCount} (-{formatScore(att.negativeMarks)})
                      </span>{' '}
                      · Unanswered: {att.unansweredCount}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
                    <button
                      type="button"
                      onClick={() => {
                        const s = startRetakeSame(att);
                        if (s) router.push('/exam/');
                      }}
                      className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-center text-xs font-semibold text-sky-900 transition hover:bg-sky-100"
                    >
                      Retake Same
                    </button>
                    <button
                      type="button"
                      disabled={missed === 0}
                      onClick={() => {
                        const s = startRetryWrong(att);
                        if (s) router.push('/exam/');
                      }}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-center text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-40"
                    >
                      Retry ({missed})
                    </button>
                    <Link
                      href={`/history/?id=${encodeURIComponent(att.attemptId)}`}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
