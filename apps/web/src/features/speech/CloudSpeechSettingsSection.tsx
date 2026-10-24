import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useScreenStatus } from '../screen/useScreenStatus';
import {
  clearWebCloudTtsConfig,
  loadWebCloudTtsConfig,
  saveWebCloudTtsConfig,
  subscribeWebCloudTts,
  type WebCloudTtsConfig,
} from '../../capabilities/speech/webCloudTts';

/**
 * 设置页的“云端声音”区域。
 *
 * 桌面版：Key 只存在主进程（safeStorage 可用时加密），渲染层只看到 hasApiKey。
 * 网页版：没有主进程，Key 只能存在当前浏览器的 localStorage，并在浏览器里直接请求服务。
 * 两种模式都默认关闭；只有用户明确打开并保存密钥后，朗读才会把文字发到服务商。
 */
export function CloudSpeechSettingsSection() {
  const { bridge, config, updateConfig, busy, error } = useScreenStatus();
  const isDesktop = Boolean(bridge);
  const [enabled, setEnabled] = useState(false);
  const [endpoint, setEndpoint] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('tts-1');
  const [voice, setVoice] = useState('alloy');
  const [apiKey, setApiKey] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [webConfig, setWebConfig] = useState<WebCloudTtsConfig>(() =>
    loadWebCloudTtsConfig(),
  );

  useEffect(() => {
    if (!config || dirty || !isDesktop) return;
    setEnabled(config.tts.enabled);
    setEndpoint(config.tts.endpoint);
    setModel(config.tts.model);
    setVoice(config.tts.voice);
    setApiKey('');
  }, [config, dirty, isDesktop]);

  useEffect(() => {
    if (isDesktop) return;
    const sync = () => {
      if (dirty) return;
      const next = loadWebCloudTtsConfig();
      setWebConfig(next);
      setEnabled(next.enabled);
      setEndpoint(next.endpoint);
      setModel(next.model);
      setVoice(next.voice);
    };
    sync();
    const unsubscribe = subscribeWebCloudTts(sync);
    return unsubscribe;
  }, [dirty, isDesktop]);

  const hasStoredKey = isDesktop
    ? Boolean(config?.tts.hasApiKey)
    : Boolean(webConfig.apiKey);
  const keyStorage = isDesktop ? config?.tts.keyStorage : 'local';

  const save = async () => {
    setNotice(null);
    if (isDesktop) {
      const next = await updateConfig({
        ttsEnabled: enabled,
        ttsEndpoint: endpoint,
        ttsModel: model,
        ttsVoice: voice,
        ...(apiKey.trim() ? { ttsApiKey: apiKey.trim() } : {}),
      });
      if (!next) {
        setNotice(error ?? '没保存上。检查网址、模型、音色和密钥。');
        return;
      }
      setDirty(false);
      setApiKey('');
      setNotice(
        next.tts.enabled
          ? '存好了。以后朗读会用云端声音；按你填的服务计费。'
          : '存好了。现在继续用本机声音。',
      );
      return;
    }

    const next: WebCloudTtsConfig = {
      enabled,
      endpoint,
      model,
      voice,
      apiKey: apiKey.trim() || webConfig.apiKey,
    };
    const problem = saveWebCloudTtsConfig(next);
    if (problem) {
      setNotice(problem);
      return;
    }
    setWebConfig(next);
    setDirty(false);
    setApiKey('');
    setNotice(
      next.enabled
        ? '存好了。Key 只在这个浏览器里；以后朗读会用云端声音。'
        : '存好了。现在继续用本机声音。',
    );
  };

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setNotice(null);
    if (isDesktop) {
      const saved = await updateConfig({ ttsEnabled: next });
      if (!saved) {
        setEnabled(!next);
        setNotice(error ?? '没切换成功。检查网址、模型、音色和密钥。');
        return;
      }
      setNotice(next ? '云端声音打开了。' : '云端声音关上了，继续用本机声音。');
      return;
    }

    const nextConfig: WebCloudTtsConfig = {
      ...webConfig,
      enabled: next,
      endpoint,
      model,
      voice,
      apiKey: apiKey.trim() || webConfig.apiKey,
    };
    const problem = saveWebCloudTtsConfig(nextConfig);
    if (problem) {
      setEnabled(!next);
      setNotice(problem);
      return;
    }
    setWebConfig(nextConfig);
    setDirty(false);
    setApiKey('');
    setNotice(next ? '云端声音打开了。' : '云端声音关上了，继续用本机声音。');
  };

  const clearKey = async () => {
    setNotice(null);
    if (isDesktop) {
      const next = await updateConfig({ ttsEnabled: false, ttsApiKey: '' });
      if (!next) return;
      setEnabled(false);
      setDirty(false);
      setApiKey('');
      setNotice('密钥清掉了，云端声音也关上了。');
      return;
    }

    clearWebCloudTtsConfig();
    setWebConfig(loadWebCloudTtsConfig());
    setEnabled(false);
    setDirty(false);
    setApiKey('');
    setNotice('密钥清掉了，云端声音也关上了。');
  };

  return (
    <section className="settings-group" aria-labelledby="cloud-voice-title">
      <div className="settings-group__head">
        <h2 id="cloud-voice-title">云端声音（可选）</h2>
        <p>
          默认用这台设备自带的声音，不联网。想让朗读更像真人，可以填自己的云端语音服务；
          打开后，要念的文字会发给这个服务，并按服务商计费。
          {isDesktop
            ? '电脑版会把密钥加密保存在本机。'
            : '网页版把密钥只存在这个浏览器里，不会上传到字伴的服务器。'}
        </p>
      </div>

      <div className="screen-toggle-row">
        <div>
          <strong>{enabled ? '云端声音开着' : '云端声音关着'}</strong>
          <p>
            {enabled
              ? '朗读字卡、例句和屏幕讲解都会调用云端声音。没网时会念不出来，可以随时关掉。'
              : '关着的时候，一个请求都不会发；朗读继续用本机声音。'}
            {' '}打开/关掉会立即生效；改接口、音色或密钥后要点“保存”。
          </p>
        </div>
        <button
          type="button"
          className={`screen-toggle-button ${enabled ? 'is-on' : ''}`}
          onClick={() => void toggle()}
          disabled={busy}
        >
          <Icon name={enabled ? 'stop' : 'play'} size={26} />
          {enabled ? '关掉' : '打开'}
        </button>
      </div>

      {error ? (
        <p className="settings-note settings-note--warn" role="status">
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
          家里人设置：云端语音接口和密钥
        </summary>
        <p className="screen-advanced__intro">
          支持 OpenAI 兼容的 <code>/audio/speech</code> 接口。默认填的是 OpenAI 的地址和
          <code>tts-1</code>，也可以换成别的兼容服务；模型名、音色以服务商文档为准。
          {!isDesktop
            ? ' 网页版要求服务允许浏览器跨域（CORS）；不支持 CORS 的服务只能改用电脑版。'
            : null}
        </p>

        <div className="screen-form">
          <label>
            <span>网址（OpenAI 兼容 /v1）</span>
            <input
              type="url"
              value={endpoint}
              onChange={(event) => {
                setEndpoint(event.target.value);
                setDirty(true);
              }}
              placeholder="https://api.openai.com/v1"
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
              placeholder="tts-1"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            <span>音色</span>
            <input
              type="text"
              value={voice}
              onChange={(event) => {
                setVoice(event.target.value);
                setDirty(true);
              }}
              placeholder="alloy"
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
              placeholder={hasStoredKey ? '已经保存；重新填会覆盖' : '粘贴密钥'}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>

        {keyStorage === 'memory-only' ? (
          <p className="screen-advanced__warn">
            这台电脑不能安全保存密钥，关掉字伴后要重新填。请不要在公用电脑上打开。
          </p>
        ) : null}

        {!isDesktop ? (
          <p className="screen-advanced__warn">
            网页版没有系统安全存储：Key 以明文保存在这个浏览器的 localStorage 里，
            任何能在这个页面运行脚本的代码都可能读到它。请只用低额度 Key，公用电脑不要保存；
            也不要使用公共 CORS 代理，代理会看到 Key。
          </p>
        ) : null}

        <div className="screen-advanced__actions">
          <button type="button" className="text-tool" onClick={() => void save()} disabled={busy}>
            <Icon name="check" size={22} />
            保存
          </button>
          {hasStoredKey ? (
            <button
              type="button"
              className="text-tool"
              onClick={() => void clearKey()}
              disabled={busy}
            >
              <Icon name="trash" size={22} />
              清除密钥
            </button>
          ) : null}
        </div>

        <p className="screen-advanced__privacy">
          字伴不保存合成出来的音频；只把当前要念的文字发给上面填的服务。不会发截图、整屏或学习记录。
          {!isDesktop ? ' 网页版请求从浏览器直接发出，不经过字伴的服务器。' : null}
          云端声音只是另一种“念”的方式，讲得对不对仍以本机内容为准。
        </p>
      </details>
    </section>
  );
}
