import { useState } from 'react';
import { navigate } from '../../app/router';
import { displayHotkey, useScreenStatus } from './useScreenStatus';

/**
 * 首页“看屏幕”入口，放在所有工具的第一位。
 *
 * 桌面版：打开后光标停在哪就念哪。
 * 浏览器版：看不到别的软件，给一个明确的“先粘贴文字”出口，不假装能用。
 * 两边都用同一张特征图，方便不识字的老人按图找入口。
 */
export function ScreenLookupCard() {
  const { bridge, status, busy, error, start, stop, requestPermission, refresh } = useScreenStatus();
  const [notice, setNotice] = useState<string | null>(null);

  if (!bridge) {
    return (
      <section className="screen-callout screen-callout--browser" aria-labelledby="screen-callout-title">
        <span className="screen-callout__art" aria-hidden="true">
          <img src="./features/screen-lookup.svg" alt="" />
        </span>
        <div className="screen-callout__body">
          <span className="screen-callout__demo-badge">网页演示版 · 没有屏幕取词</span>
          <h2 id="screen-callout-title">看屏幕上的字</h2>
          <p>
            这个在线演示只能粘贴文字，不能读取别的软件。
            要鼠标停在哪就查哪，请用 Windows/macOS 桌面版。
          </p>
        </div>
        <div className="screen-callout__actions">
          <button
            type="button"
            className="screen-callout__button"
            onClick={() => navigate('#/helper')}
          >
            粘贴文字
          </button>
        </div>
      </section>
    );
  }

  const running = status?.hover ?? false;
  const permission = status?.permission ?? 'unknown';
  const ocrReady = status?.ocr.ready ?? false;
  const needsPermission =
    permission === 'denied' ||
    permission === 'restricted' ||
    permission === 'not-determined' ||
    permission === 'unknown';
  const hotkey = displayHotkey(
    status?.hotkeys.lookup ?? 'CommandOrControl+Shift+Z',
    bridge.platform,
  );

  const begin = async () => {
    setNotice(null);
    if (!ocrReady) {
      const next = await refresh();
      setNotice(next?.ocr.message ?? '这台电脑还没准备好认字。可以让家里人看一下设置。');
      return;
    }
    if (needsPermission && permission !== 'not-determined') {
      const next = await requestPermission();
      if (next?.permission === 'denied' || next?.permission === 'restricted') return;
      await start();
      return;
    }
    const next = await start();
    if (next?.hover) setNotice('已经开始看屏幕了。切到你要用的软件，把鼠标停在字上，停一下。');
  };

  return (
    <section
      className={`screen-callout ${running ? 'is-running' : ''}`}
      aria-labelledby="screen-callout-title"
    >
      <span className="screen-callout__art" aria-hidden="true">
        <img src="./features/screen-lookup.svg" alt="" />
      </span>
      <div className="screen-callout__body">
        <h2 id="screen-callout-title">看屏幕上的字</h2>
        <p>
          {running
            ? '正在看屏幕。切到你要用的软件，把鼠标放到不认识的字上，停一下，我就告诉你。'
            : '鼠标停在哪，我就念哪。不用选、不用按。'}
        </p>
        {needsPermission && !running ? (
          <p className="screen-callout__hint">
            {permission === 'denied' || permission === 'restricted'
              ? '系统现在没让字伴看屏幕；点下面“打开系统设置”，在屏幕录制里打开字伴。'
              : '第一次用，系统会问一次“能不能看屏幕”。选“允许”就好。'}
          </p>
        ) : null}
        {error ? (
          <p className="screen-callout__hint screen-callout__hint--warn" role="status">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="screen-callout__hint" role="status">
            {notice}
          </p>
        ) : null}
        {!running ? (
          <p className="screen-callout__hotkey">
            也可以按 <kbd>{hotkey}</kbd> 查鼠标下面的字
          </p>
        ) : null}
      </div>
      <div className="screen-callout__actions">
        {running ? (
          <button
            type="button"
            className="screen-callout__button screen-callout__button--stop"
            onClick={() => void stop()}
            disabled={busy}
          >
            暂停看屏幕
          </button>
        ) : (
          <button
            type="button"
            className="screen-callout__button"
            onClick={() => void begin()}
            disabled={busy}
          >
            {busy ? '正在准备…' : !status ? '正在准备…' : ocrReady ? '开始看屏幕' : '再试一次'}
          </button>
        )}
        {permission === 'denied' || permission === 'restricted' ? (
          <button
            type="button"
            className="screen-callout__link"
            onClick={() => void bridge.openSystemSettings('screen')}
          >
            打开系统设置
          </button>
        ) : null}
      </div>
    </section>
  );
}
