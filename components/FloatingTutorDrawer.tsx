'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AskTutor } from './AskTutor';
import { useAppContext } from './PuterProvider';

export function FloatingTutorDrawer() {
  const pathname = usePathname() || '/';
  const { activeSession } = useAppContext();
  const [open, setOpen] = useState(false);

  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  // Hide floating widget on /self-assessment (where AskTutor is embedded inline)
  // and during an active timed exam on /exam to keep exam focus clean.
  if (cleanPath === '/self-assessment' || (cleanPath === '/exam' && activeSession)) {
    return null;
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Ask BCS Tutor"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-xs font-bold text-white shadow-lg transition hover:from-emerald-700 hover:to-teal-700 sm:text-sm"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-extrabold">
            AI
          </span>
          <span>Ask BCS Tutor</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/35 p-3 backdrop-blur-[2px] sm:p-5"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AskTutor compact onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
