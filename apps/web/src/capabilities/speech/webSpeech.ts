import { pickChineseVoice } from '@ziban/core';
import type { SpeakOptions, SpeechEngine, SpeechHandle, VoiceInfo } from './engine';

/**
 * 浏览器系统语音。默认不联网，但具体是否离线取决于操作系统/浏览器安装的语音包；
 * 设置页会明确写出当前使用的语音名，方便家人判断。
 */
export class BrowserSpeechEngine implements SpeechEngine {
  readonly id = 'web-speech';

  private get synth(): SpeechSynthesis | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    return window.speechSynthesis;
  }

  isAvailable(): boolean {
    return this.synth !== null;
  }

  listVoices(): VoiceInfo[] {
    const synth = this.synth;
    if (!synth) return [];
    try {
      return synth.getVoices().map((voice) => ({
        name: voice.name,
        lang: voice.lang,
        localService: Boolean(voice.localService),
        default: Boolean(voice.default),
      }));
    } catch {
      return [];
    }
  }

  speak(options: SpeakOptions): SpeechHandle {
    const synth = this.synth;
    if (!synth) {
      options.onError?.('这个浏览器不能发声');
      return { cancel: () => undefined };
    }

    const utterance = new SpeechSynthesisUtterance(options.text);
    utterance.lang = 'zh-CN';
    utterance.rate = Math.min(1.5, Math.max(0.4, options.rate || 0.85));
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = synth.getVoices();
    const selected = options.voiceName
      ? voices.find((voice) => voice.name === options.voiceName)
      : undefined;
    const preferred = pickChineseVoice(
      voices.map((voice) => ({
        name: voice.name,
        lang: voice.lang,
        localService: voice.localService,
        default: voice.default,
      })),
    );
    const preferredVoice = preferred
      ? voices.find((voice) => voice.name === preferred.name)
      : undefined;
    const chosen = selected ?? preferredVoice ?? voices.find((voice) => voice.default);

    if (chosen) utterance.voice = chosen;

    let cancelled = false;

    utterance.onstart = () => {
      if (!cancelled) options.onStart?.();
    };
    utterance.onboundary = (event) => {
      if (!cancelled) options.onBoundary?.(event.charIndex, event.name);
    };
    utterance.onend = () => {
      if (!cancelled) options.onEnd?.();
    };
    utterance.onerror = (event) => {
      if (cancelled) return;
      if (event.error === 'canceled' || event.error === 'interrupted') return;
      options.onError?.(String(event.error || '语音播放失败'));
    };

    try {
      // 小窗是 showInactive()/后台窗口；某些 Chromium 版本会把语音队列挂起。
      // 用户点击“念”时主动 resume 一次，避免“没有报错但没有声音”。
      synth.resume();
      synth.speak(utterance);
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : '语音播放失败');
    }

    return {
      cancel: () => {
        cancelled = true;
        try {
          synth.cancel();
        } catch {
          // 忽略：某些浏览器在页面隐藏时 cancel 会抛错。
        }
      },
    };
  }

  cancel(): void {
    try {
      this.synth?.cancel();
    } catch {
      // 同上。
    }
  }
}

export const browserSpeech = new BrowserSpeechEngine();
