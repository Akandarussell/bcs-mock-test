'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AttemptReport } from '@/components/AttemptReport';
import { useAppContext } from '@/components/PuterProvider';
import { formatDuration, formatScore, getModeBadgeColor } from '@/lib/examEngine';

function HistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('id');

  const {
    bank,
    bankLoading,
    attempts,
    attemptsLoading,
    deleteAttempt,
    isSignedIn,
    syncedToCloud,
  } = useAppContext();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedAttempt = useMemo(() => {
    const preferred = selectedId ?? requestedId;
    if (preferred) {
      const found = attempts.find((a) => a.attemptId === preferred);
      if (found) return found;
    }
    return attempts[0] ?? null;
  }, [attempts, requestedId, selectedId]);

  if (attemptsLoading || bankLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Loading attempt history…
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <h1 className="text-xl font-bold text-slate-900">No Exam Attempts Recorded Yet</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Take a 51st Special BCS Full 200 Mock or a Subject Practice drill. Your scores,
          negative marks, and filterable Answer Review will appear here.
        </p>
        <Link
          href="/exam/"
          className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Start Mock Exam →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Saved Attempts List */}
      <aside className="space-y-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm lg:sticky lg:top-20">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-slate-900">
              Attempt History ({attempts.length})
            </h1>
            <span className="text-[11px] font-medium text-slate-500">
              {isSignedIn && syncedToCloud ? 'Puter KV' : 'Local'}
            </span>
          </div>

          <div className="mt-3 max-h-[640px] space-y-2 overflow-y-auto pr-1">
            {attempts.map((att, idx) => {
              const active = selectedAttempt?.attemptId === att.attemptId;
              return (
                <div
                  key={att.attemptId}
                  className={`rounded-xl border p-3 transition ${
                    active
                      ? 'border-emerald-600 bg-emerald-50/70'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(att.attemptId)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getModeBadgeColor(
                          att.mode
                        )}`}
                      >
                        #{attempts.length - idx} · {att.mode}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {formatScore(att.netScore)}/{att.maxScore}
                      </span>
                    </div>
                    <div className="mt-1.5 truncate text-xs font-semibold text-slate-800">
                      {att.title || att.mode}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{new Date(att.timestamp).toLocaleDateString()}</span>
                      <span>
                        ✓{att.correctCount} ✕{att.wrongCount} · {formatDuration(att.timeSpentSeconds)}
                      </span>
                    </div>
                  </button>

                  <div className="mt-2 flex justify-end border-t border-slate-100 pt-1.5">
                    <button
                      type="button"
                      onClick={() => void deleteAttempt(att.attemptId)}
                      className="text-[11px] font-medium text-rose-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Selected Attempt Detail */}
      <div>
        {selectedAttempt && (
          <AttemptReport
            attempt={selectedAttempt}
            bank={bank}
            onCompareWith={(id) => router.push(`/compare/?b=${encodeURIComponent(id)}`)}
          />
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Loading attempt history…
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}

