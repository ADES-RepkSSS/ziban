/**
 * 网页版云端 TTS 配置与请求。
 *
 * 网页版没有主进程，Key 只能存在当前浏览器的 localStorage：
 * - 只在本机浏览器里保存，不上传到字伴的服务器；
 * - 任何能在这个页面执行脚本的代码都能读到它，所以只用低额度 Key，公用电脑不要保存；
 * - 直接 POST 到用户填的服务，服务必须允许浏览器跨域（CORS）；
 *   公共 CORS 代理会看到 Key，不要用。
 */

import type { CloudSpeechResult } from '@ziban/core';

export interface WebCloudTtsConfig {
  enabled: boolean;
  endpoint: string;
  model: string;
  voice: string;
  apiKey: string;
}

export const WEB_CLOUD_TTS_STORAGE_KEY = 'ziban.cloudTts.v1';
export const WEB_CLOUD_TTS_CHANGED = 'ziban:cloud-tts-changed';

const DEFAULT_CONFIG: WebCloudTtsConfig = {
  enabled: false,
  endpoint: 'https://api.openai.com/v1',
  model: 'tts-1',
  voice: 'alloy',
  apiKey: '',
};

function text(value: unknown, fallback: string, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

export function loadWebCloudTtsConfig(): WebCloudTtsConfig {
  try {
    const raw = window.localStorage.getItem(WEB_CLOUD_TTS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<WebCloudTtsConfig>;
    return {
      enabled: parsed.enabled === true,
      endpoint: text(parsed.endpoint, DEFAULT_CONFIG.endpoint, 300),
      model: text(parsed.model, DEFAULT_CONFIG.model, 120),
      voice: text(parsed.voice, DEFAULT_CONFIG.voice, 80),
      apiKey: text(parsed.apiKey, '', 300),
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveWebCloudTtsConfig(config: WebCloudTtsConfig): string | null {
  const next: WebCloudTtsConfig = {
    enabled: Boolean(config.enabled),
    endpoint: config.endpoint.trim().slice(0, 300),
    model: config.model.trim().slice(0, 120),
    voice: config.voice.trim().slice(0, 80),
    apiKey: config.apiKey.trim().slice(0, 300),
  };
  if (next.enabled) {
    const endpointProblem = validateWebCloudTtsEndpoint(next.endpoint);
    if (endpointProblem) return endpointProblem;
    if (!next.model) return '请先填写云端语音的模型名字。';
    if (!next.voice) return '请先填写云端语音的音色。';
    if (!next.apiKey) return '请先填写云端语音的密钥（API Key）。';
  }
  try {
    window.localStorage.setItem(WEB_CLOUD_TTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return '这个浏览器不让保存密钥（可能是隐私模式）。可以换桌面版，或允许本站保存数据。';
  }
  window.dispatchEvent(new Event(WEB_CLOUD_TTS_CHANGED));
  return null;
}

export function clearWebCloudTtsConfig(): void {
  try {
    window.localStorage.removeItem(WEB_CLOUD_TTS_STORAGE_KEY);
  } catch {
    // 清不掉时至少让当前页面回到关闭状态。
  }
  window.dispatchEvent(new Event(WEB_CLOUD_TTS_CHANGED));
}

export function subscribeWebCloudTts(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === WEB_CLOUD_TTS_STORAGE_KEY) listener();
  };
  window.addEventListener(WEB_CLOUD_TTS_CHANGED, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(WEB_CLOUD_TTS_CHANGED, listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function validateWebCloudTtsEndpoint(endpoint: string): string | null {
  if (!endpoint.trim()) return '请先填写云端语音的网址。';
  let url: URL;
  try {
    url = new URL(endpoint.trim());
  } catch {
    return '网址格式不对。要像 https://api.example.com/v1 这样。';
  }
  if (url.username || url.password) return '网址里不要带账号密码；把密钥填在“密钥”框里。';
  if (url.search || url.hash) return '网址里不要带 ? 或 # 后面的参数。';
  if (url.protocol === 'https:') return null;
  if (
    url.protocol === 'http:' &&
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1')
  ) {
    return null;
  }
  return '为了安全，云端语音只接受 https 网址；本机服务可以用 http://127.0.0.1。';
}

function speechEndpoint(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, '');
  if (/\/audio\/speech$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/audio/speech`;
  return `${base}/v1/audio/speech`;
}

export async function synthesizeWebCloudSpeech(
  text: string,
  config: WebCloudTtsConfig,
): Promise<CloudSpeechResult> {
  const input = text.trim();
  if (!input) return { ok: false, audio: null, mimeType: null, message: '没有要念的字。' };
  if (Array.from(input).length > 2_000) {
    return { ok: false, audio: null, mimeType: null, message: '一次要念的字太多了，先分段。' };
  }
  const endpointProblem = validateWebCloudTtsEndpoint(config.endpoint);
  if (endpointProblem) return { ok: false, audio: null, mimeType: null, message: endpointProblem };
  if (!config.model || !config.voice) {
    return { ok: false, audio: null, mimeType: null, message: '云端语音的模型或音色没填。' };
  }
  if (!config.apiKey) {
    return { ok: false, audio: null, mimeType: null, message: '还没填云端语音的密钥。' };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45_000);
  let response: Response;
  try {
    response = await fetch(speechEndpoint(config.endpoint), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        model: config.model,
        input,
        voice: config.voice,
        response_format: 'mp3',
      }),
      redirect: 'error',
      signal: controller.signal,
    });
  } catch {
    return {
      ok: false,
      audio: null,
      mimeType: null,
      message: '网页版没连上语音服务。若服务不允许浏览器跨域（CORS），请换支持 CORS 的服务，或用电脑版。',
    };
  } finally {
    window.clearTimeout(timer);
  }

  if (!response.ok) {
    return {
      ok: false,
      audio: null,
      mimeType: null,
      message:
        response.status === 401 || response.status === 403
          ? '云端语音密钥不对，或没有权限。'
          : response.status === 429
            ? '云端语音调用太频繁或额度用完了。'
            : `云端语音没念出来（HTTP ${response.status}）。`,
    };
  }

  const mimeType = (response.headers.get('content-type') ?? 'audio/mpeg').split(';')[0] ?? 'audio/mpeg';
  if (!mimeType.startsWith('audio/')) {
    return { ok: false, audio: null, mimeType: null, message: '服务返回的不是语音。检查模型名和接口。' };
  }
  let buffer: ArrayBuffer;
  try {
    buffer = await response.arrayBuffer();
  } catch {
    return { ok: false, audio: null, mimeType: null, message: '语音没有传完，再试一次。' };
  }
  if (buffer.byteLength === 0) {
    return { ok: false, audio: null, mimeType: null, message: '服务返回了空语音，再试一次。' };
  }
  if (buffer.byteLength > 20 * 1024 * 1024) {
    return { ok: false, audio: null, mimeType: null, message: '这段语音太长了，先分段。' };
  }
  return { ok: true, audio: new Uint8Array(buffer), mimeType, message: null };
}
