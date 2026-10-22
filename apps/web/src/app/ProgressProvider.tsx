import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createInitialProgress, type ProgressState } from '@ziban/core';
import { clearStoredProgress, readStoredProgress, saveProgress } from '../lib/storage';

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
