import { normalizeProgress, type ProgressState } from '@ziban/core';

export const STORAGE_KEY = 'ziban.progress.v1';
export const BROKEN_KEY = 'ziban.progress.broken.v1';

export function readStoredProgress(): ProgressState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeProgress(null);
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return normalizeProgress(null);
  }
}

export function saveProgress(progress: ProgressState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredProgress(): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) window.localStorage.setItem(BROKEN_KEY, raw.slice(0, 20_000));
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 本地存储不可用时，清空只影响当前会话。
  }
}
