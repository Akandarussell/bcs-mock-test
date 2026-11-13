'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppContext } from './PuterProvider';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/exam/', label: 'Mock Exam' },
  { href: '/custom-part-1/', label: 'Custom Questions Part 1' },
  { href: '/history/', label: 'History & Review' },
  { href: '/compare/', label: 'Compare Attempts' },
  { href: '/bank/', label: 'Question Bank' },
];

function isActivePath(pathname: string, href: string): boolean {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const cleanHref = href.replace(/\/+$/, '') || '/';
  return cleanPath === cleanHref;
}

export function Navbar() {
  const pathname = usePathname() || '/';
  const [mobileOpen, setMobileOpen] = useState(false);

  const {
    isSignedIn,
    authUser,
    syncedToCloud,
    authBusy,
    authError,
    signIn,
    signOut,
    activeSession,
  } = useAppContext();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3.5 py-2.5 sm:px-6 sm:py-3">
        {/* Brand */}
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="flex min-w-0 items-center gap-2.5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-sm font-extrabold text-white shadow-sm">
            51
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight text-slate-900 sm:text-base">
              Shamima&apos;s BCS Preparation
            </div>
            <div className="truncate text-[11px] font-medium text-teal-700 sm:text-xs">
              51st Special BCS · Assistant Surgeon (MBBS)
            </div>
          </div>
        </Link>

        {/* Desktop Pill Nav */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-0.5 rounded-full border border-slate-200/80 bg-slate-100/75 p-1 lg:flex xl:gap-1"
        >
          {NAV_LINKS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition xl:px-3.5 xl:text-xs ${
                  active
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {item.href === '/exam/' && activeSession && (
                  <span
                    title="Exam in progress"
                    className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-500"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Controls: Puter Auth + Mobile Toggle */}
        <div className="flex shrink-0 items-center gap-2">
          {isSignedIn ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  syncedToCloud
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="hidden sm:inline">Puter:</span>
                <span className="max-w-[84px] truncate sm:max-w-[120px]">
                  {authUser?.username ?? 'Synced'}
                </span>
              </span>
              <button
                type="button"
                onClick={signOut}
                disabled={authBusy}
                className="hidden rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 sm:inline-flex"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={signIn}
              disabled={authBusy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
            >
              <span className="sm:hidden">{authBusy ? '…' : 'Puter Sync'}</span>
              <span className="hidden sm:inline xl:hidden">
                {authBusy ? 'Connecting…' : 'Sign in with Puter'}
              </span>
              <span className="hidden xl:inline">
                {authBusy ? 'Connecting…' : 'Sign in with Puter to Sync Progress'}
              </span>
            </button>
          )}

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
          >
            {mobileOpen ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Collapsible Menu */}
      {mobileOpen && (
        <div
          id="mobile-nav-drawer"
          className="border-t border-slate-200/80 bg-white/95 px-3.5 py-3 shadow-md lg:hidden"
        >
          <nav aria-label="Mobile Navigation" className="grid gap-1.5">
            {NAV_LINKS.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex min-h-[44px] items-center justify-between rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.href === '/exam/' && activeSession && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Active
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            {isSignedIn ? (
              <>
                <span className="text-xs text-slate-600">
                  Signed in as <strong className="text-slate-900">{authUser?.username ?? 'User'}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    void signOut();
                  }}
                  disabled={authBusy}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void signIn();
                }}
                disabled={authBusy}
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {authBusy ? 'Connecting…' : 'Sign in with Puter to Sync Progress'}
              </button>
            )}
          </div>
        </div>
      )}

      {authError && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800">
          {authError} (Progress remains safely saved in localStorage.)
        </div>
      )}
    </header>
  );
}
