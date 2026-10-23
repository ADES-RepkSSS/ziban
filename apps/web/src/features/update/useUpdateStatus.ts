import { useCallback, useEffect, useState } from 'react';
import type { DesktopUpdateStatus } from '@ziban/core';
import { getDesktopBridge } from '../../capabilities/desktop';

/**
 * 主进程版本检查的只读订阅。
 * 检查本身由主进程在启动 3 秒后做，并把结果缓存 24 小时；UI 不主动联网。
 */
export function useUpdateStatus() {
  const bridge = getDesktopBridge();
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    void bridge
      .getUpdateStatus()
      .then((next) => {
        if (alive) setStatus(next);
      })
      .catch(() => undefined);
    const off = bridge.onUpdateStatus((next) => setStatus(next));
    return () => {
      alive = false;
      off();
    };
  }, [bridge]);

  const check = useCallback(async () => {
    if (!bridge || checking) return null;
    setChecking(true);
    try {
      const next = await bridge.checkForUpdates();
      setStatus(next);
      return next;
    } catch {
      return null;
    } finally {
      setChecking(false);
    }
  }, [bridge, checking]);

  const open = useCallback(async () => {
    if (!bridge) return;
    await bridge.openUpdatePage().catch(() => undefined);
  }, [bridge]);

  return { bridge, status, checking, check, open };
}
