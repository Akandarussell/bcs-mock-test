'use client';

import React, { useMemo, useState } from 'react';
import { useAppContext } from '@/components/PuterProvider';
import { getBankCountsBySubject } from '@/lib/examEngine';
import { ALL_SUBJECTS, GENERAL_SUBJECTS, MEDICAL_SUBJECTS } from '@/lib/types';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function BankPage() {
  const { bank, bankLoading } = useAppContext();
  const [packFilter, setPackFilter] = useState<'ALL' | 'CORE' | 'CUSTOM_1'>('ALL');
  const [partFilter, setPartFilter] = useState<'ALL' | 'Medical' | 'General'>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [showAnswers, setShowAnswers] = useState<boolean>(true);

  const customPart1Count = useMemo(
    () => bank.filter((q) => q.customPack === 'Custom Questions Part 1').length,
    [bank]
  );

  const counts = useMemo(() => getBankCountsBySubject(bank), [bank]);

  const filtered = useMemo(() => {
    const qLower = search.trim().toLowerCase();
    return bank.filter((item) => {
      if (packFilter === 'CORE' && item.customPack) return false;
      if (packFilter === 'CUSTOM_1' && item.customPack !== 'Custom Questions Part 1') return false;
      if (partFilter !== 'ALL' && item.part !== partFilter) return false;
      if (subjectFilter !== 'ALL' && item.subject !== subjectFilter) return false;
      if (qLower) {
        const hay = `${item.question} ${item.options.join(' ')} ${item.sourceExam} ${item.topic ?? ''}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
  }, [bank, packFilter, partFilter, subjectFilter, search]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              MBBS Assistant Surgeon Syllabus Only (Dental/BDS & Non-51st Excluded)
            </span>
            <h1 className="mt-2 text-xl font-bold text-slate-900">
              Curated Question Bank ({bank.length} MCQs)
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Built via <code className="rounded bg-slate-100 px-1.5 py-0.5">scripts/build_question_bank.py</code>.
              Add downloaded 39th/42nd/48th/EEA.BD PDFs or TXTs into{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5">./raw_questions/</code> and run{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run bank</code> to expand
              and deduplicate.
            </p>
          </div>
        </div>

        {/* Subject Coverage Pills */}
        <div className="mt-4 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Medical Science ({MEDICAL_SUBJECTS.reduce((s, k) => s + (counts[k] ?? 0), 0)} MCQs)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MEDICAL_SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setPartFilter('Medical');
                  setSubjectFilter(subjectFilter === s ? 'ALL' : s);
                }}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  subjectFilter === s
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {s}: {counts[s] ?? 0}
              </button>
            ))}
          </div>

          <div className="pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            General Part ({GENERAL_SUBJECTS.reduce((s, k) => s + (counts[k] ?? 0), 0)} MCQs)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GENERAL_SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setPartFilter('General');
                  setSubjectFilter(subjectFilter === s ? 'ALL' : s);
                }}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  subjectFilter === s
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {s}: {counts[s] ?? 0}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Filters & Preview List */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by question set"
              value={packFilter}
              onChange={(e) => setPackFilter(e.target.value as 'ALL' | 'CORE' | 'CUSTOM_1')}
              className="min-h-[38px] rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Sets ({bank.length})</option>
              <option value="CORE">Core Syllabus Bank ({bank.length - customPart1Count})</option>
              <option value="CUSTOM_1">Custom Questions Part 1 ({customPart1Count})</option>
            </select>

            <select
              aria-label="Filter by part"
              value={partFilter}
              onChange={(e) => {
                setPartFilter(e.target.value as 'ALL' | 'Medical' | 'General');
                setSubjectFilter('ALL');
              }}
              className="min-h-[38px] rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Parts</option>
              <option value="Medical">Medical (MBBS)</option>
              <option value="General">General</option>
            </select>

            <select
              aria-label="Filter by subject"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="min-h-[38px] rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Allowed Subjects</option>
              {ALL_SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s} ({counts[s] ?? 0})
                </option>
              ))}
            </select>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search question text or source…"
              className="min-h-[38px] w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 sm:w-64"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={showAnswers}
              onChange={(e) => setShowAnswers(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show answers & explanations
          </label>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          {bankLoading
            ? 'Loading…'
            : `Showing ${Math.min(filtered.length, 60)} of ${filtered.length} matching questions`}
        </div>

        <div className="mt-4 space-y-3">
          {filtered.slice(0, 60).map((item, idx) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">
                  #{idx + 1}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  {item.part} · {item.subject}
                </span>
                {item.topic && (
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {item.topic}
                  </span>
                )}
                <span className="text-[11px] text-slate-500">{item.sourceExam}</span>
              </div>

              <p className="mt-2 text-sm font-semibold text-slate-900">{item.question}</p>

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
                <p className="mt-2 text-xs text-slate-600">
                  <strong className="text-slate-800">Explanation:</strong> {item.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

