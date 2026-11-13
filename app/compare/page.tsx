'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CompareView } from '@/components/CompareView';
import { useAppContext } from '@/components/PuterProvider';

function CompareContent() {
  const searchParams = useSearchParams();
  const initialA = searchParams.get('a');
  const initialB = searchParams.get('b');
  const { attempts, attemptsLoading } = useAppContext();

  if (attemptsLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Loading attempts for comparison…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-xl font-bold text-slate-900">
          Compare Any Two Attempts (Subject-Wise Deltas)
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          Measure progress across retakes or new full mocks across all 7 exam areas and 12 MBBS
          sub-disciplines.
        </p>
      </div>

      <CompareView attempts={attempts} initialA={initialA} initialB={initialB} />
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Loading comparison view…
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}

