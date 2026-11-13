// Domain model for the 51st Special BCS (Health) — Assistant Surgeon (MBBS) exam.
// Scope is deliberately limited to the MBBS post: no Dental (BDS) subjects, no
// general-BCS written modes, no other cadres.

export const MEDICAL_SUBJECTS = [
  'Medicine',
  'Surgery',
  'Gynaecology & Obstetrics',
  'Anatomy',
  'Physiology',
  'Biochemistry',
  'Pathology',
  'Pharmacology',
  'Microbiology',
  'Forensic Medicine',
  'Community Medicine',
  'Pediatrics',
] as const;

export const GENERAL_SUBJECTS = [
  'Bangla',
  'English',
  'Bangladesh Affairs',
  'International Affairs',
  'Mathematical Reasoning',
  'Mental Ability',
] as const;

export type MedicalSubject = (typeof MEDICAL_SUBJECTS)[number];
export type GeneralSubject = (typeof GENERAL_SUBJECTS)[number];
export type Subject = MedicalSubject | GeneralSubject;
export type Part = 'Medical' | 'General';

export const ALL_SUBJECTS: Subject[] = [...MEDICAL_SUBJECTS, ...GENERAL_SUBJECTS];

export interface Question {
  id: string;
  part: Part;
  subject: Subject;
  topic?: string;
  customPack?: string;
  sourceExam: string;
  question: string;
  options: [string, string, string, string] | string[];
  correctIndex: number; // 0-3, index into the ORIGINAL options[] order
  explanation: string;
}

/** The 7 scored areas of the 51st Special BCS MCQ paper (200 marks). */
export type ExamArea =
  | 'Medical Science'
  | 'Bangla'
  | 'English'
  | 'Bangladesh Affairs'
  | 'International Affairs'
  | 'Mathematical Reasoning'
  | 'Mental Ability';

export interface BlueprintRow {
  area: ExamArea;
  subjects: Subject[];
  count: number;
}

/** Official BPSC 51st Special BCS (Assistant Surgeon) mark distribution. */
export const EXAM_BLUEPRINT: BlueprintRow[] = [
  { area: 'Medical Science', subjects: [...MEDICAL_SUBJECTS], count: 100 },
  { area: 'Bangla', subjects: ['Bangla'], count: 20 },
  { area: 'English', subjects: ['English'], count: 20 },
  { area: 'Bangladesh Affairs', subjects: ['Bangladesh Affairs'], count: 20 },
  { area: 'International Affairs', subjects: ['International Affairs'], count: 20 },
  { area: 'Mathematical Reasoning', subjects: ['Mathematical Reasoning'], count: 10 },
  { area: 'Mental Ability', subjects: ['Mental Ability'], count: 10 },
];

export const EXAM_AREAS: ExamArea[] = EXAM_BLUEPRINT.map((r) => r.area);
export const FULL_EXAM_QUESTIONS = 200;
export const FULL_EXAM_SECONDS = 120 * 60;
export const SECONDS_PER_QUESTION = FULL_EXAM_SECONDS / FULL_EXAM_QUESTIONS; // 36 s
export const MARK_CORRECT = 1;
export const MARK_WRONG = -0.5;

export function areaOfSubject(subject: Subject | string): ExamArea {
  if ((MEDICAL_SUBJECTS as readonly string[]).includes(subject)) return 'Medical Science';
  return subject as ExamArea;
}

export type AttemptMode = 'Full 200' | 'Subject Practice' | 'Custom Pack' | 'Retake Same' | 'Retry Wrong';

export interface SubjectStats {
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  netScore: number;
  accuracyPct: number; // correct / attempted * 100 (0 if nothing attempted)
}

export interface AttemptRecord {
  attemptId: string;
  timestamp: number; // ms epoch (submission time)
  mode: AttemptMode;
  title?: string;
  sourceAttemptId?: string; // for Retake Same / Retry Wrong
  questionIds: string[];
  /** questionId -> chosen ORIGINAL option index (shuffle-independent). Missing = unanswered. */
  userAnswers: Record<string, number>;
  totalQuestions: number;
  totalAttempted: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  negativeMarks: number; // positive number, e.g. 7.5 means 7.5 marks deducted
  netScore: number;
  maxScore: number;
  timeSpentSeconds: number;
  durationSeconds: number;
  subjectBreakdown: Record<string, SubjectStats>;
}

/** One question as rendered in a running exam (options shuffled per attempt). */
export interface SessionQuestion {
  id: string;
  /** order[displayIndex] = original option index */
  order: number[];
}

export interface ExamSession {
  sessionId: string;
  mode: AttemptMode;
  title: string;
  sourceAttemptId?: string;
  questions: SessionQuestion[];
  durationSeconds: number;
  startedAt: number;
  answers: Record<string, number>; // questionId -> original option index
  marked: Record<string, boolean>;
  currentIndex: number;
  scaledNote?: string;
}

