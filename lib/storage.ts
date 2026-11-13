'use client';

import type { Puter, User } from '@heyputer/puter.js';
import { AttemptRecord, ExamSession } from './types';

export const PUTER_KV_KEY = 'bcs_51_asst_surgeon_attempts';
export const LOCAL_ATTEMPTS_KEY = 'bcs_51_asst_surgeon_attempts';
export const LOCAL_SESSION_KEY = 'bcs_51_asst_surgeon_active_session';

let cachedPuter: Puter | null = null;

/**
 * Dynamically loads `@heyputer/puter.js` strictly in the browser and guards
 * `window.puter` so static export / SSR never touches browser globals.
 */
export async function getBrowserPuter(): Promise<Puter | null> {
  if (typeof window === 'undefined') return null;
  if (window.puter) {
    cachedPuter = window.puter;
    return cachedPuter;
  }
  if (cachedPuter) return cachedPuter;
  try {
    const mod = await import('@heyputer/puter.js');
    const instance = mod.puter || mod.default || window.puter || null;
    if (instance) {
      cachedPuter = instance;
      window.puter = instance;
    }
    return cachedPuter;
  } catch {
    return null;
  }
}

export function readLocalAttempts(): AttemptRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortAttempts(parsed) : [];
  } catch {
    return [];
  }
}

export function writeLocalAttempts(attempts: AttemptRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify(sortAttempts(attempts)));
  } catch {
    // Ignore quota errors cleanly
  }
}

export function sortAttempts(attempts: AttemptRecord[]): AttemptRecord[] {
  return [...attempts].sort((a, b) => b.timestamp - a.timestamp);
}

export function mergeAttemptLists(
  primary: AttemptRecord[],
  secondary: AttemptRecord[]
): AttemptRecord[] {
  const byId = new Map<string, AttemptRecord>();
  for (const item of [...secondary, ...primary]) {
    if (item && item.attemptId) {
      byId.set(item.attemptId, item);
    }
  }
  return sortAttempts(Array.from(byId.values()));
}

export interface PuterAuthStatus {
  available: boolean;
  signedIn: boolean;
  user: User | null;
}

export async function getPuterAuthStatus(): Promise<PuterAuthStatus> {
  const puter = await getBrowserPuter();
  if (!puter) {
    return { available: false, signedIn: false, user: null };
  }
  try {
    const signedIn = Boolean(puter.auth.isSignedIn());
    if (!signedIn) {
      return { available: true, signedIn: false, user: null };
    }
    const user = await puter.auth.getUser().catch(() => null);
    return { available: true, signedIn: true, user };
  } catch {
    return { available: true, signedIn: false, user: null };
  }
}

export async function signInWithPuter(): Promise<PuterAuthStatus> {
  const puter = await getBrowserPuter();
  if (!puter) {
    throw new Error('Puter SDK is only available in the browser.');
  }
  await puter.auth.signIn();
  const signedIn = Boolean(puter.auth.isSignedIn());
  const user = signedIn ? await puter.auth.getUser().catch(() => null) : null;
  return { available: true, signedIn, user };
}

export async function signOutFromPuter(): Promise<void> {
  const puter = await getBrowserPuter();
  if (!puter) return;
  try {
    await puter.auth.signOut();
  } catch {
    // ignore
  }
}

async function readCloudAttempts(puter: Puter): Promise<AttemptRecord[]> {
  const raw = await puter.kv.get<string | AttemptRecord[]>(PUTER_KV_KEY);
  if (!raw) return [];
  if (typeof raw === 'string') {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortAttempts(parsed) : [];
  }
  return Array.isArray(raw) ? sortAttempts(raw) : [];
}

async function writeCloudAttempts(puter: Puter, attempts: AttemptRecord[]): Promise<void> {
  // Store serialized JSON string in Puter KV for predictable cross-environment behavior
  await puter.kv.set(PUTER_KV_KEY, JSON.stringify(sortAttempts(attempts)));
}

/**
 * Loads attempt history: if signed into Puter, merges any guest localStorage
 * records into Puter KV and caches the merged list locally.
 */
export async function loadAllAttempts(): Promise<{
  attempts: AttemptRecord[];
  syncedToCloud: boolean;
}> {
  const local = readLocalAttempts();
  const puter = await getBrowserPuter();
  if (!puter) {
    return { attempts: local, syncedToCloud: false };
  }
  try {
    if (!puter.auth.isSignedIn()) {
      return { attempts: local, syncedToCloud: false };
    }
    const cloud = await readCloudAttempts(puter);
    const merged = mergeAttemptLists(cloud, local);
    if (merged.length !== cloud.length) {
      await writeCloudAttempts(puter, merged);
    }
    writeLocalAttempts(merged);
    return { attempts: merged, syncedToCloud: true };
  } catch {
    return { attempts: local, syncedToCloud: false };
  }
}

export async function persistAttempt(record: AttemptRecord): Promise<{
  attempts: AttemptRecord[];
  syncedToCloud: boolean;
}> {
  const local = readLocalAttempts();
  const nextLocal = mergeAttemptLists([record], local);
  writeLocalAttempts(nextLocal);

  const puter = await getBrowserPuter();
  if (puter && puter.auth.isSignedIn()) {
    try {
      const cloud = await readCloudAttempts(puter);
      const merged = mergeAttemptLists([record], mergeAttemptLists(cloud, nextLocal));
      await writeCloudAttempts(puter, merged);
      writeLocalAttempts(merged);
      return { attempts: merged, syncedToCloud: true };
    } catch {
      return { attempts: nextLocal, syncedToCloud: false };
    }
  }
  return { attempts: nextLocal, syncedToCloud: false };
}

export async function removeAttemptById(attemptId: string): Promise<{
  attempts: AttemptRecord[];
  syncedToCloud: boolean;
}> {
  const nextLocal = readLocalAttempts().filter((a) => a.attemptId !== attemptId);
  writeLocalAttempts(nextLocal);

  const puter = await getBrowserPuter();
  if (puter && puter.auth.isSignedIn()) {
    try {
      const cloud = await readCloudAttempts(puter);
      const nextCloud = cloud.filter((a) => a.attemptId !== attemptId);
      await writeCloudAttempts(puter, nextCloud);
      return { attempts: nextCloud, syncedToCloud: true };
    } catch {
      return { attempts: nextLocal, syncedToCloud: false };
    }
  }
  return { attempts: nextLocal, syncedToCloud: false };
}

export function saveActiveSession(session: ExamSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function loadActiveSession(): ExamSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExamSession;
    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch {
    // ignore
  }
}

