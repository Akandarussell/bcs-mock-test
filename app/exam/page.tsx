'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AttemptReport } from '@/components/AttemptReport';
import { ExamRunner } from '@/components/ExamRunner';
import { useAppContext } from '@/components/PuterProvider';
import { AttemptRecord, GENERAL_SUBJECTS, MEDICAL_SUBJECTS } from '@/lib/types';

export default function ExamPage() {
  const {
    bank,
    bankLoading,
    activeSession,
    updateActiveSession,
    startFullExam,
    startSubjectPractice,
  } = useAppContext();

  const [justSubmitted, setJustSubmitted] = useState<AttemptRecord | null>(null);

  if (bankLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Loading 51st Special BCS Assistant Surgeon question bank…
      </div>
    );
  }

  if (justSubmitted && !activeSession) {
    return <AttemptReport attempt={justSubmitted} bank={bank} />;
  }

  if (activeSession) {
    return (
      <ExamRunner
        session={activeSession}
        bank={bank}
        onSubmitted={(attempt) => setJustSubmitted(attempt)}
        onDiscard={() => {
          updateActiveSession(null);
          setJustSubmitted(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/50 p-5 shadow-sm sm:p-6">
        <span className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-0.5 text-xs font-semibold text-emerald-800">
          51st Special BCS Assistant Surgeon (MBBS)
        </span>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Start a Mock Exam</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Questions and options are freshly shuffled via Fisher–Yates on every attempt, with
          unseen questions prioritized over your previous attempt.
        </p>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => {
              setJustSubmitted(null);
              startFullExam();
            }}
            disabled={bank.length === 0}
            className="min-h-[46px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-xs transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
          >
            Start Fresh Full 200-MCQ Mock (120 Min)
          </button>
          <button
            type="button"
            onClick={() => {
              setJustSubmitted(null);
              startSubjectPractice([...MEDICAL_SUBJECTS], 100, 'Medical Science 100-MCQ Mock');
            }}
            disabled={bank.length === 0}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-50"
          >
            Medical Science 100-MCQ Drill
          </button>
          <button
            type="button"
            onClick={() => {
              setJustSubmitted(null);
              startSubjectPractice([...GENERAL_SUBJECTS], 100, 'General Part 100-MCQ Mock');
            }}
            disabled={bank.length === 0}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-50"
          >
            General Part 100-MCQ Drill
          </button>
          <Link
            href="/custom-part-1/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-2.5 text-sm font-semibold text-teal-800 shadow-2xs transition hover:bg-teal-100/80"
          >
            Custom Questions Part 1 ({bank.filter((q) => q.customPack === 'Custom Questions Part 1').length} Bengali MCQs) →
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-bold text-slate-900">Quick Single-Subject Drills</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {[...MEDICAL_SUBJECTS, ...GENERAL_SUBJECTS].map((subj) => {
            const count = bank.filter((q) => q.subject === subj).length;
            return (
              <button
                key={subj}
                type="button"
                disabled={count === 0}
                onClick={() => {
                  setJustSubmitted(null);
                  startSubjectPractice([subj], Math.min(20, count));
                }}
                className="flex min-h-[44px] items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50/50 disabled:opacity-45"
              >
                <span>{subj}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200/70">
                  {count} MCQs
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

