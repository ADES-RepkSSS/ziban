/**
 * 语音能力抽象。
 *
 * 现在只有浏览器实现（Web Speech API，系统自带语音）。
 * 将来 Electron 版换成 sherpa-onnx + 中文 VITS 时，只要实现同一个接口，
 * 学习卡、朗读、逐字高亮都不用改。
 */

export interface VoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

export interface SpeakOptions {
  text: string;
  rate: number;
  voiceName?: string | null;
  onStart?: () => void;
  /** charIndex 是 utterance 原文中的下标；中文一般是按字。 */
  onBoundary?: (charIndex: number, name?: string) => void;
  onEnd?: () => void;
  onError?: (reason: string) => void;
}

export interface SpeechHandle {
  cancel: () => void;
}

export interface SpeechEngine {
  readonly id: string;
  isAvailable: () => boolean;
  listVoices: () => VoiceInfo[];
  speak: (options: SpeakOptions) => SpeechHandle;
  cancel: () => void;
}
