import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { useUpdateStatus } from './useUpdateStatus';

/**
 * 首页更新提示。
 *
 * 只在“确实有新版本”时出现；检查失败、没有网络、没有版本标签都不打扰老人。
 * 点击只打开 GitHub Release 页面，不做软件内下载/安装。
 */
export function UpdateBanner() {
  const { status, open } = useUpdateStatus();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !status || status.state !== 'available') return null;

  return (
    <aside className="update-banner" role="status" aria-labelledby="update-banner-title">
      <span className="update-banner__icon" aria-hidden="true">
        <Icon name="sparkle" size={30} />
      </span>
      <div className="update-banner__body">
        <strong id="update-banner-title">有新版本 {status.latestVersion}</strong>
        <p>
          现在是 {status.currentVersion}。可以让家里人帮忙更新；点下面去 GitHub 看说明。
        </p>
      </div>
      <div className="update-banner__actions">
        <button type="button" className="update-banner__button" onClick={() => void open()}>
          去 GitHub 看看
        </button>
        <button
          type="button"
          className="update-banner__dismiss"
          onClick={() => setDismissed(true)}
        >
          以后再说
        </button>
      </div>
    </aside>
  );
}
