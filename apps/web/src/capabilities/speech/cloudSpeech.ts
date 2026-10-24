/**
 * 云端 TTS 的渲染层实现。
 *
 * 音频由主进程调用 /audio/speech 合成后返回；这里只负责把字节变成 <audio> 播放。
 * 不保存音频、不写 localStorage、不把 API Key带回渲染层。
 */

import { getDesktopBridge } from '../desktop';
import type { SpeakOptions, SpeechEngine, SpeechHandle, VoiceInfo } from './engine';

const CLOUD_VOICE: VoiceInfo = {
  name: '云端语音',
  lang: 'zh-CN',
  localService: false,
  default: true,
};

export class CloudSpeechEngine implements SpeechEngine {
  readonly id = 'cloud-tts';
  private currentAudio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  private generation = 0;

  isAvailable(): boolean {
    return getDesktopBridge() !== null;
  }

  listVoices(): VoiceInfo[] {
    return [CLOUD_VOICE];
  }

  private cleanup(): void {
    if (this.currentAudio) {
      this.currentAudio.onplay = null;
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }

  speak(options: SpeakOptions): SpeechHandle {
    this.cancel();
    const generation = this.generation;
    let cancelled = false;
    const bridge = getDesktopBridge();

    if (!bridge) {
      queueMicrotask(() => options.onError?.('云端语音只在电脑版可用。'));
      return { cancel: () => undefined };
    }

    void bridge
      .synthesizeSpeech(options.text)
      .then((result) => {
        if (cancelled || generation !== this.generation) return;
        if (!result.ok || !result.audio) {
          options.onError?.(result.message ?? '云端语音没念出来，再试一次。');
          return;
        }

        const bytes =
          result.audio instanceof Uint8Array ? result.audio : new Uint8Array(result.audio);
        // 复制成独立的 ArrayBuffer，避免 Blob 拿到 SharedArrayBuffer/偏移切片。
        const audioBuffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        const url = URL.createObjectURL(
          new Blob([audioBuffer], { type: result.mimeType ?? 'audio/mpeg' }),
        );
        const audio = new Audio(url);
        this.currentAudio = audio;
        this.currentUrl = url;
        audio.playbackRate = Math.min(1.5, Math.max(0.5, options.rate));

        const finish = (ended: boolean) => {
          if (cancelled || generation !== this.generation) return;
          this.cleanup();
          if (ended) options.onEnd?.();
          else options.onError?.('云端语音没念出来，再试一次。');
        };

        audio.onplay = () => {
          if (!cancelled && generation === this.generation) options.onStart?.();
        };
        audio.onended = () => finish(true);
        audio.onerror = () => finish(false);
        void audio.play().catch(() => finish(false));
      })
      .catch((error: unknown) => {
        if (cancelled || generation !== this.generation) return;
        options.onError?.(
          error instanceof Error ? error.message : '没连上云端语音，检查网络或设置。',
        );
      });

    return {
      cancel: () => {
        cancelled = true;
        this.cancel();
      },
    };
  }

  cancel(): void {
    this.generation += 1;
    this.cleanup();
  }
}

export const cloudSpeech = new CloudSpeechEngine();
