/**
 * 云端 TTS（OpenAI 兼容 /audio/speech）。
 *
 * 只由主进程调用：API Key 不进入渲染层，文本/音频也不落盘。
 * 用户必须先在设置里显式打开，且没配密钥时一个请求都不会发。
 */

import type { CloudSpeechResult, TtsProvider } from '@ziban/core';

export interface CloudTtsConfig {
  provider: TtsProvider;
  endpoint: string;
  model: string;
  voice: string;
  apiKey: string | null;
}

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_TEXT_LENGTH = 2_000;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

/** 把 `https://api.example.com/v1` 补成 `/v1/audio/speech`；已带全路径则不重复拼。 */
export function speechEndpoint(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, '');
  if (/\/audio\/speech$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/audio/speech`;
  return `${base}/v1/audio/speech`;
}

/** 千问 Qwen-TTS 的原生接口；支持北京和新加坡的 DashScope 域名。 */
export function qwenSpeechEndpoint(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, '');
  if (/\/services\/aigc\/multimodal-generation\/generation$/i.test(base)) return base;
  if (/\/api\/v1$/i.test(base)) {
    return `${base}/services/aigc/multimodal-generation/generation`;
  }
  if (/\/api$/i.test(base)) {
    return `${base}/v1/services/aigc/multimodal-generation/generation`;
  }
  return `${base}/api/v1/services/aigc/multimodal-generation/generation`;
}

export function validateSpeechEndpoint(endpoint: string): string | null {
  if (!endpoint.trim()) return '请先填写云端语音的网址。';
  let url: URL;
  try {
    url = new URL(endpoint.trim());
  } catch {
    return '网址格式不对。要像 https://api.openai.com/v1 这样。';
  }
  if (url.username || url.password) {
    return '网址里不要带账号密码；密钥请填在下面的“密钥”框里。';
  }
  if (url.search || url.hash) {
    return '网址里不要带 ? 或 # 后面的参数。';
  }
  if (url.protocol === 'https:') return null;
  if (
    url.protocol === 'http:' &&
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1')
  ) {
    return null;
  }
  return '为了安全，云端语音只接受 https 网址；本机模型可以用 http://127.0.0.1。';
}

export async function synthesizeCloudSpeech(
  text: string,
  config: CloudTtsConfig,
): Promise<CloudSpeechResult> {
  const input = text.trim();
  if (!input) return { ok: false, audio: null, mimeType: null, message: '没有要念的字。' };
  if (Array.from(input).length > MAX_TEXT_LENGTH) {
    return { ok: false, audio: null, mimeType: null, message: '一次要念的字太多了，先分段。' };
  }
  const endpointProblem = validateSpeechEndpoint(config.endpoint);
  if (endpointProblem) {
    return { ok: false, audio: null, mimeType: null, message: endpointProblem };
  }
  if (!config.model.trim()) {
    return { ok: false, audio: null, mimeType: null, message: '还没填云端语音的模型名字。' };
  }
  if (!config.voice.trim()) {
    return { ok: false, audio: null, mimeType: null, message: '还没填云端语音的音色。' };
  }
  if (!config.apiKey) {
    return { ok: false, audio: null, mimeType: null, message: '还没填云端语音的密钥。' };
  }
  if (config.provider === 'qwen') {
    return synthesizeQwenSpeech(input, config);
  }

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
        model: config.model.trim(),
        input,
        voice: config.voice.trim(),
        response_format: 'mp3',
      }),
      // 不跟随重定向，避免把 Bearer 密钥带到另一个地址。
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      audio: null,
      mimeType: null,
      message: /timeout|abort/i.test(message)
        ? '云端语音等太久了，稍后再试。'
        : '没连上云端语音，检查网络或网址。',
    };
  }

  if (!response.ok) {
    const message =
      response.status === 401 || response.status === 403
        ? '云端语音密钥不对，或没有权限。'
        : response.status === 429
          ? '云端语音调用太频繁或额度用完了。'
          : `云端语音没念出来（HTTP ${response.status}）。`;
    return { ok: false, audio: null, mimeType: null, message };
  }

  const mimeType = (response.headers.get('content-type') ?? 'audio/mpeg').split(';')[0] ?? 'audio/mpeg';
  if (!mimeType.startsWith('audio/')) {
    return { ok: false, audio: null, mimeType: null, message: '云端返回的不是语音。检查模型名和接口。' };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await response.arrayBuffer();
  } catch {
    return { ok: false, audio: null, mimeType: null, message: '云端语音没有传完，再试一次。' };
  }
  if (buffer.byteLength === 0) {
    return { ok: false, audio: null, mimeType: null, message: '云端语音是空的，再试一次。' };
  }
  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    return { ok: false, audio: null, mimeType: null, message: '这段语音太长了，先分段。' };
  }

  return {
    ok: true,
    audio: new Uint8Array(buffer),
    mimeType,
    message: null,
  };
}

interface QwenAudioResponse {
  status_code?: number;
  code?: string;
  message?: string;
  output?: {
    audio?: {
      data?: string;
      url?: string;
    } | null;
  } | null;
}

/**
 * 阿里云百炼 Qwen-TTS 原生接口。
 *
 * 请求：POST /api/v1/services/aigc/multimodal-generation/generation
 * 返回：JSON 里的 output.audio.url（24 小时有效），再下载成音频字节。
 * 不用 OpenAI 的 /audio/speech，也不把 Key 放进音频 URL。
 */
async function synthesizeQwenSpeech(
  text: string,
  config: CloudTtsConfig,
): Promise<CloudSpeechResult> {
  if (Array.from(text).length > 600) {
    return { ok: false, audio: null, mimeType: null, message: '千问一次最多 600 字，先分段。' };
  }

  let response: Response;
  try {
    response = await fetch(qwenSpeechEndpoint(config.endpoint), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: config.model.trim(),
        input: {
          text,
          voice: config.voice.trim(),
          language_type: 'Chinese',
        },
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      audio: null,
      mimeType: null,
      message: /timeout|abort/i.test(message)
        ? '千问语音等太久了，稍后再试。'
        : '没连上千问语音，检查网络或 DashScope 网址。',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      audio: null,
      mimeType: null,
      message:
        response.status === 401 || response.status === 403
          ? '千问语音密钥不对，或没有百炼权限。'
          : response.status === 429
            ? '千问语音调用太频繁或额度用完了。'
            : `千问语音没念出来（HTTP ${response.status}）。`,
    };
  }

  let payload: QwenAudioResponse;
  try {
    payload = (await response.json()) as QwenAudioResponse;
  } catch {
    return { ok: false, audio: null, mimeType: null, message: '千问返回的不是 JSON，检查接口地址。' };
  }
  if ((payload.status_code && payload.status_code >= 400) || payload.code) {
    return {
      ok: false,
      audio: null,
      mimeType: null,
      message: payload.message ? `千问：${payload.message}` : '千问语音请求没成功。',
    };
  }

  const audio = payload.output?.audio;
  if (audio?.data) {
    const bytes = Buffer.from(audio.data, 'base64');
    if (bytes.byteLength === 0) {
      return { ok: false, audio: null, mimeType: null, message: '千问返回了空语音。' };
    }
    return {
      ok: true,
      audio: new Uint8Array(bytes),
      mimeType: 'audio/wav',
      message: null,
    };
  }
  if (!audio?.url) {
    return { ok: false, audio: null, mimeType: null, message: '千问没有返回音频地址。' };
  }

  let audioResponse: Response;
  try {
    audioResponse = await fetch(audio.url, {
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, audio: null, mimeType: null, message: '千问音频下载失败，再试一次。' };
  }
  if (!audioResponse.ok) {
    return {
      ok: false,
      audio: null,
      mimeType: null,
      message: `千问音频下载失败（HTTP ${audioResponse.status}）。`,
    };
  }
  const mimeType = (audioResponse.headers.get('content-type') ?? 'audio/wav').split(';')[0] ?? 'audio/wav';
  const buffer = await audioResponse.arrayBuffer();
  if (buffer.byteLength === 0) {
    return { ok: false, audio: null, mimeType: null, message: '千问音频是空的。' };
  }
  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    return { ok: false, audio: null, mimeType: null, message: '这段语音太长了，先分段。' };
  }
  return {
    ok: true,
    audio: new Uint8Array(buffer),
    mimeType,
    message: null,
  };
}
