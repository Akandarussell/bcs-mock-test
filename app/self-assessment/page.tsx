'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AskTutor } from '@/components/AskTutor';
import { useAppContext } from '@/components/PuterProvider';
import { ALL_SUBJECTS, GENERAL_SUBJECTS, MEDICAL_SUBJECTS, Subject } from '@/lib/types';

const STORAGE_KEY = 'bcs_51_self_assessment_v1';

type ConfidenceLevel = 0 | 1 | 2 | 3;

interface SavedAssessment {
  ratings: Record<Subject, ConfidenceLevel>;
  dailyHours: number;
  daysLeft: number;
  updatedAt: number;
}

const LEVELS: {
  value: ConfidenceLevel;
  label: string;
  short: string;
  pct: number;
  activeCls: string;
}[] = [
  {
    value: 0,
    label: 'Not Started',
    short: '0 · New',
    pct: 10,
    activeCls: 'border-rose-500 bg-rose-600 text-white',
  },
  {
    value: 1,
    label: 'Basics Only',
    short: '1 · Weak',
    pct: 40,
    activeCls: 'border-amber-500 bg-amber-500 text-white',
  },
  {
    value: 2,
    label: 'Moderate',
    short: '2 · Mid',
    pct: 70,
    activeCls: 'border-sky-500 bg-sky-600 text-white',
  },
  {
    value: 3,
    label: 'Exam Ready',
    short: '3 · Strong',
    pct: 95,
    activeCls: 'border-emerald-600 bg-emerald-600 text-white',
  },
];

const SUBJECT_WEIGHTS: Record<Subject, number> = {
  Medicine: 16,
  Surgery: 14,
  'Gynaecology & Obstetrics': 12,
  Anatomy: 8,
  Physiology: 8,
  Biochemistry: 6,
  Pathology: 8,
  Pharmacology: 8,
  Microbiology: 6,
  'Forensic Medicine': 4,
  'Community Medicine': 5,
  Pediatrics: 5,
  Bangla: 20,
  English: 20,
  'Bangladesh Affairs': 20,
  'International Affairs': 20,
  'Mathematical Reasoning': 10,
  'Mental Ability': 10,
};

function defaultRatings(): Record<Subject, ConfidenceLevel> {
  const out = {} as Record<Subject, ConfidenceLevel>;
  for (const s of ALL_SUBJECTS) out[s] = 1;
  return out;
}

function loadInitialAssessment(): SavedAssessment {
  if (typeof window === 'undefined') {
    return { ratings: defaultRatings(), dailyHours: 6, daysLeft: 45, updatedAt: 0 };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ratings: defaultRatings(), dailyHours: 6, daysLeft: 45, updatedAt: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<SavedAssessment>;
    const merged = defaultRatings();
    if (parsed.ratings) {
      for (const s of ALL_SUBJECTS) {
        const val = parsed.ratings[s];
        if (val === 0 || val === 1 || val === 2 || val === 3) {
          merged[s] = val;
        }
      }
    }
    return {
      ratings: merged,
      dailyHours:
        typeof parsed.dailyHours === 'number' && parsed.dailyHours >= 1 && parsed.dailyHours <= 16
          ? parsed.dailyHours
          : 6,
      daysLeft:
        typeof parsed.daysLeft === 'number' && parsed.daysLeft >= 7 && parsed.daysLeft <= 365
          ? parsed.daysLeft
          : 45,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return { ratings: defaultRatings(), dailyHours: 6, daysLeft: 45, updatedAt: 0 };
  }
}

function saveAssessment(data: SavedAssessment) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota error
  }
}

const DEFAULT_ASSESSMENT: SavedAssessment = {
  ratings: defaultRatings(),
  dailyHours: 6,
  daysLeft: 45,
  updatedAt: 0,
};

export default function SelfAssessmentPage() {
  const router = useRouter();
  const { bank, attempts, startSubjectPractice } = useAppContext();

  const [assessment, setAssessment] = useState<SavedAssessment>(DEFAULT_ASSESSMENT);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    const stored = loadInitialAssessment();
    if (stored.updatedAt > 0) {
      setAssessment(stored);
    }
  }, []);

  const updateState = (next: SavedAssessment) => {
    setAssessment(next);
    saveAssessment(next);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 1800);
  };

  const setRating = (subject: Subject, level: ConfidenceLevel) => {
    updateState({
      ...assessment,
      ratings: { ...assessment.ratings, [subject]: level },
      updatedAt: Date.now(),
    });
  };

  const setDailyHours = (dailyHours: number) => {
    updateState({ ...assessment, dailyHours, updatedAt: Date.now() });
  };

  const setDaysLeft = (daysLeft: number) => {
    updateState({ ...assessment, daysLeft, updatedAt: Date.now() });
  };

  const resetAll = () => {
    updateState({
      ratings: defaultRatings(),
      dailyHours: 6,
      daysLeft: 45,
      updatedAt: Date.now(),
    });
  };

  // Blend optional observed mock accuracy per subject
  const mockAccuracyBySubject = useMemo(() => {
    const agg = new Map<string, { correct: number; attempted: number }>();
    for (const att of attempts) {
      for (const [subj, stats] of Object.entries(att.subjectBreakdown)) {
        const prev = agg.get(subj) ?? { correct: 0, attempted: 0 };
        agg.set(subj, {
          correct: prev.correct + stats.correct,
          attempted: prev.attempted + stats.attempted,
        });
      }
    }
    const pctMap = new Map<string, number>();
    for (const [subj, { correct, attempted }] of agg.entries()) {
      if (attempted > 0) pctMap.set(subj, Math.round((correct / attempted) * 100));
    }
    return pctMap;
  }, [attempts]);

  const analysis = useMemo(() => {
    let weightedSum = 0;
    let medicalWeighted = 0;
    let generalWeighted = 0;

    const critical: Subject[] = [];
    const moderate: Subject[] = [];
    const strong: Subject[] = [];

    for (const subj of ALL_SUBJECTS) {
      const level = assessment.ratings[subj];
      const selfPct = LEVELS[level].pct;
      const mockPct = mockAccuracyBySubject.get(subj);
      const effectivePct =
        mockPct !== undefined ? Math.round(selfPct * 0.65 + mockPct * 0.35) : selfPct;

      const weight = SUBJECT_WEIGHTS[subj];
      weightedSum += (effectivePct / 100) * weight;
      if ((MEDICAL_SUBJECTS as readonly string[]).includes(subj)) {
        medicalWeighted += (effectivePct / 100) * weight;
      } else {
        generalWeighted += (effectivePct / 100) * weight;
      }

      if (level <= 1) critical.push(subj);
      else if (level === 2) moderate.push(subj);
      else strong.push(subj);
    }

    const overallPct = Math.round((weightedSum / 200) * 100);
    const medicalPct = Math.round(medicalWeighted);
    const generalPct = Math.round(generalWeighted);
    const projectedScore = Math.round(weightedSum);

    // Compute study phase split based on daysLeft
    const phase1Days = Math.max(3, Math.round(assessment.daysLeft * 0.45));
    const phase2Days = Math.max(2, Math.round(assessment.daysLeft * 0.35));
    const phase3Days = Math.max(2, assessment.daysLeft - phase1Days - phase2Days);

    // Daily hours split
    const hrsCritical = Number((assessment.dailyHours * 0.5).toFixed(1));
    const hrsModerate = Number((assessment.dailyHours * 0.35).toFixed(1));
    const hrsStrong = Number(
      Math.max(0.5, assessment.dailyHours - hrsCritical - hrsModerate).toFixed(1)
    );

    return {
      overallPct,
      medicalPct,
      generalPct,
      projectedScore,
      critical,
      moderate,
      strong,
      phase1Days,
      phase2Days,
      phase3Days,
      hrsCritical,
      hrsModerate,
      hrsStrong,
    };
  }, [assessment, mockAccuracyBySubject]);

  const assessmentContext = useMemo(() => {
    const lines = [
      `Overall Readiness: ${analysis.overallPct}% (Projected score: ~${analysis.projectedScore}/200)`,
      `Medical Science Readiness: ${analysis.medicalPct}/100 | General Part Readiness: ${analysis.generalPct}/100`,
      `Study Budget: ${assessment.dailyHours} hrs/day, ${assessment.daysLeft} days remaining`,
      `Critical / Weak Subjects (Priority 1): ${analysis.critical.join(', ') || 'None'}`,
      `Moderate Subjects (Priority 2): ${analysis.moderate.join(', ') || 'None'}`,
      `Strong Subjects (Maintain): ${analysis.strong.join(', ') || 'None'}`,
    ];
    return lines.join('\n');
  }, [analysis, assessment.dailyHours, assessment.daysLeft]);

  const handlePracticeSubject = (subj: Subject) => {
    const avail = bank.filter((q) => q.subject === subj).length;
    if (avail === 0) return;
    const sess = startSubjectPractice([subj], Math.min(20, avail), `${subj} Focus Drill`);
    if (sess) router.push('/exam/');
  };

  const handlePracticeWeakMix = () => {
    const targets = analysis.critical.length > 0 ? analysis.critical : analysis.moderate;
    if (targets.length === 0) return;
    const sess = startSubjectPractice(
      targets,
      Math.min(30, bank.filter((q) => targets.includes(q.subject)).length),
      'Self-Assessment Weak Areas Drill'
    );
    if (sess) router.push('/exam/');
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-emerald-50/75 via-white to-teal-50/60 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-0.5 text-xs font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            51st Special BCS · Self Assessment &amp; Study Completion Guide
          </span>
          {savedToast && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              Saved automatically
            </span>
          )}
        </div>

        <h1 className="mt-2.5 text-2xl font-bold text-slate-900">
          Self Assessment &amp; Personalized Study Guide
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
          Rate your current confidence across all <strong>12 MBBS Medical Science</strong> and{' '}
          <strong>6 General</strong> subjects below. Your readiness score automatically blends with
          your completed mock exam results to generate a step-by-step study completion roadmap — and
          connects directly to <strong>Russell</strong> for BCS preparation &amp; answer solving.
        </p>

        {/* Readiness Summary KPIs */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200/80 bg-white/95 p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Overall Readiness
            </div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-700">
              {analysis.overallPct}%
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              Est. ~{analysis.projectedScore} / 200 marks
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white/95 p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Medical vs General
            </div>
            <div className="mt-1 text-xl font-extrabold text-slate-900">
              {analysis.medicalPct}% <span className="text-slate-400">/</span> {analysis.generalPct}%
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">100 Medical · 100 General</div>
          </div>

          <div className="rounded-xl border border-rose-200/80 bg-white/95 p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
              Needs Priority Focus
            </div>
            <div className="mt-1 text-2xl font-extrabold text-rose-700">
              {analysis.critical.length}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Subjects at New / Weak</div>
          </div>

          <div className="rounded-xl border border-teal-200/80 bg-white/95 p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">
              Study Budget
            </div>
            <div className="mt-1 text-xl font-extrabold text-teal-800">
              {assessment.dailyHours}h × {assessment.daysLeft}d
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {assessment.dailyHours * assessment.daysLeft} total study hrs
            </div>
          </div>
        </div>
      </section>

      {/* Study Parameters + Subject Self-Assessment Matrix */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              1. Rate Your Syllabus Preparation (18 Subjects)
            </h2>
            <p className="text-xs text-slate-500">
              Be honest — your weakest subjects get priority hours in the completion roadmap below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span>Hours/Day:</span>
              <input
                type="number"
                min={1}
                max={16}
                value={assessment.dailyHours}
                onChange={(e) =>
                  setDailyHours(Math.min(16, Math.max(1, Number(e.target.value) || 1)))
                }
                className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-xs font-bold text-slate-900"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span>Days Left:</span>
              <input
                type="number"
                min={7}
                max={365}
                value={assessment.daysLeft}
                onChange={(e) =>
                  setDaysLeft(Math.min(365, Math.max(7, Number(e.target.value) || 7)))
                }
                className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-xs font-bold text-slate-900"
              />
            </label>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Medical Science (100 Marks) */}
        <div className="mt-4">
          <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
            Medical Science — MBBS (100 Marks)
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            {MEDICAL_SUBJECTS.map((subj) => {
              const current = assessment.ratings[subj];
              const mockAcc = mockAccuracyBySubject.get(subj);
              return (
                <div
                  key={subj}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{subj}</div>
                    <div className="text-[11px] text-slate-500">
                      {mockAcc !== undefined
                        ? `Mock accuracy: ${mockAcc}%`
                        : `Weight ~${SUBJECT_WEIGHTS[subj]} marks`}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {LEVELS.map((lvl) => (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() => setRating(subj, lvl.value)}
                        title={lvl.label}
                        className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                          current === lvl.value
                            ? lvl.activeCls
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {lvl.short}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* General Part (100 Marks) */}
        <div className="mt-5">
          <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-teal-800">
            General Part (100 Marks)
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            {GENERAL_SUBJECTS.map((subj) => {
              const current = assessment.ratings[subj];
              const mockAcc = mockAccuracyBySubject.get(subj);
              return (
                <div
                  key={subj}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{subj}</div>
                    <div className="text-[11px] text-slate-500">
                      Official: {SUBJECT_WEIGHTS[subj]} marks
                      {mockAcc !== undefined ? ` · Mock: ${mockAcc}%` : ''}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {LEVELS.map((lvl) => (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() => setRating(subj, lvl.value)}
                        title={lvl.label}
                        className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                          current === lvl.value
                            ? lvl.activeCls
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {lvl.short}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Personalized Study Completion Guide */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              2. How to Complete Your Study (Generated from Your Assessment)
            </h2>
            <p className="text-xs text-slate-500">
              Daily time allocation ({assessment.dailyHours} hrs/day) and 3-phase completion plan
              for your next {assessment.daysLeft} days.
            </p>
          </div>
          <button
            type="button"
            disabled={analysis.critical.length + analysis.moderate.length === 0 || bank.length === 0}
            onClick={handlePracticeWeakMix}
            className="min-h-[40px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
          >
            Start Weak-Areas Practice Drill →
          </button>
        </div>

        {/* Priority Tiers */}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-rose-800">
                Priority 1 · Build Core Gaps
              </span>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                {analysis.hrsCritical} hrs/day
              </span>
            </div>
            <p className="mt-1.5 text-xs text-rose-900/80">
              Read digest summaries + solve previous 39th/42nd/48th Special BCS MCQs first.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {analysis.critical.length === 0 ? (
                <span className="text-xs font-medium text-emerald-700">
                  No critical gaps — great progress!
                </span>
              ) : (
                analysis.critical.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handlePracticeSubject(s)}
                    className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-900 transition hover:bg-rose-100"
                  >
                    {s} →
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-sky-800">
                Priority 2 · MCQ Consolidation
              </span>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                {analysis.hrsModerate} hrs/day
              </span>
            </div>
            <p className="mt-1.5 text-xs text-sky-900/80">
              Take 20–50 MCQ timed drills and review every wrong answer to cut -0.50 losses.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {analysis.moderate.length === 0 ? (
                <span className="text-xs text-slate-500">None in this tier.</span>
              ) : (
                analysis.moderate.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handlePracticeSubject(s)}
                    className="rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-900 transition hover:bg-sky-100"
                  >
                    {s} →
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                Priority 3 · Quick Revision
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                {analysis.hrsStrong} hrs/day
              </span>
            </div>
            <p className="mt-1.5 text-xs text-emerald-900/80">
              Protect these marks with spaced 15-minute flashcards and weekly full mocks.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {analysis.strong.length === 0 ? (
                <span className="text-xs text-slate-500">
                  Rate strong subjects as 3 · Strong to track maintenance.
                </span>
              ) : (
                analysis.strong.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handlePracticeSubject(s)}
                    className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
                  >
                    {s} →
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 3-Phase Completion Roadmap */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Phase 1 · Days 1–{analysis.phase1Days}
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900">Close Priority-1 Syllabus Gaps</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Dedicate {analysis.hrsCritical} hrs/day to your {analysis.critical.length || 'lowest'}{' '}
              weakest subjects. Finish core high-yield chapters and take a 20-MCQ drill after each
              chapter.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Phase 2 · Next {analysis.phase2Days} Days
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900">
              Mixed Drills &amp; Negative Marking Control
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Run 100-MCQ Medical &amp; General drills plus Custom Questions Part 1. Use{' '}
              <strong>Retry Missed</strong> on every attempt until error rate drops below 10%.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Phase 3 · Final {analysis.phase3Days} Days
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900">Full 200-MCQ Exam Simulation</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Take full 120-minute 200-MCQ mocks every 2 days, compare attempts side-by-side, and
              revise only your error log and high-yield tables.
            </p>
          </div>
        </div>
      </section>

      {/* Ask BCS Tutor (Gemini AI) */}
      <section>
        <AskTutor assessmentContext={assessmentContext} />
      </section>
    </div>
  );
}
