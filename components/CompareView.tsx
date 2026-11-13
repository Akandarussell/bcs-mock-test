'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ComparisonRow,
  compareAttempts,
  formatDelta,
  formatDuration,
  formatScore,
} from '@/lib/examEngine';
import { AttemptRecord } from '@/lib/types';

function DeltaBadge({ value, invertColor = false }: { value: number; invertColor?: boolean }) {
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) {
    return (
      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
        0.00
      </span>
    );
  }
  const positiveGood = invertColor ? rounded < 0 : rounded > 0;
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
        positiveGood ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
      }`}
    >
      {formatDelta(rounded)}
    </span>
  );
}

function ComparisonTable({ title, rows }: { title: string; rows: ComparisonRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="py-2.5 pr-4">Subject / Area</th>
              <th className="py-2.5 px-3 text-right">Attempt A Net</th>
              <th className="py-2.5 px-3 text-right">Attempt A Acc</th>
              <th className="py-2.5 px-3 text-right">Attempt B Net</th>
              <th className="py-2.5 px-3 text-right">Attempt B Acc</th>
              <th className="py-2.5 px-3 text-right">Net Score Δ</th>
              <th className="py-2.5 pl-3 text-right">Accuracy Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.label} className="hover:bg-slate-50/70">
                <td className="py-2.5 pr-4 font-medium text-slate-900">{row.label}</td>
                <td className="py-2.5 px-3 text-right text-slate-700">
                  {row.a.total > 0 ? `${formatScore(row.a.netScore)}/${row.a.total}` : '—'}
                </td>
                <td className="py-2.5 px-3 text-right text-xs text-slate-500">
                  {row.a.attempted > 0 ? `${row.a.accuracyPct.toFixed(1)}%` : '—'}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                  {row.b.total > 0 ? `${formatScore(row.b.netScore)}/${row.b.total}` : '—'}
                </td>
                <td className="py-2.5 px-3 text-right text-xs text-slate-500">
                  {row.b.attempted > 0 ? `${row.b.accuracyPct.toFixed(1)}%` : '—'}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <DeltaBadge value={row.netDelta} />
                </td>
                <td className="py-2.5 pl-3 text-right">
                  <span
                    className={`text-xs font-semibold ${
                      row.accuracyDelta > 0
                        ? 'text-emerald-700'
                        : row.accuracyDelta < 0
                          ? 'text-rose-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {row.accuracyDelta > 0 ? '+' : ''}
                    {row.accuracyDelta.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CompareView({
  attempts,
  initialA,
  initialB,
}: {
  attempts: AttemptRecord[];
  initialA?: string | null;
  initialB?: string | null;
}) {
  const [idA, setIdA] = useState<string>(initialA || '');
  const [idB, setIdB] = useState<string>(initialB || '');

  const resolvedIdA = useMemo(() => {
    if (idA && attempts.some((a) => a.attemptId === idA)) return idA;
    return (attempts[1] ?? attempts[0])?.attemptId ?? '';
  }, [attempts, idA]);

  const resolvedIdB = useMemo(() => {
    if (idB && attempts.some((a) => a.attemptId === idB)) return idB;
    return attempts[0]?.attemptId ?? '';
  }, [attempts, idB]);

  const attemptA = useMemo(
    () => attempts.find((a) => a.attemptId === resolvedIdA),
    [attempts, resolvedIdA]
  );
  const attemptB = useMemo(
    () => attempts.find((a) => a.attemptId === resolvedIdB),
    [attempts, resolvedIdB]
  );

  const comparison = useMemo(() => {
    if (!attemptA || !attemptB) return null;
    return compareAttempts(attemptA, attemptB);
  }, [attemptA, attemptB]);

  if (attempts.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <h2 className="text-lg font-bold text-slate-900">Need at Least 2 Saved Attempts</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Complete two mock tests or retake an existing attempt to compare overall and
          subject-wise score deltas across the 7 exam areas and 12 MBBS disciplines.
        </p>
        <Link
          href="/exam/"
          className="mt-5 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Take a Mock Exam
        </Link>
      </div>
    );
  }

  const labelFor = (a: AttemptRecord, idx: number) =>
    `#${attempts.length - idx} · ${a.mode} · ${formatScore(a.netScore)}/${a.maxScore} (${new Date(
      a.timestamp
    ).toLocaleDateString()})`;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Attempt A (Baseline)
            </label>
            <select
              value={resolvedIdA}
              onChange={(e) => setIdA(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900"
            >
              {attempts.map((a, idx) => (
                <option key={a.attemptId} value={a.attemptId}>
                  {labelFor(a, idx)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Attempt B (Compare Target)
            </label>
            <select
              value={resolvedIdB}
              onChange={(e) => setIdB(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900"
            >
              {attempts.map((a, idx) => (
                <option key={a.attemptId} value={a.attemptId}>
                  {labelFor(a, idx)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {comparison && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-xs font-medium text-slate-600">Net Score Delta (B − A)</div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xl font-bold text-slate-900">
                  {formatDelta(comparison.netScoreDelta)}
                </span>
                <DeltaBadge value={comparison.netScoreDelta} />
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {formatScore(comparison.attemptA.netScore)} →{' '}
                {formatScore(comparison.attemptB.netScore)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-xs font-medium text-slate-600">Accuracy Delta</div>
              <div className="mt-1.5 text-xl font-bold text-slate-900">
                {comparison.accuracyDelta > 0 ? '+' : ''}
                {comparison.accuracyDelta.toFixed(1)}%
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Correct: {comparison.attemptA.correctCount} → {comparison.attemptB.correctCount}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-xs font-medium text-slate-600">Negative Marks Delta</div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xl font-bold text-slate-900">
                  {formatDelta(comparison.negativeMarksDelta)}
                </span>
                <DeltaBadge value={comparison.negativeMarksDelta} invertColor />
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Lower negative marks is better
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-xs font-medium text-slate-600">Time Spent</div>
              <div className="mt-1.5 text-lg font-bold text-slate-900">
                {formatDuration(comparison.attemptA.timeSpentSeconds)} →{' '}
                {formatDuration(comparison.attemptB.timeSpentSeconds)}
              </div>
              <div className="mt-1 text-xs text-slate-500">Attempt A vs Attempt B</div>
            </div>
          </div>
        )}
      </div>

      {comparison && (
        <>
          <ComparisonTable
            title="7-Area Subject Delta Comparison (Attempt B vs Attempt A)"
            rows={comparison.areaRows}
          />
          <ComparisonTable
            title="MBBS Medical Sub-Discipline Comparison"
            rows={comparison.medicalSubRows}
          />
        </>
      )}
    </div>
  );
}

