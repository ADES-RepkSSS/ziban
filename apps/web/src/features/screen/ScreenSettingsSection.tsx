import { useEffect, useState } from 'react';
import type { DesktopPublicConfig } from '@ziban/core';
import { Icon } from '../../components/Icon';
import { displayHotkey, useScreenStatus } from './useScreenStatus';

/**
 * 设置页的“看屏幕”区域。
 *
 * 老人只需要一个开关；网址/模型/密钥放在“家里人设置”折叠区里，
 * 并且明确写出“打开后会联网、会发送什么”。默认全部关闭。
 */
export function ScreenSettingsSection() {
  const {
    bridge,
    status,
    config,
    busy,
    error,
    start,
    stop,
    requestPermission,
    updateConfig,
    testLlm,
    clearCache,
    lookupNow,
  } = useScreenStatus();

  const [autoSpeak, setAutoSpeak] = useState(true);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [shareContext, setShareContext] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // 家人正在填表时，后台的状态广播不要把没保存的网址/模型冲掉。
    if (!config || dirty) return;
    setAutoSpeak(config.autoSpeak);
    setLlmEnabled(config.llm.enabled);
    setEndpoint(config.llm.endpoint);
    setModel(config.llm.model);
    setShareContext(config.shareContext);
    setApiKey('');
  }, [config, dirty]);

  if (!bridge) {
    return (
      <section className="settings-group" aria-labelledby="screen-settings-title">
        <div className="settings-group__head">
          <h2 id="screen-settings-title">看屏幕上的字</h2>
          <p>网页版看不到别的软件。装好电脑版后，鼠标停在哪，字伴就念哪。</p>
        </div>
        <div className="settings-note">
          现在可以先用“帮我看屏幕”粘贴文字。电脑版不需要框选，也不会录整屏。
        </div>
      </section>
    );
  }

  const running = status?.hover ?? false;
  const ocrReady = status?.ocr.ready ?? false;
  const permission = status?.permission ?? 'unknown';
  const needPermission = permission !== 'granted' && permission !== 'not-needed';
  const hotkey = displayHotkey(
    status?.hotkeys.lookup ?? 'CommandOrControl+Shift+Z',
    bridge.platform,
  );
  const toggleHotkey = displayHotkey(
    status?.hotkeys.toggle ?? 'CommandOrControl+Shift+H',
    bridge.platform,
  );

  const save = async (): Promise<DesktopPublicConfig | null> => {
    setNotice(null);
    const next = await updateConfig({
      autoSpeak,
      llmEnabled,
      llmEndpoint: endpoint,
      llmModel: model,
      shareContext,
      ...(apiKey.trim() ? { llmApiKey: apiKey.trim() } : {}),
    });
    if (next) {
      setApiKey('');
      setDirty(false);
      setNotice('存好了。');
    }
    return next;
  };

  const testConnection = async () => {
    setTesting(true);
    setNotice(null);
    const saved = await save();
    if (!saved) {
      setTesting(false);
      return;
    }
    const result = await testLlm();
    setNotice(result?.message ?? '没连上，再检查一下网址、模型名和密钥。');
    setTesting(false);
  };

  return (
    <section className="settings-group" aria-labelledby="screen-settings-title">
      <div className="settings-group__head">
        <h2 id="screen-settings-title">看屏幕上的字</h2>
        <p>
          不用框选，也不用复制。打开以后，鼠标停在哪个字上，旁边就弹出一个小窗：什么意思、怎么念、造个句。
        </p>
      </div>

      {!ocrReady ? (
        <div className="settings-note settings-note--warn">
          {status?.ocr.message ?? '这台电脑还在准备认字。'}
          {bridge.platform === 'win32' ? (
            <span>
              {' '}
              可以在 Windows 设置 → 时间和语言 → 语言和区域里，给中文加上“光学字符识别”。
            </span>
          ) : null}
        </div>
      ) : null}

      {needPermission ? (
        <div className="screen-permission">
          <span className="screen-permission__icon">
            <Icon name="shield" size={32} />
          </span>
          <div>
            <strong>
              {permission === 'not-determined' ? '还要允许字伴看屏幕' : '系统现在没让字伴看屏幕'}
            </strong>
            <p>
              {permission === 'not-determined'
                ? '点“允许看屏幕”，系统会问一次；选“允许”就行。字伴只截鼠标周围的一小块，不录整屏。'
                : '到“系统设置 → 隐私与安全性 → 屏幕录制”里打开字伴；如果刚刚打开，可能要把字伴关掉再开一次。'}
            </p>
            <div className="screen-permission__actions">
              <button
                type="button"
                className="text-tool"
                onClick={() => void requestPermission()}
                disabled={busy}
              >
                <Icon name="check" size={22} />
                允许看屏幕
              </button>
              <button
                type="button"
                className="text-tool"
                onClick={() => void bridge.openSystemSettings('screen')}
              >
                <Icon name="settings" size={22} />
                打开系统设置
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="screen-toggle-row">
        <div>
          <strong>{running ? '正在看屏幕' : '看屏幕关着'}</strong>
          <p>
            {running
              ? '切到你要用的软件，把鼠标停在不认识的字上，停一下。小窗出来时，可以直接点“念”。'
              : '打开后切到别的软件，鼠标停在字上就会弹出解释；再点一次暂停。'}
          </p>
          <p className="screen-toggle-row__hotkey">
            查鼠标下面：<kbd>{hotkey}</kbd> · 开/停：<kbd>{toggleHotkey}</kbd>
          </p>
        </div>
        <button
          type="button"
          className={`screen-toggle-button ${running ? 'is-on' : ''}`}
          onClick={() => void (running ? stop() : start())}
          disabled={busy || !ocrReady}
        >
          <Icon name={running ? 'stop' : 'play'} size={26} />
          {busy ? '请稍等…' : running ? '暂停' : '打开'}
        </button>
      </div>

      <div className="screen-test-row">
        <button
          type="button"
          className="text-tool"
          onClick={() => void lookupNow()}
          disabled={busy}
        >
          <Icon name="screen" size={22} />
          试一下鼠标下面的字
        </button>
        <label className="screen-check">
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={(event) => {
              setAutoSpeak(event.target.checked);
              void updateConfig({ autoSpeak: event.target.checked });
            }}
          />
          小窗出来时自动念“词 + 解释”
        </label>
      </div>

      {error ? (
        <p className="helper-notice" role="status">
          <Icon name="info" size={20} />
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="helper-notice" role="status">
          <Icon name="info" size={20} />
          {notice}
        </p>
      ) : null}

      <details className="screen-advanced">
        <summary>
          <Icon name="bulb" size={24} />
          家里人设置：电脑讲解（会联网）
        </summary>
        <p className="screen-advanced__intro">
          字卡和本机词表能讲常用词。遇到没见过的词，可以接一个支持 OpenAI 接口的大模型来补解释。
          默认关着；打开并保存后，字伴才会把“词”发出去。用不用、发给谁，都由家里人决定。
        </p>

        <label className="screen-check screen-check--strong">
          <input
            type="checkbox"
            checked={llmEnabled}
            onChange={(event) => {
              setLlmEnabled(event.target.checked);
              setDirty(true);
            }}
          />
          打开电脑讲解
        </label>

        <div className="screen-form">
          <label>
            <span>网址（OpenAI 兼容）</span>
            <input
              type="url"
              value={endpoint}
              onChange={(event) => {
                setEndpoint(event.target.value);
                setDirty(true);
              }}
              placeholder="https://api.deepseek.com/v1"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            <span>模型名字</span>
            <input
              type="text"
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                setDirty(true);
              }}
              placeholder="deepseek-chat"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            <span>密钥（API Key）</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setDirty(true);
              }}
              placeholder={config?.llm.hasApiKey ? '已经保存；重新填会覆盖' : '粘贴密钥'}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>

        <label className="screen-check">
          <input
            type="checkbox"
            checked={shareContext}
            onChange={(event) => {
              setShareContext(event.target.checked);
              setDirty(true);
            }}
          />
          把光标所在的那一行也发过去（更准，但会发出屏幕文字）
        </label>

        {config?.llm.keyStorage === 'memory-only' ? (
          <p className="screen-advanced__warn">
            这台电脑不能安全保存密钥，关掉字伴后要重新填。请不要在公用电脑上打开。
          </p>
        ) : null}

        <div className="screen-advanced__actions">
          <button type="button" className="text-tool" onClick={() => void save()} disabled={busy}>
            <Icon name="check" size={22} />
            保存
          </button>
          <button
            type="button"
            className="text-tool"
            onClick={() => void testConnection()}
            disabled={busy || testing}
          >
            <Icon name="play" size={22} />
            {testing ? '正在试…' : '试一下连不连得上'}
          </button>
          <button
            type="button"
            className="text-tool"
            onClick={async () => {
              const count = await clearCache();
              setNotice(count === null ? '缓存没清掉。' : `清掉了 ${count} 条电脑讲解缓存。`);
            }}
          >
            <Icon name="trash" size={22} />
            清除电脑讲解缓存
          </button>
        </div>

        <p className="screen-advanced__privacy">
          字伴不保存屏幕截图；识别在本机完成。只有打开“电脑讲解”后，才会把词（以及你勾选的那一行）发给上面填的服务。
          讲得不一定对，小窗会标“电脑生成 · 不一定对”。
        </p>
      </details>
    </section>
  );
}
