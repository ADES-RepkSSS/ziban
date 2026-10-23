/**
 * 页面侧读取桌面取词状态的 hooks。
 *
 * 浏览器里 bridge=null，所有方法都变成 no-op/空状态；页面据此显示降级文案，
 * 不把“网页版做不到”说成“功能坏了”。
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  DesktopConfigPatch,
  DesktopPublicConfig,
  DesktopScreenStatus,
  ScreenLookupPayload,
} from '@ziban/core';
import { getDesktopBridge } from '../../capabilities/desktop';

export interface ScreenStatusState {
  bridge: ReturnType<typeof getDesktopBridge>;
  status: DesktopScreenStatus | null;
  config: DesktopPublicConfig | null;
  busy: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  refresh: () => Promise<DesktopScreenStatus | null>;
  start: () => Promise<DesktopScreenStatus | null>;
  stop: () => Promise<DesktopScreenStatus | null>;
  requestPermission: () => Promise<DesktopScreenStatus | null>;
  updateConfig: (patch: DesktopConfigPatch) => Promise<DesktopPublicConfig | null>;
  lookupNow: () => Promise<ScreenLookupPayload | null>;
  testLlm: () => Promise<{ ok: boolean; message: string; latencyMs: number | null } | null>;
  clearCache: () => Promise<number | null>;
}

export function useScreenStatus(): ScreenStatusState {
  const bridge = getDesktopBridge();
  const [status, setStatus] = useState<DesktopScreenStatus | null>(null);
  const [config, setConfig] = useState<DesktopPublicConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<DesktopScreenStatus | null> => {
    if (!bridge) return null;
    try {
      const [nextStatus, nextConfig] = await Promise.all([bridge.getStatus(), bridge.getConfig()]);
      setStatus(nextStatus);
      setConfig(nextConfig);
      return nextStatus;
    } catch {
      setError('拿不到看屏幕的状态；可以回首页再进来。');
      return null;
    }
  }, [bridge]);

  useEffect(() => {
    if (!bridge) return;
    void refresh();
    const offStatus = bridge.onStatus(setStatus);
    const offConfig = bridge.onConfig(setConfig);
    return () => {
      offStatus();
      offConfig();
    };
  }, [bridge, refresh]);

  const start = useCallback(async () => {
    if (!bridge) return null;
    setBusy(true);
    setError(null);
    try {
      const next = await bridge.startHover();
      setStatus(next);
      if (next.hint) setError(next.hint);
      return next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '这次没打开，再试一下。');
      return null;
    } finally {
      setBusy(false);
    }
  }, [bridge]);

  const stop = useCallback(async () => {
    if (!bridge) return null;
    setBusy(true);
    try {
      const next = await bridge.stopHover();
      setStatus(next);
      return next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '这次没停下来，再试一下。');
      return null;
    } finally {
      setBusy(false);
    }
  }, [bridge]);

  const requestPermission = useCallback(async () => {
    if (!bridge) return null;
    setBusy(true);
    setError(null);
    try {
      const next = await bridge.requestScreenPermission();
      setStatus(next);
      if (next.hint) setError(next.hint);
      return next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '系统设置没打开，再试一下。');
      return null;
    } finally {
      setBusy(false);
    }
  }, [bridge]);

  const updateConfig = useCallback(
    async (patch: DesktopConfigPatch) => {
      if (!bridge) return null;
      setBusy(true);
      setError(null);
      try {
        const next = await bridge.updateConfig(patch);
        setConfig(next);
        return next;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '这次没存上，再试一下。');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [bridge],
  );

  const lookupNow = useCallback(async () => {
    if (!bridge) return null;
    setBusy(true);
    setError(null);
    try {
      const payload = await bridge.lookupAtCursor();
      if (payload.status === 'error' && payload.message) setError(payload.message);
      return payload;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '这次没看清，再试一下。');
      return null;
    } finally {
      setBusy(false);
    }
  }, [bridge]);

  const testLlm = useCallback(async () => {
    if (!bridge) return null;
    setBusy(true);
    try {
      return await bridge.testLlm();
    } catch (reason) {
      return {
        ok: false,
        message: reason instanceof Error ? reason.message : '没连上',
        latencyMs: null,
      };
    } finally {
      setBusy(false);
    }
  }, [bridge]);

  const clearCache = useCallback(async () => {
    if (!bridge) return null;
    try {
      return await bridge.clearCache();
    } catch {
      return null;
    }
  }, [bridge]);

  return {
    bridge,
    status,
    config,
    busy,
    error,
    setError,
    refresh,
    start,
    stop,
    requestPermission,
    updateConfig,
    lookupNow,
    testLlm,
    clearCache,
  };
}

/** 把 Electron 的快捷键显示成老人/家人看得懂的写法。 */
export function displayHotkey(accelerator: string, platform: string | undefined): string {
  const isMac = platform === 'darwin';
  return accelerator
    .replace('CommandOrControl', isMac ? '⌘' : 'Ctrl')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace(/\+/g, isMac ? '' : '+');
}
