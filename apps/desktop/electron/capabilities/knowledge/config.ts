/**
 * 桌面取词的本地配置。
 *
 * 安全约定：
 * - API Key 绝不回传给渲染层；小窗/页面只知道“有没有配置”；
 * - 能用系统安全存储（Windows DPAPI / macOS Keychain）就加密后落盘；
 * - 不能用时只在内存里保留，明确告诉家人“关掉软件要重新填”，绝不裸存明文。
 *
 * 默认值刻意保守：
 * - hoverEnabled=false：不主动看屏幕，等用户点“开始看屏幕”；
 * - llmEnabled=false：不联网；配置并打开后才发请求；
 * - shareContext=false：默认只把“词”发给模型，不把整行屏幕文字发出去。
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { safeStorage } from 'electron';
import type {
  DesktopConfigPatch,
  DesktopPublicConfig,
  TtsProvider,
} from '@ziban/core';
import { validateSpeechEndpoint } from '../speech/tts.js';

export interface StoredScreenConfig {
  version: 1;
  hoverEnabled: boolean;
  autoSpeak: boolean;
  checkUpdates: boolean;
  shareContext: boolean;
  llmEnabled: boolean;
  llmEndpoint: string;
  llmModel: string;
  /** safeStorage.encryptString() 后的 base64；没有就是不保存。 */
  llmApiKeyEncrypted: string | null;
  ttsEnabled: boolean;
  ttsProvider: TtsProvider;
  ttsEndpoint: string;
  ttsModel: string;
  ttsVoice: string;
  /** 云端 TTS 的密钥；与 LLM 密钥分开保存。 */
  ttsApiKeyEncrypted: string | null;
  captureWidthDip: number;
  captureHeightDip: number;
}

const DEFAULT_CONFIG: StoredScreenConfig = {
  version: 1,
  hoverEnabled: false,
  autoSpeak: true,
  checkUpdates: true,
  shareContext: false,
  llmEnabled: false,
  llmEndpoint: '',
  llmModel: '',
  llmApiKeyEncrypted: null,
  // 云端 TTS 默认关闭；只填了密钥也不会自动开启。
  ttsEnabled: false,
  ttsProvider: 'openai',
  ttsEndpoint: 'https://api.openai.com/v1',
  ttsModel: 'tts-1',
  ttsVoice: 'alloy',
  ttsApiKeyEncrypted: null,
  // 0 表示自动：由 core/captureSizeForWorkArea 按显示器工作区计算。
  // 保留字段是为了以后做“手动框定读取范围”的调试入口。
  captureWidthDip: 0,
  captureHeightDip: 0,
};

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

/** 只允许 https；本机模型允许 http://127.0.0.1 / localhost，方便离线部署。 */
export function validateEndpoint(value: string): { ok: boolean; message: string } {
  if (!value) return { ok: true, message: '' };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, message: '网址格式不对。要像 https://api.example.com/v1 这样。' };
  }
  if (url.protocol === 'https:') return { ok: true, message: '' };
  if (
    url.protocol === 'http:' &&
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1')
  ) {
    return { ok: true, message: '' };
  }
  return {
    ok: false,
    message: '为了安全，只接受 https 开头的网址；本机模型可以用 http://127.0.0.1。',
  };
}

export class ScreenConfigStore {
  private readonly filePath: string;
  private config: StoredScreenConfig;
  private memoryApiKey: string | null = null;
  private memoryTtsApiKey: string | null = null;
  private safeStorageAvailable: boolean;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'screen-config.json');
    this.config = this.load();
    this.safeStorageAvailable = this.checkSafeStorage();
  }

  private checkSafeStorage(): boolean {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  private load(): StoredScreenConfig {
    if (!existsSync(this.filePath)) return { ...DEFAULT_CONFIG };
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<StoredScreenConfig>;
      return {
        version: 1,
        hoverEnabled: asBoolean(raw.hoverEnabled, DEFAULT_CONFIG.hoverEnabled),
        autoSpeak: asBoolean(raw.autoSpeak, DEFAULT_CONFIG.autoSpeak),
        checkUpdates: asBoolean(raw.checkUpdates, DEFAULT_CONFIG.checkUpdates),
        shareContext: asBoolean(raw.shareContext, DEFAULT_CONFIG.shareContext),
        llmEnabled: asBoolean(raw.llmEnabled, DEFAULT_CONFIG.llmEnabled),
        llmEndpoint: asString(raw.llmEndpoint, '', 300),
        llmModel: asString(raw.llmModel, '', 120),
        llmApiKeyEncrypted:
          typeof raw.llmApiKeyEncrypted === 'string' && raw.llmApiKeyEncrypted.length > 0
            ? raw.llmApiKeyEncrypted
            : null,
        ttsEnabled: asBoolean(raw.ttsEnabled, DEFAULT_CONFIG.ttsEnabled),
        ttsProvider: raw.ttsProvider === 'qwen' ? 'qwen' : 'openai',
        ttsEndpoint: asString(raw.ttsEndpoint, DEFAULT_CONFIG.ttsEndpoint, 300),
        ttsModel: asString(raw.ttsModel, DEFAULT_CONFIG.ttsModel, 120),
        ttsVoice: asString(raw.ttsVoice, DEFAULT_CONFIG.ttsVoice, 80),
        ttsApiKeyEncrypted:
          typeof raw.ttsApiKeyEncrypted === 'string' && raw.ttsApiKeyEncrypted.length > 0
            ? raw.ttsApiKeyEncrypted
            : null,
        captureWidthDip: clamp(raw.captureWidthDip ?? 0, 0, 520, DEFAULT_CONFIG.captureWidthDip),
        captureHeightDip: clamp(raw.captureHeightDip ?? 0, 0, 300, DEFAULT_CONFIG.captureHeightDip),
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  private save(): void {
    try {
      mkdirSync(path.dirname(this.filePath), { recursive: true });
      const temp = `${this.filePath}.tmp`;
      writeFileSync(temp, `${JSON.stringify(this.config, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      });
      renameSync(temp, this.filePath);
    } catch {
      // 配置写不进去不应该阻止取词；下一次启动会回到默认值。
    }
  }

  get(): StoredScreenConfig {
    return { ...this.config };
  }

  getApiKey(): string | null {
    if (this.memoryApiKey) return this.memoryApiKey;
    if (!this.config.llmApiKeyEncrypted || !this.safeStorageAvailable) return null;
    try {
      const buffer = Buffer.from(this.config.llmApiKeyEncrypted, 'base64');
      return safeStorage.decryptString(buffer);
    } catch {
      return null;
    }
  }

  getTtsApiKey(): string | null {
    if (this.memoryTtsApiKey) return this.memoryTtsApiKey;
    if (!this.config.ttsApiKeyEncrypted || !this.safeStorageAvailable) return null;
    try {
      const buffer = Buffer.from(this.config.ttsApiKeyEncrypted, 'base64');
      return safeStorage.decryptString(buffer);
    } catch {
      return null;
    }
  }

  getPublic(): DesktopPublicConfig {
    return {
      hoverEnabled: this.config.hoverEnabled,
      autoSpeak: this.config.autoSpeak,
      ocrLanguage: 'zh-Hans',
      captureWidthDip: this.config.captureWidthDip,
      captureHeightDip: this.config.captureHeightDip,
      checkUpdates: this.config.checkUpdates,
      shareContext: this.config.shareContext,
      llm: {
        enabled: this.config.llmEnabled,
        endpoint: this.config.llmEndpoint,
        model: this.config.llmModel,
        hasApiKey: Boolean(this.getApiKey()),
        keyStorage: this.safeStorageAvailable ? 'safe' : 'memory-only',
      },
      tts: {
        enabled: this.config.ttsEnabled,
        provider: this.config.ttsProvider,
        endpoint: this.config.ttsEndpoint,
        model: this.config.ttsModel,
        voice: this.config.ttsVoice,
        hasApiKey: Boolean(this.getTtsApiKey()),
        keyStorage: this.safeStorageAvailable ? 'safe' : 'memory-only',
      },
    };
  }

  /** 返回校验失败的用户可读原因；成功返回 null。 */
  update(patch: DesktopConfigPatch): string | null {
    const previousConfig = { ...this.config };
    const previousMemoryKey = this.memoryApiKey;
    const previousTtsMemoryKey = this.memoryTtsApiKey;

    if (typeof patch.llmEndpoint === 'string') {
      const endpoint = patch.llmEndpoint.trim().slice(0, 300);
      const validation = validateEndpoint(endpoint);
      if (!validation.ok) return validation.message;
      this.config.llmEndpoint = endpoint;
    }
    if (typeof patch.llmModel === 'string') {
      this.config.llmModel = patch.llmModel.trim().slice(0, 120);
    }
    if (typeof patch.hoverEnabled === 'boolean') this.config.hoverEnabled = patch.hoverEnabled;
    if (typeof patch.autoSpeak === 'boolean') this.config.autoSpeak = patch.autoSpeak;
    if (typeof patch.checkUpdates === 'boolean') this.config.checkUpdates = patch.checkUpdates;
    if (typeof patch.shareContext === 'boolean') this.config.shareContext = patch.shareContext;
    if (typeof patch.llmEnabled === 'boolean') this.config.llmEnabled = patch.llmEnabled;

    if (patch.ttsProvider === 'openai' || patch.ttsProvider === 'qwen') {
      this.config.ttsProvider = patch.ttsProvider;
    }
    if (typeof patch.ttsEndpoint === 'string') {
      const endpoint = patch.ttsEndpoint.trim().slice(0, 300);
      const validation = validateSpeechEndpoint(endpoint);
      if (validation) return validation;
      this.config.ttsEndpoint = endpoint;
    }
    if (typeof patch.ttsModel === 'string') {
      this.config.ttsModel = patch.ttsModel.trim().slice(0, 120);
    }
    if (typeof patch.ttsVoice === 'string') {
      this.config.ttsVoice = patch.ttsVoice.trim().slice(0, 80);
    }
    if (typeof patch.ttsEnabled === 'boolean') this.config.ttsEnabled = patch.ttsEnabled;

    if (typeof patch.captureWidthDip === 'number') {
      this.config.captureWidthDip = clamp(patch.captureWidthDip, 0, 520, 0);
    }
    if (typeof patch.captureHeightDip === 'number') {
      this.config.captureHeightDip = clamp(patch.captureHeightDip, 0, 300, 0);
    }

    if (typeof patch.llmApiKey === 'string') {
      const key = patch.llmApiKey.trim();
      if (!key) {
        this.config.llmApiKeyEncrypted = null;
        this.memoryApiKey = null;
      } else if (this.safeStorageAvailable) {
        try {
          this.config.llmApiKeyEncrypted = safeStorage.encryptString(key).toString('base64');
          this.memoryApiKey = null;
        } catch {
          this.memoryApiKey = key;
          this.config.llmApiKeyEncrypted = null;
        }
      } else {
        this.memoryApiKey = key;
        this.config.llmApiKeyEncrypted = null;
      }
    }

    if (typeof patch.ttsApiKey === 'string') {
      const key = patch.ttsApiKey.trim();
      if (!key) {
        this.config.ttsApiKeyEncrypted = null;
        this.memoryTtsApiKey = null;
      } else if (this.safeStorageAvailable) {
        try {
          this.config.ttsApiKeyEncrypted = safeStorage.encryptString(key).toString('base64');
          this.memoryTtsApiKey = null;
        } catch {
          this.memoryTtsApiKey = key;
          this.config.ttsApiKeyEncrypted = null;
        }
      } else {
        this.memoryTtsApiKey = key;
        this.config.ttsApiKeyEncrypted = null;
      }
    }

    const touchesTts =
      patch.ttsEnabled !== undefined ||
      patch.ttsProvider !== undefined ||
      patch.ttsEndpoint !== undefined ||
      patch.ttsModel !== undefined ||
      patch.ttsVoice !== undefined ||
      patch.ttsApiKey !== undefined;
    if (this.config.ttsEnabled && touchesTts) {
      const problem = !this.config.ttsEndpoint
        ? '请先填写云端语音的网址（例如 https://api.openai.com/v1）。'
        : !this.config.ttsModel
          ? '请先填写云端语音的模型名字（例如 tts-1）。'
          : !this.config.ttsVoice
            ? '请先填写云端语音的音色（例如 alloy）。'
            : !this.getTtsApiKey()
              ? '请先填写云端语音的密钥（API Key）。'
              : null;
      if (problem) {
        this.config = previousConfig;
        this.memoryApiKey = previousMemoryKey;
        this.memoryTtsApiKey = previousTtsMemoryKey;
        return problem;
      }
    }

    // 只在“确实在改电脑讲解”时校验完整性：
    // 否则用户只是开关“看屏幕”，却因为上次密钥没保存而连开关都存不上。
    const touchesLlm =
      patch.llmEnabled !== undefined ||
      patch.llmEndpoint !== undefined ||
      patch.llmModel !== undefined ||
      patch.llmApiKey !== undefined ||
      patch.shareContext !== undefined;
    if (this.config.llmEnabled && touchesLlm) {
      const problem = !this.config.llmEndpoint
        ? '请先填写电脑讲解的网址（例如 https://api.deepseek.com/v1）。'
        : !this.config.llmModel
          ? '请先填写模型名字（例如 deepseek-chat）。'
          : !this.getApiKey()
            ? '请先填写密钥（API Key）。'
            : null;
      if (problem) {
        // 回滚，避免 UI 以为已经打开但实际没保存。
        this.config = previousConfig;
        this.memoryApiKey = previousMemoryKey;
        this.memoryTtsApiKey = previousTtsMemoryKey;
        return problem;
      }
    }

    this.save();
    return null;
  }
}
