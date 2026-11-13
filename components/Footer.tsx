import React from 'react';

export function LogikaalMonogram({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="9" fill="#0F172A" />
      <rect x="1" y="1" width="34" height="34" rx="8" stroke="#10B981" strokeOpacity="0.45" />
      {/* Geometric LK Monogram */}
      <path
        d="M9.5 10V26H16.5"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 10V26M26.5 10L20.2 18L26.5 26"
        stroke="#34D399"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-slate-600 sm:flex-row sm:px-6">
        <div className="text-center sm:text-left">
          <div className="font-semibold text-slate-800">Shamima&apos;s BCS Preparation</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            51st Special BCS (Health) — Assistant Surgeon (MBBS) Exclusively · 200 MCQs · 120 Min · +1.00 / -0.50
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://logikaal.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 transition hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <LogikaalMonogram className="h-6 w-6 shrink-0" />
            <div className="text-left leading-tight">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Powered by
              </div>
              <div className="text-xs font-bold tracking-tight text-slate-900">
                logikaal<span className="text-emerald-600">.com</span>
              </div>
            </div>
          </a>

          <span className="text-slate-300" aria-hidden="true">
            |
          </span>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>Crafted with</span>
            <span className="text-rose-500" aria-label="love">
              ♥
            </span>
            <span>by</span>
            <span className="font-semibold text-slate-900">Russell</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

