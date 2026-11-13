'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@heyputer/puter.js';
import {
  generateCustomPackSession,
  generateFullExamSession,
  generateRetakeSameSession,
  generateRetryWrongSession,
  generateSubjectPracticeSession,
  loadQuestionBank,
} from '@/lib/examEngine';
import {
  clearActiveSession,
  getPuterAuthStatus,
  loadActiveSession,
  loadAllAttempts,
  persistAttempt,
  readLocalAttempts,
  removeAttemptById,
  saveActiveSession,
  signInWithPuter,
  signOutFromPuter,
} from '@/lib/storage';
import { AttemptRecord, ExamSession, Question, Subject } from '@/lib/types';

interface AppContextValue {
  bank: Question[];
  bankLoading: boolean;
  bankError: string | null;
  attempts: AttemptRecord[];
  attemptsLoading: boolean;
  activeSession: ExamSession | null;
  authAvailable: boolean;
  isSignedIn: boolean;
  authUser: User | null;
  syncedToCloud: boolean;
  authBusy: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAttempts: () => Promise<void>;
  recordAttempt: (attempt: AttemptRecord) => Promise<void>;
  deleteAttempt: (attemptId: string) => Promise<void>;
  updateActiveSession: (
    updater: ExamSession | null | ((prev: ExamSession | null) => ExamSession | null)
  ) => void;
  startFullExam: () => ExamSession | null;
  startSubjectPractice: (subjects: Subject[], count: number, title?: string) => ExamSession | null;
  startCustomPractice: (
    pool: Question[],
    count: number,
    title: string,
    shuffleQuestions?: boolean
  ) => ExamSession | null;
  startRetakeSame: (attempt: AttemptRecord) => ExamSession | null;
  startRetryWrong: (attempt: AttemptRecord) => ExamSession | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function PuterProvider({ children }: { children: React.ReactNode }) {
  const [bank, setBank] = useState<Question[]>([]);
  const [bankLoading, setBankLoading] = useState(true);
  const [bankError, setBankError] = useState<string | null>(null);

  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(true);
  const [activeSession, setActiveSessionState] = useState<ExamSession | null>(null);
  const activeSessionRef = useRef<ExamSession | null>(null);

  const [authAvailable, setAuthAvailable] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [syncedToCloud, setSyncedToCloud] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshAttempts = useCallback(async () => {
    setAttemptsLoading(true);
    try {
      const res = await loadAllAttempts();
      setAttempts(res.attempts);
      setSyncedToCloud(res.syncedToCloud);
    } finally {
      setAttemptsLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    // Load local attempts and active session immediately for fast initial paint
    setAttempts(readLocalAttempts());
    const storedSession = loadActiveSession();
    activeSessionRef.current = storedSession;
    setActiveSessionState(storedSession);

    loadQuestionBank()
      .then((qs) => {
        if (!alive) return;
        setBank(qs);
        setBankError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setBankError(err instanceof Error ? err.message : 'Unable to load question bank');
      })
      .finally(() => {
        if (alive) setBankLoading(false);
      });

    (async () => {
      const status = await getPuterAuthStatus();
      if (!alive) return;
      setAuthAvailable(status.available);
      setIsSignedIn(status.signedIn);
      setAuthUser(status.user);
      const loaded = await loadAllAttempts();
      if (!alive) return;
      setAttempts(loaded.attempts);
      setSyncedToCloud(loaded.syncedToCloud);
      setAttemptsLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const status = await signInWithPuter();
      setAuthAvailable(status.available);
      setIsSignedIn(status.signedIn);
      setAuthUser(status.user);
      // Automatically merge guest localStorage history into Puter KV upon sign-in
      await refreshAttempts();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Puter sign-in cancelled or failed.');
    } finally {
      setAuthBusy(false);
    }
  }, [refreshAttempts]);

  const signOut = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signOutFromPuter();
      setIsSignedIn(false);
      setAuthUser(null);
      setSyncedToCloud(false);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const updateActiveSession = useCallback(
    (updater: ExamSession | null | ((prev: ExamSession | null) => ExamSession | null)) => {
      const next =
        typeof updater === 'function' ? updater(activeSessionRef.current) : updater;
      activeSessionRef.current = next;
      setActiveSessionState(next);
      if (next) {
        saveActiveSession(next);
      } else {
        clearActiveSession();
      }
    },
    []
  );

  const recordAttempt = useCallback(
    async (attempt: AttemptRecord) => {
      clearActiveSession();
      activeSessionRef.current = null;
      setActiveSessionState(null);
      const res = await persistAttempt(attempt);
      setAttempts(res.attempts);
      setSyncedToCloud(res.syncedToCloud);
    },
    []
  );

  const deleteAttempt = useCallback(async (attemptId: string) => {
    const res = await removeAttemptById(attemptId);
    setAttempts(res.attempts);
    setSyncedToCloud(res.syncedToCloud);
  }, []);

  const startFullExam = useCallback(() => {
    if (bank.length === 0) return null;
    const lastAttempt = attempts[0] ?? null;
    const session = generateFullExamSession(bank, lastAttempt);
    updateActiveSession(session);
    return session;
  }, [attempts, bank, updateActiveSession]);

  const startSubjectPractice = useCallback(
    (subjects: Subject[], count: number, title?: string) => {
      if (bank.length === 0 || subjects.length === 0) return null;
      const lastAttempt = attempts[0] ?? null;
      const session = generateSubjectPracticeSession(bank, subjects, count, lastAttempt, title);
      if (session.questions.length === 0) return null;
      updateActiveSession(session);
      return session;
    },
    [attempts, bank, updateActiveSession]
  );

  const startCustomPractice = useCallback(
    (pool: Question[], count: number, title: string, shuffleQuestions: boolean = true) => {
      if (pool.length === 0) return null;
      const lastAttempt = attempts[0] ?? null;
      const session = generateCustomPackSession(pool, count, lastAttempt, title, shuffleQuestions);
      if (session.questions.length === 0) return null;
      updateActiveSession(session);
      return session;
    },
    [attempts, updateActiveSession]
  );

  const startRetakeSame = useCallback(
    (attempt: AttemptRecord) => {
      if (bank.length === 0) return null;
      const session = generateRetakeSameSession(bank, attempt);
      if (session.questions.length === 0) return null;
      updateActiveSession(session);
      return session;
    },
    [bank, updateActiveSession]
  );

  const startRetryWrong = useCallback(
    (attempt: AttemptRecord) => {
      if (bank.length === 0) return null;
      const session = generateRetryWrongSession(bank, attempt);
      if (session.questions.length === 0) return null;
      updateActiveSession(session);
      return session;
    },
    [bank, updateActiveSession]
  );

  return (
    <AppContext.Provider
      value={{
        bank,
        bankLoading,
        bankError,
        attempts,
        attemptsLoading,
        activeSession,
        authAvailable,
        isSignedIn,
        authUser,
        syncedToCloud,
        authBusy,
        authError,
        signIn,
        signOut,
        refreshAttempts,
        recordAttempt,
        deleteAttempt,
        updateActiveSession,
        startFullExam,
        startSubjectPractice,
        startCustomPractice,
        startRetakeSame,
        startRetryWrong,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used inside <PuterProvider>');
  }
  return ctx;
}

