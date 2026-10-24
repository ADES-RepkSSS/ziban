/**
 * 桌面壳（Electron）与渲染层之间的 IPC 契约。
 *
 * 这些类型放在 core，而不是 Electron 或 web 里，原因：
 * - preload / 主进程 / React 三处必须用同一份形状，避免“主进程改了字段，
 *   小窗没改”这种只在运行时才发现的错；
 * - 类型不依赖 electron，浏览器构建也能安全 import（只做 type import）。
 *
 * 真正的实现见 apps/desktop/electron/preload.ts 与 main.ts；
 * 浏览器里没有 window.zibanDesktop，UI 必须优雅降级。
 */

import type { RiskNote } from './plainLanguage.js';
import type { LookupTarget, WordKnowledge } from './screen.js';

export type ScreenPermissionState =
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'not-determined'
  | 'not-needed'
  | 'unknown';

export type LookupOrigin = 'hover' | 'hotkey' | 'demo';

export type LookupStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface LookupTiming {
  captureMs: number;
  ocrMs: number;
  totalMs: number;
}

/** 主进程推给小窗的一条查询结果。 */
export interface ScreenLookupPayload {
  requestId: number;
  status: LookupStatus;
  target: LookupTarget | null;
  knowledge: WordKnowledge | null;
  risk: RiskNote | null;
  /** 面向老人的一句话；出错时也不能出现“失败/错误”这种指责词。 */
  message: string | null;
  origin: LookupOrigin;
  timing: LookupTiming | null;
}

export interface OcrStatus {
  ready: boolean;
  /** 例如 winrt-zh-Hans / apple-vision。 */
  engine: string;
  language: string | null;
  message: string | null;
}

export interface LlmStatus {
  enabled: boolean;
  configured: boolean;
  message: string | null;
}

export interface HotkeyStatus {
  lookup: string;
  toggle: string;
  registered: boolean;
}

export interface DesktopScreenStatus {
  platform: 'win32' | 'darwin' | 'linux';
  hover: boolean;
  permission: ScreenPermissionState;
  ocr: OcrStatus;
  llm: LlmStatus;
  hotkeys: HotkeyStatus;
  /** 用户能看懂的下一步，例如“先允许字伴看屏幕”。 */
  hint: string | null;
  lastError: string | null;
}

export type TtsProvider = 'openai' | 'qwen';

/**
 * 渲染层可以读的配置。
 * API Key 永远不回传，只回传 hasApiKey；避免小窗/页面被 XSS 时泄露密钥。
 */
export interface DesktopPublicConfig {
  hoverEnabled: boolean;
  autoSpeak: boolean;
  ocrLanguage: string;
  captureWidthDip: number;
  captureHeightDip: number;
  /** 是否允许启动后访问 GitHub 公共 API 检查新版本；默认开，用户可关。 */
  checkUpdates: boolean;
  shareContext: boolean;
  llm: {
    enabled: boolean;
    endpoint: string;
    model: string;
    hasApiKey: boolean;
    /** 本机安全存储是否可用；不可用时不要持久化密钥。 */
    keyStorage: 'safe' | 'memory-only';
  };
  /** 可选云端 TTS；默认关闭，密钥只在主进程。 */
  tts: {
    enabled: boolean;
    /** openai = OpenAI 兼容 /audio/speech；qwen = 阿里云百炼 Qwen-TTS。 */
    provider: TtsProvider;
    endpoint: string;
    model: string;
    voice: string;
    hasApiKey: boolean;
    keyStorage: 'safe' | 'memory-only';
  };
}

/** 主进程合成语音后返回给渲染层播放；不把 API Key 或原始请求带回去。 */
export interface CloudSpeechResult {
  ok: boolean;
  audio: Uint8Array | null;
  mimeType: string | null;
  message: string | null;
  /** 网页版 Qwen-TTS 直接返回受签名保护的音频 URL；桌面版仍下载成字节。 */
  audioUrl?: string | null;
}

export interface DesktopConfigPatch {
  hoverEnabled?: boolean;
  autoSpeak?: boolean;
  checkUpdates?: boolean;
  shareContext?: boolean;
  llmEnabled?: boolean;
  llmEndpoint?: string;
  llmModel?: string;
  /** 只写不读；空字符串表示清除。 */
  llmApiKey?: string;
  ttsEnabled?: boolean;
  ttsProvider?: TtsProvider;
  ttsEndpoint?: string;
  ttsModel?: string;
  ttsVoice?: string;
  /** 只写不读；空字符串表示清除。 */
  ttsApiKey?: string;
  captureWidthDip?: number;
  captureHeightDip?: number;
}

/**
 * 版本检查只读 GitHub 公共信息，不做软件内下载/安装。
 * state=error 时 UI 静默，不打扰用户；只有 available 才提示。
 */
export interface DesktopUpdateStatus {
  state: 'unknown' | 'checking' | 'current' | 'available' | 'error';
  currentVersion: string;
  latestVersion: string | null;
  /** 打开 GitHub Releases 的链接；只有 host=github.com 且属于本项目才会被主进程采用。 */
  url: string | null;
  checkedAt: number | null;
  message: string | null;
}

export interface LlmTestResult {
  ok: boolean;
  message: string;
  latencyMs: number | null;
}

/**
 * preload 通过 contextBridge 暴露的唯一窗口 API。
 * 不要在这里加任意 ipcRenderer 透传；每个方法都要在主进程校验参数。
 */
export interface DesktopBridgeApi {
  readonly version: 1;
  readonly platform: 'win32' | 'darwin' | 'linux';
  readonly isOverlay: boolean;
  getStatus(): Promise<DesktopScreenStatus>;
  startHover(): Promise<DesktopScreenStatus>;
  stopHover(): Promise<DesktopScreenStatus>;
  lookupAtCursor(): Promise<ScreenLookupPayload>;
  requestScreenPermission(): Promise<DesktopScreenStatus>;
  openSystemSettings(panel: 'screen' | 'accessibility'): Promise<void>;
  getConfig(): Promise<DesktopPublicConfig>;
  updateConfig(patch: DesktopConfigPatch): Promise<DesktopPublicConfig>;
  testLlm(): Promise<LlmTestResult>;
  /** 文字交给主进程，使用设置里的云端 TTS 合成；返回值不含密钥。 */
  synthesizeSpeech(text: string): Promise<CloudSpeechResult>;
  clearCache(): Promise<number>;
  getUpdateStatus(): Promise<DesktopUpdateStatus>;
  checkForUpdates(): Promise<DesktopUpdateStatus>;
  openUpdatePage(): Promise<void>;
  onUpdateStatus(listener: (status: DesktopUpdateStatus) => void): () => void;
  /** 小窗挂载完成后调用，主进程会把最近一次结果补发过来。 */
  overlayReady(): Promise<void>;
  /** 鼠标进入小窗时把小窗激活，避免 Windows 第一次点击只用来激活窗口。 */
  focusOverlay(): Promise<void>;
  hideOverlay(): Promise<void>;
  /** 小窗内容变化时上报高度（DIP）；主进程负责限制最大高度。 */
  resizeOverlay(height: number): Promise<void>;
  openMainWindow(): Promise<void>;
  copyText(text: string): Promise<void>;
  onLookup(listener: (payload: ScreenLookupPayload) => void): () => void;
  onStatus(listener: (status: DesktopScreenStatus) => void): () => void;
  onConfig(listener: (config: DesktopPublicConfig) => void): () => void;
}
