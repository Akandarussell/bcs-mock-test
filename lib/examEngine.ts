import { shuffle, shuffleOptions } from './shuffle';
import {
  ALL_SUBJECTS,
  AttemptMode,
  AttemptRecord,
  EXAM_AREAS,
  EXAM_BLUEPRINT,
  ExamArea,
  ExamSession,
  FULL_EXAM_QUESTIONS,
  MARK_CORRECT,
  MARK_WRONG,
  MEDICAL_SUBJECTS,
  Question,
  SECONDS_PER_QUESTION,
  SessionQuestion,
  Subject,
  SubjectStats,
  areaOfSubject,
} from './types';

let cachedBank: Question[] | null = null;

export async function loadQuestionBank(): Promise<Question[]> {
  if (cachedBank) return cachedBank;
  const res = await fetch('/data/questions.json', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load question bank (${res.status})`);
  }
  const data = (await res.json()) as Question[];
  cachedBank = Array.isArray(data) ? data : [];
  return cachedBank;
}

function makeSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sess_${crypto.randomUUID()}`;
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function makeAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `att_${crypto.randomUUID()}`;
  }
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Draw `count` items from `pool`, deprioritizing IDs present in `seenIds`
 * (from the user's previous attempt) while Fisher–Yates shuffling both groups.
 */
function pickWithFreshness(pool: Question[], count: number, seenIds: Set<string>): Question[] {
  if (count <= 0 || pool.length === 0) return [];
  const fresh = shuffle(pool.filter((q) => !seenIds.has(q.id)));
  const seen = shuffle(pool.filter((q) => seenIds.has(q.id)));
  return [...fresh, ...seen].slice(0, Math.min(count, pool.length));
}

function toSessionQuestions(questions: Question[]): SessionQuestion[] {
  return questions.map((q) => {
    const { order } = shuffleOptions(q.options.length, q.correctIndex);
    return { id: q.id, order };
  });
}

/**
 * Generates a Full 51st Special BCS Assistant Surgeon (MBBS) 200-MCQ mock exam.
 * If the local bank temporarily has fewer questions in any blueprint bucket than
 * required, all buckets are scaled down proportionally by the limiting bucket ratio
 * so the 50% Medical / 50% General subject proportions stay exact.
 */
export function generateFullExamSession(
  bank: Question[],
  lastAttempt?: AttemptRecord | null
): ExamSession {
  const seenIds = new Set<string>(lastAttempt?.questionIds ?? []);

  // Group bank into the 7 official blueprint areas
  const buckets = new Map<ExamArea, Question[]>();
  for (const row of EXAM_BLUEPRINT) {
    const allowed = new Set<string>(row.subjects);
    buckets.set(
      row.area,
      bank.filter((q) => allowed.has(q.subject))
    );
  }

  // Determine scaling factor if any bucket has fewer questions than its blueprint target
  let scale = 1;
  for (const row of EXAM_BLUEPRINT) {
    const avail = buckets.get(row.area)?.length ?? 0;
    if (row.count > 0) {
      scale = Math.min(scale, avail / row.count);
    }
  }

  const targetCounts = EXAM_BLUEPRINT.map((row) => {
    const avail = buckets.get(row.area)?.length ?? 0;
    if (scale >= 1) return row.count;
    // Scale proportionally while keeping at least 1 question if bucket has any
    const scaled = avail === 0 ? 0 : Math.max(1, Math.floor(row.count * scale));
    return Math.min(avail, scaled);
  });

  const selected: Question[] = [];
  EXAM_BLUEPRINT.forEach((row, idx) => {
    const pool = buckets.get(row.area) ?? [];
    const need = targetCounts[idx];
    // For Medical Science, sample smoothly across available sub-disciplines while
    // respecting freshness priority.
    if (row.area === 'Medical Science' && need > 0) {
      selected.push(...pickMedicalBalanced(pool, need, seenIds));
    } else {
      selected.push(...pickWithFreshness(pool, need, seenIds));
    }
  });

  // Order by official exam flow: Medical Science first, then Bangla, English, BD, Intl, Math, Mental Ability
  // (already ordered by EXAM_BLUEPRINT; each section itself is Fisher–Yates shuffled).
  const totalCount = selected.length;
  const durationSeconds =
    totalCount === FULL_EXAM_QUESTIONS
      ? 120 * 60
      : Math.max(60, Math.round(totalCount * SECONDS_PER_QUESTION));

  let scaledNote: string | undefined;
  if (totalCount < FULL_EXAM_QUESTIONS) {
    scaledNote = `Scaled proportionally to ${totalCount} MCQs (official 200-mark proportions preserved; add more files to ./raw_questions/ to reach full 200 MCQs).`;
  }

  return {
    sessionId: makeSessionId(),
    mode: 'Full 200',
    title:
      totalCount === FULL_EXAM_QUESTIONS
        ? '51st Special BCS Full Mock Exam (200 MCQs)'
        : `51st Special BCS Scaled Mock Exam (${totalCount} MCQs)`,
    questions: toSessionQuestions(selected),
    durationSeconds,
    startedAt: Date.now(),
    answers: {},
    marked: {},
    currentIndex: 0,
    scaledNote,
  };
}

/**
 * Draws `need` Medical questions evenly across the 12 MBBS subjects that exist
 * in `pool`, prioritizing unseen questions first.
 */
function pickMedicalBalanced(pool: Question[], need: number, seenIds: Set<string>): Question[] {
  if (pool.length <= need) {
    return shuffle(pool);
  }
  const bySubject = new Map<string, Question[]>();
  for (const subj of MEDICAL_SUBJECTS) {
    const list = pool.filter((q) => q.subject === subj);
    if (list.length > 0) {
      const fresh = shuffle(list.filter((q) => !seenIds.has(q.id)));
      const seen = shuffle(list.filter((q) => seenIds.has(q.id)));
      bySubject.set(subj, [...fresh, ...seen]);
    }
  }

  const chosen: Question[] = [];
  const chosenIds = new Set<string>();
  const activeSubjects = shuffle(Array.from(bySubject.keys()));

  // Round-robin pass ensuring every MBBS sub-discipline gets fair representation
  let madeProgress = true;
  while (chosen.length < need && madeProgress) {
    madeProgress = false;
    for (const subj of activeSubjects) {
      if (chosen.length >= need) break;
      const list = bySubject.get(subj);
      if (list && list.length > 0) {
        const next = list.shift()!;
        chosen.push(next);
        chosenIds.add(next.id);
        madeProgress = true;
      }
    }
  }

  if (chosen.length < need) {
    const remaining = pickWithFreshness(
      pool.filter((q) => !chosenIds.has(q.id)),
      need - chosen.length,
      seenIds
    );
    chosen.push(...remaining);
  }

  return shuffle(chosen);
}

export function generateSubjectPracticeSession(
  bank: Question[],
  subjects: Subject[],
  requestedCount: number,
  lastAttempt?: AttemptRecord | null,
  customTitle?: string
): ExamSession {
  const seenIds = new Set<string>(lastAttempt?.questionIds ?? []);
  const allowed = new Set<string>(subjects);
  const pool = bank.filter((q) => allowed.has(q.subject));
  const picked = pickWithFreshness(pool, requestedCount, seenIds);
  const title =
    customTitle ??
    (subjects.length === 1
      ? `${subjects[0]} Practice (${picked.length} MCQs)`
      : `Targeted Practice (${picked.length} MCQs)`);

  return {
    sessionId: makeSessionId(),
    mode: 'Subject Practice',
    title,
    questions: toSessionQuestions(picked),
    durationSeconds: Math.max(60, Math.round(picked.length * SECONDS_PER_QUESTION)),
    startedAt: Date.now(),
    answers: {},
    marked: {},
    currentIndex: 0,
  };
}

export function generateCustomPackSession(
  pool: Question[],
  requestedCount: number,
  lastAttempt?: AttemptRecord | null,
  customTitle?: string,
  shuffleQuestions: boolean = true
): ExamSession {
  const seenIds = new Set<string>(lastAttempt?.questionIds ?? []);
  const targetCount = Math.min(Math.max(1, requestedCount), pool.length);
  const picked = shuffleQuestions
    ? pickWithFreshness(pool, targetCount, seenIds)
    : pool.slice(0, targetCount);

  return {
    sessionId: makeSessionId(),
    mode: 'Custom Pack',
    title: customTitle ?? `Custom Pack Practice (${picked.length} MCQs)`,
    questions: toSessionQuestions(picked),
    durationSeconds: Math.max(60, Math.round(picked.length * SECONDS_PER_QUESTION)),
    startedAt: Date.now(),
    answers: {},
    marked: {},
    currentIndex: 0,
  };
}

export function generateRetakeSameSession(
  bank: Question[],
  attempt: AttemptRecord
): ExamSession {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const ordered = attempt.questionIds
    .map((id) => byId.get(id))
    .filter((q): q is Question => Boolean(q));

  // Keep the same questionIds set, freshly shuffle options so A/B/C/D cannot be memorized
  return {
    sessionId: makeSessionId(),
    mode: 'Retake Same',
    title: `Retake: ${attempt.title || attempt.mode}`,
    sourceAttemptId: attempt.attemptId,
    questions: toSessionQuestions(ordered),
    durationSeconds:
      attempt.durationSeconds > 0
        ? attempt.durationSeconds
        : Math.max(60, Math.round(ordered.length * SECONDS_PER_QUESTION)),
    startedAt: Date.now(),
    answers: {},
    marked: {},
    currentIndex: 0,
  };
}

export function generateRetryWrongSession(
  bank: Question[],
  attempt: AttemptRecord
): ExamSession {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const missed: Question[] = [];
  for (const qid of attempt.questionIds) {
    const q = byId.get(qid);
    if (!q) continue;
    const chosen = attempt.userAnswers[qid];
    if (chosen === undefined || chosen !== q.correctIndex) {
      missed.push(q);
    }
  }
  const shuffledMissed = shuffle(missed);
  return {
    sessionId: makeSessionId(),
    mode: 'Retry Wrong',
    title: `Retry Wrong & Skipped (${shuffledMissed.length} MCQs)`,
    sourceAttemptId: attempt.attemptId,
    questions: toSessionQuestions(shuffledMissed),
    durationSeconds: Math.max(60, Math.round(shuffledMissed.length * SECONDS_PER_QUESTION)),
    startedAt: Date.now(),
    answers: {},
    marked: {},
    currentIndex: 0,
  };
}

export function roundScore(val: number): number {
  return Math.round(val * 100) / 100;
}

export function formatScore(val: number): string {
  return roundScore(val).toFixed(2);
}

export function formatDelta(val: number): string {
  const r = roundScore(val);
  const sign = r > 0 ? '+' : '';
  return `${sign}${r.toFixed(2)}`;
}

export function scoreAttempt(
  session: ExamSession,
  bank: Question[],
  timeSpentSeconds: number
): AttemptRecord {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const subjectBreakdown: Record<string, SubjectStats> = {};

  let totalAttempted = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  for (const sq of session.questions) {
    const q = byId.get(sq.id);
    if (!q) continue;

    if (!subjectBreakdown[q.subject]) {
      subjectBreakdown[q.subject] = {
        total: 0,
        attempted: 0,
        correct: 0,
        wrong: 0,
        netScore: 0,
        accuracyPct: 0,
      };
    }
    const st = subjectBreakdown[q.subject];
    st.total += 1;

    const chosen = session.answers[sq.id];
    if (chosen === undefined) {
      unansweredCount += 1;
    } else {
      totalAttempted += 1;
      st.attempted += 1;
      if (chosen === q.correctIndex) {
        correctCount += 1;
        st.correct += 1;
      } else {
        wrongCount += 1;
        st.wrong += 1;
      }
    }
  }

  for (const st of Object.values(subjectBreakdown)) {
    st.netScore = roundScore(st.correct * MARK_CORRECT + st.wrong * MARK_WRONG);
    st.accuracyPct = st.attempted > 0 ? roundScore((st.correct / st.attempted) * 100) : 0;
  }

  const negativeMarks = roundScore(wrongCount * Math.abs(MARK_WRONG));
  const netScore = roundScore(correctCount * MARK_CORRECT - negativeMarks);

  return {
    attemptId: makeAttemptId(),
    timestamp: Date.now(),
    mode: session.mode,
    title: session.title,
    sourceAttemptId: session.sourceAttemptId,
    questionIds: session.questions.map((q) => q.id),
    userAnswers: { ...session.answers },
    totalQuestions: session.questions.length,
    totalAttempted,
    correctCount,
    wrongCount,
    unansweredCount,
    negativeMarks,
    netScore,
    maxScore: session.questions.length,
    timeSpentSeconds: Math.max(0, Math.min(session.durationSeconds, Math.round(timeSpentSeconds))),
    durationSeconds: session.durationSeconds,
    subjectBreakdown,
  };
}

/** Aggregate per-subject SubjectStats into the 7 official 51st BCS exam areas. */
export function aggregateByArea(
  subjectBreakdown: Record<string, SubjectStats>
): Record<ExamArea, SubjectStats> {
  const result = {} as Record<ExamArea, SubjectStats>;
  for (const area of EXAM_AREAS) {
    result[area] = {
      total: 0,
      attempted: 0,
      correct: 0,
      wrong: 0,
      netScore: 0,
      accuracyPct: 0,
    };
  }
  for (const [subj, st] of Object.entries(subjectBreakdown)) {
    const area = areaOfSubject(subj);
    const agg = result[area];
    if (!agg) continue;
    agg.total += st.total;
    agg.attempted += st.attempted;
    agg.correct += st.correct;
    agg.wrong += st.wrong;
  }
  for (const area of EXAM_AREAS) {
    const agg = result[area];
    agg.netScore = roundScore(agg.correct * MARK_CORRECT + agg.wrong * MARK_WRONG);
    agg.accuracyPct = agg.attempted > 0 ? roundScore((agg.correct / agg.attempted) * 100) : 0;
  }
  return result;
}

export interface ComparisonRow {
  label: string;
  a: SubjectStats;
  b: SubjectStats;
  netDelta: number;
  accuracyDelta: number;
  correctDelta: number;
  wrongDelta: number;
}

export interface AttemptComparison {
  attemptA: AttemptRecord;
  attemptB: AttemptRecord;
  netScoreDelta: number;
  accuracyDelta: number;
  negativeMarksDelta: number;
  correctDelta: number;
  wrongDelta: number;
  areaRows: ComparisonRow[];
  medicalSubRows: ComparisonRow[];
}

function emptyStats(): SubjectStats {
  return { total: 0, attempted: 0, correct: 0, wrong: 0, netScore: 0, accuracyPct: 0 };
}

export function compareAttempts(a: AttemptRecord, b: AttemptRecord): AttemptComparison {
  const areaA = aggregateByArea(a.subjectBreakdown);
  const areaB = aggregateByArea(b.subjectBreakdown);

  const areaRows: ComparisonRow[] = EXAM_AREAS.map((area) => {
    const sa = areaA[area] ?? emptyStats();
    const sb = areaB[area] ?? emptyStats();
    return {
      label: area,
      a: sa,
      b: sb,
      netDelta: roundScore(sb.netScore - sa.netScore),
      accuracyDelta: roundScore(sb.accuracyPct - sa.accuracyPct),
      correctDelta: sb.correct - sa.correct,
      wrongDelta: sb.wrong - sa.wrong,
    };
  });

  const medicalSubRows: ComparisonRow[] = MEDICAL_SUBJECTS.map((subj) => {
    const sa = a.subjectBreakdown[subj] ?? emptyStats();
    const sb = b.subjectBreakdown[subj] ?? emptyStats();
    return {
      label: subj,
      a: sa,
      b: sb,
      netDelta: roundScore(sb.netScore - sa.netScore),
      accuracyDelta: roundScore(sb.accuracyPct - sa.accuracyPct),
      correctDelta: sb.correct - sa.correct,
      wrongDelta: sb.wrong - sa.wrong,
    };
  }).filter((row) => row.a.total > 0 || row.b.total > 0);

  const accA = a.totalAttempted > 0 ? (a.correctCount / a.totalAttempted) * 100 : 0;
  const accB = b.totalAttempted > 0 ? (b.correctCount / b.totalAttempted) * 100 : 0;

  return {
    attemptA: a,
    attemptB: b,
    netScoreDelta: roundScore(b.netScore - a.netScore),
    accuracyDelta: roundScore(accB - accA),
    negativeMarksDelta: roundScore(b.negativeMarks - a.negativeMarks),
    correctDelta: b.correctCount - a.correctCount,
    wrongDelta: b.wrongCount - a.wrongCount,
    areaRows,
    medicalSubRows,
  };
}

export function getBankCountsBySubject(bank: Question[]): Record<Subject, number> {
  const counts = {} as Record<Subject, number>;
  for (const s of ALL_SUBJECTS) counts[s] = 0;
  for (const q of bank) {
    if (q.subject in counts) {
      counts[q.subject] += 1;
    }
  }
  return counts;
}

export function getModeBadgeColor(mode: AttemptMode): string {
  switch (mode) {
    case 'Full 200':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Retake Same':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'Retry Wrong':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Subject Practice':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    case 'Custom Pack':
      return 'bg-teal-50 text-teal-800 border-teal-200';
  }
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

