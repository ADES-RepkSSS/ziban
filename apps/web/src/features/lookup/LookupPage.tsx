import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  DesktopPublicConfig,
  DesktopScreenStatus,
  ScreenLookupPayload,
} from '@ziban/core';
import { useProgress } from '../../app/ProgressProvider';
import { useSpeech } from '../../app/SpeechProvider';
import { getDesktopBridge } from '../../capabilities/desktop';
import { Icon } from '../../components/Icon';

/**
 * 桌面版“光标取词”小窗。
 *
 * 这个页面只在 Electron 的 400px 悬浮窗里使用；浏览器直接打开会显示降级说明。
 * 数据全部由主进程通过 IPC 推送（见 preload.ts / main.ts）：
 * - status: loading / ready / empty / error
 * - knowledge: 本机字卡、语料库或大模型结果
 *
 * 交互原则：
 * - 字要大（词 42px、释义 27px），窗口要小；
 * - 自动只念“词 + 释义”，不自动念例句（和识字卡一致，避免一长串）；
 * - “念给我听”念全部；“收起”后鼠标不动就不再弹；
 * - 所有错误都不说“失败/错误”，只说“这次没看清，再试一下”。
 */
export function LookupPage() {
  const bridge = getDesktopBridge();
  const { speak, stop, speaking, activeSegment, error: speechError } = useSpeech();
  const { progress } = useProgress();
  const [payload, setPayload] = useState<ScreenLookupPayload | null>(null);
  const [status, setStatus] = useState<DesktopScreenStatus | null>(null);
  const [config, setConfig] = useState<DesktopPublicConfig | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [speechHint, setSpeechHint] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const spokenRequest = useRef<number>(-1);
  const resizeFrame = useRef<number | null>(null);

  const rate = progress.settings.rate;

  useEffect(() => {
    if (!bridge) return;
    document.documentElement.classList.add('lookup-window');
    document.body.classList.add('lookup-window');
    const offLookup = bridge.onLookup((next) => setPayload(next));
    const offStatus = bridge.onStatus((next) => setStatus(next));
    const offConfig = bridge.onConfig((next) => setConfig(next));
    void bridge.getStatus().then(setStatus).catch(() => undefined);
    void bridge.getConfig().then(setConfig).catch(() => undefined);
    void bridge.overlayReady().catch(() => undefined);
    return () => {
      document.documentElement.classList.remove('lookup-window');
      document.body.classList.remove('lookup-window');
      offLookup();
      offStatus();
      offConfig();
    };
  }, [bridge]);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    setSpeechHint(null);
  }, [payload?.requestId]);

  // 内容高度变化时通知主进程；小窗只长到够用，不占大半个屏幕。
  useLayoutEffect(() => {
    if (!bridge || !rootRef.current) return;
    const root = rootRef.current;
    const send = () => {
      const height = Math.ceil(root.getBoundingClientRect().height + 12);
      void bridge.resizeOverlay(height).catch(() => undefined);
    };
    send();
    const observer = new ResizeObserver(() => {
      if (resizeFrame.current !== null) cancelAnimationFrame(resizeFrame.current);
      resizeFrame.current = requestAnimationFrame(() => {
        resizeFrame.current = null;
        send();
      });
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      if (resizeFrame.current !== null) cancelAnimationFrame(resizeFrame.current);
    };
  }, [bridge, payload]);

  // 自动念：只念“词 + 释义”，不念例句；同一次查询只念一遍。
  useEffect(() => {
    if (!config?.autoSpeak) return;
    if (!payload || (payload.status !== 'ready' && payload.status !== 'empty') || !payload.target) {
      return;
    }
    if (spokenRequest.current === payload.requestId) return;
    spokenRequest.current = payload.requestId;
    const word = payload.target.text;
    const definition = payload.knowledge?.definition;
    const timer = window.setTimeout(() => {
      speak({
        text: definition ? `${word}。${definition}` : word,
        segmentId: `lookup-auto-${payload.requestId}`,
        rate,
      });
    }, 260);
    return () => window.clearTimeout(timer);
  }, [payload, config?.autoSpeak, speak, rate]);

  const speakAll = useCallback(() => {
    if (!payload?.target) return;
    const parts = [
      payload.target.text,
      payload.knowledge?.definition ?? '',
      payload.knowledge?.example ?? '',
    ]
      .map((part) => part.trim().replace(/[。！？!?；;]+$/u, ''))
      .filter(Boolean);
    setSpeechHint(null);
    speak({ text: parts.join('。'), segmentId: `lookup-all-${payload.requestId}`, rate });
    // 如果系统语音被挂起/没有声音，给一个能看见的提示，而不是“点了没反应”。
    window.setTimeout(() => {
      const synth = window.speechSynthesis;
      if (synth && !synth.speaking && !synth.pending) {
        setSpeechHint('这次没念出来，再点一下。');
      }
    }, 1200);
  }, [payload, speak, rate]);

  const speakExample = useCallback(() => {
    if (!payload?.knowledge?.example) return;
    speak({
      text: payload.knowledge.example,
      segmentId: `lookup-example-${payload.requestId}`,
      rate,
    });
  }, [payload, speak, rate]);

  const hide = useCallback(() => {
    stop();
    void bridge?.hideOverlay();
  }, [bridge, stop]);

  const retry = useCallback(async () => {
    if (!bridge || retrying) return;
    setRetrying(true);
    try {
      const next = await bridge.lookupAtCursor();
      setPayload(next);
    } catch {
      setPayload({
        requestId: -1,
        status: 'error',
        target: null,
        knowledge: null,
        risk: null,
        message: '这次没看清，再试一下。',
        origin: 'hotkey',
        timing: null,
      });
    } finally {
      setRetrying(false);
    }
  }, [bridge, retrying]);

  if (!bridge) {
    return (
      <div className="lookup-browser">
        <div className="lookup-browser__card">
          <Icon name="screen" size={64} />
          <h1>看屏幕要在电脑版里用</h1>
          <p>
            网页版看不到别的软件里的字。可以先用“帮我看屏幕”粘贴文字；装好电脑版后，鼠标停在哪，这里就会告诉你。
          </p>
          <button
            type="button"
            className="lookup-button lookup-button--primary"
            onClick={() => {
              window.location.hash = '#/helper';
            }}
          >
            去粘贴文字
          </button>
        </div>
      </div>
    );
  }

  const knowledge = payload?.knowledge ?? null;
  const target = payload?.target ?? null;
  const loading = payload?.status === 'loading';
  const generated = knowledge?.generated ?? false;
  const sourceLabel = knowledge?.sourceLabel ?? null;
  const definition = knowledge?.definition ?? null;
  const example = knowledge?.example ?? null;
  const pinyin = knowledge?.pinyin ?? null;

  return (
    <div
      className="lookup-shell"
      ref={rootRef}
      aria-live="polite"
      onPointerEnter={() => {
        // Windows 上 showInactive() 出现的小窗，第一次点击可能只激活窗口。
        // 光标进入小窗时先激活它，确保“念/听/收起”一次点击就生效。
        void bridge.focusOverlay().catch(() => undefined);
      }}
    >
      <section className="lookup-card" aria-label="字的解释">
        {!payload || (!target && payload.status !== 'error') ? (
          <>
            <div className="lookup-idle">
              <span className="lookup-idle__icon">
                <Icon name={payload?.status === 'empty' ? 'question' : 'screen'} size={48} />
              </span>
              <div>
                <h1>
                  {status && !status.ocr.ready
                    ? '还在准备认字'
                    : payload?.message ?? '把鼠标放到字上，停一下'}
                </h1>
                <p>
                  {status && !status.ocr.ready
                    ? status.ocr.message ?? status.hint ?? '请让家里人看一下设置。'
                    : '我在这里等你。看到不认识的字，就停住不动。'}
                </p>
              </div>
            </div>
            <div className="lookup-footer">
              <button type="button" className="lookup-button" onClick={hide}>
                收起
              </button>
            </div>
          </>
        ) : null}

        {payload?.status === 'error' ? (
          <>
            <div className="lookup-idle">
              <span className="lookup-idle__icon lookup-idle__icon--warn">
                <Icon name="info" size={46} />
              </span>
              <div>
                <h1>这次没看清</h1>
                <p>{payload.message ?? '把鼠标放到字上，停一下，再试一次。'}</p>
              </div>
            </div>
            <div className="lookup-footer">
              <button
                type="button"
                className="lookup-button lookup-button--primary"
                onClick={() => void retry()}
                disabled={retrying}
              >
                {retrying ? '再看一下…' : '再看一次'}
              </button>
              <button type="button" className="lookup-button" onClick={hide}>
                收起
              </button>
            </div>
          </>
        ) : null}

        {target ? (
          <>
            <div className="lookup-top">
              <div className="lookup-word-block">
                <h1 className="lookup-word">{target.text}</h1>
                <p className="lookup-pinyin">
                  {pinyin ?? '点右边的喇叭听读音'}
                </p>
              </div>
              <button
                type="button"
                className="lookup-speak"
                onClick={speakAll}
                aria-label={`念一遍 ${target.text}`}
              >
                <Icon name="speaker" size={30} />
                <span>
                  {speaking && activeSegment?.startsWith('lookup-') ? '正在念' : '念'}
                </span>
              </button>
              <button
                type="button"
                className="lookup-close"
                onClick={hide}
                aria-label="收起小窗"
              >
                <Icon name="close" size={26} />
              </button>
            </div>

            <div className="lookup-meta">
              {sourceLabel ? (
                <span className={`lookup-source ${generated ? 'lookup-source--generated' : ''}`}>
                  {generated ? `${sourceLabel} · 不一定对` : sourceLabel}
                </span>
              ) : null}
              {payload?.timing ? (
                <span className="lookup-timing">看屏幕 {payload.timing.totalMs} 毫秒</span>
              ) : null}
            </div>

            <div className="lookup-definition-block">
              <span className="lookup-label">什么意思</span>
              {definition ? (
                <p className="lookup-definition">{definition}</p>
              ) : loading ? (
                <p className="lookup-thinking">
                  <span className="lookup-spinner" aria-hidden="true" />
                  正在想这个词什么意思…
                </p>
              ) : (
                <p className="lookup-definition lookup-definition--unknown">
                  这个字我只会念，还讲不好。
                </p>
              )}
            </div>

            {example ? (
              <div className="lookup-example">
                <div className="lookup-example__head">
                  <span className="lookup-label">例句</span>
                  <button
                    type="button"
                    className="lookup-mini-speak"
                    onClick={speakExample}
                    aria-label="念例句"
                  >
                    <Icon name="speaker" size={22} />
                    听
                  </button>
                </div>
                <p>{example}</p>
              </div>
            ) : null}

            {payload?.risk ? (
              <div className={`lookup-risk lookup-risk--${payload.risk.level}`}>
                <Icon name="shield" size={26} />
                <div>
                  <strong>{payload.risk.title}</strong>
                  <p>{payload.risk.advice}</p>
                </div>
              </div>
            ) : null}

            {loading ? (
              <p className="lookup-loading">
                <span className="lookup-spinner" aria-hidden="true" />
                电脑正在补例句，你可以先听读音
              </p>
            ) : null}

            {speechError ? (
              <p className="lookup-note lookup-note--warn" role="status">
                {speechError}
              </p>
            ) : null}

            {speechHint ? (
              <p className="lookup-note lookup-note--warn" role="status">
                {speechHint}
              </p>
            ) : null}

            {payload?.message && !loading && payload.status !== 'error' ? (
              <p className="lookup-note">{payload.message}</p>
            ) : null}

            {/*
              小窗里不再重复底部“念/收起”：右上角的念按钮和关闭按钮已经够大，
              去掉底部按钮可以把窗口高度压到约 500 DIP，避免遮住屏幕。
            */}
          </>
        ) : null}
      </section>
    </div>
  );
}
