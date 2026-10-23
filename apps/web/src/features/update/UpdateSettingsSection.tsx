import { useEffect, useState } from 'react';
import type { DesktopPublicConfig } from '@ziban/core';
import { Icon } from '../../components/Icon';
import { useUpdateStatus } from './useUpdateStatus';

/**
 * 设置页“版本”区。
 *
 * - 默认自动检查；关闭后下次启动不再访问 GitHub，当前这次也不会再请求；
 * - “检查更新”是手动动作，仍然只读 GitHub 公共信息；
 * - 不显示“软件内更新”按钮，避免让用户以为点了会自动装好。
 */
export function UpdateSettingsSection() {
  const { bridge, status, checking, check, open } = useUpdateStatus();
  const [config, setConfig] = useState<DesktopPublicConfig | null>(null);

  useEffect(() => {
    if (!bridge) return;
    void bridge
      .getConfig()
      .then(setConfig)
      .catch(() => undefined);
  }, [bridge]);

  if (!bridge || !config) return null;

  const toggleAuto = async () => {
    const next = await bridge.updateConfig({ checkUpdates: !config.checkUpdates }).catch(() => null);
    if (next) setConfig(next);
  };

  const versionLine =
    status?.state === 'available'
      ? `有新版 ${status.latestVersion}（现在是 ${status.currentVersion}）`
      : status?.state === 'checking' || checking
        ? '正在检查…'
        : status?.state === 'current'
          ? `已经是最新（${status.currentVersion}）`
          : status?.state === 'error'
            ? '暂时没连上 GitHub，不急。'
            : `当前 ${status?.currentVersion ?? '—'}`;

  return (
    <section className="settings-group update-settings" aria-labelledby="update-title">
      <div className="settings-group__head">
        <h2 id="update-title">版本</h2>
        <p>只看看 GitHub 上有没有新版本；不会自动下载，也不会自动安装。</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={config.checkUpdates}
        className="switch-row"
        onClick={() => void toggleAuto()}
      >
        <span className="switch-row__icon">
          <Icon name="replay" size={28} />
        </span>
        <span className="switch-row__text">
          <span className="switch-row__name">自动检查新版本</span>
          <span className="switch-row__meta">只访问 GitHub 公共信息；可以随时关掉。</span>
        </span>
        <span className={`switch ${config.checkUpdates ? 'is-on' : ''}`} aria-hidden="true">
          <span />
        </span>
      </button>

      <div className="update-settings__row">
        <span className="update-settings__version">{versionLine}</span>
        <button
          type="button"
          className="screen-toggle-button"
          onClick={() => void check()}
          disabled={checking}
        >
          {checking ? '正在查…' : '检查更新'}
        </button>
        {status?.state === 'available' ? (
          <button type="button" className="screen-toggle-button is-on" onClick={() => void open()}>
            去 GitHub
          </button>
        ) : null}
      </div>
    </section>
  );
}
