import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createInitialProgress, type ProgressState } from '@ziban/core';
import { clearStoredProgress, readStoredProgress, saveProgress } from '../lib/storage';

/**
 * 学习进度的唯一来源。
 *
 * 纪律：
 * - 只写本机 localStorage（key: ziban.progress.v1），不经过任何网络；
 * - 每次 update 立即写盘，避免用户直接关窗口丢失进度；
 * - 旧数据/手改数据由 core.normalizeProgress 兜底，UI 不信任 localStorage 的形状。
 */
interface ProgressContextValue {
  progress: ProgressState;
  update: (updater: (previous: ProgressState) => ProgressState) => void;
  reset: () => void;
  storageOk: boolean;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressState>(readStoredProgress);
  const [storageOk, setStorageOk] = useState(true);

  const update = useCallback((updater: (previous: ProgressState) => ProgressState) => {
    setProgress((previous) => {
      const next = updater(previous);
      if (next === previous) return previous;
      const ok = saveProgress(next);
      setStorageOk(ok);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearStoredProgress();
    const fresh = createInitialProgress();
    saveProgress(fresh);
    setProgress(fresh);
    setStorageOk(true);
  }, []);

  const value = useMemo(
    () => ({ progress, update, reset, storageOk }),
    [progress, update, reset, storageOk],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext);
  if (!value) throw new Error('useProgress 必须在 ProgressProvider 内使用');
  return value;
}
