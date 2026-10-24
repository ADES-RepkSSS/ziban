import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  buildCharTimings,
  charIndexAtElapsed,
  estimateSpeechMs,
  type CharTiming,
  type DesktopPublicConfig,
} from '@ziban/core';
import { useProgress } from './ProgressProvider';
import { browserSpeech } from '../capabilities/speech/webSpeech';
import { cloudSpeech } from '../capabilities/speech/cloudSpeech';
import {
  loadWebCloudTtsConfig,
  subscribeWebCloudTts,
} from '../capabilities/speech/webCloudTts';
import { getDesktopBridge } from '../capabilities/desktop';
import type { SpeechEngine, VoiceInfo } from '../capabilities/speech/engine';

/**
 * 全局语音队列（整个 App 只有一个，任何页面 speak 都会打断上一个）。
 *
 * 三层保护，改之前先看懂：
 * 1. generation：每次 startQueue/stop 自增，旧 utterance 的 onend/onerror 回来时直接丢弃；
 * 2. segmentToken：同一个 generation 内再区分“当前段”，防止 watchdog 已切到下一段后，
 *    上一段迟到的 onend 又把下一段误结束；
 * 3. watchdog：按字时长估算 + 5s，浏览器不触发 onend 时兜底推进队列。
 *
 * 逐字高亮不是只靠 boundary：中文 boundary 不可靠，所以用 buildCharTimings()
 * 的字符时间轴驱动，boundary 到达时校正 anchor。
 *
 * 能力层只暴露 SpeechEngine；替换成 sherpa-onnx 时不要改这个文件的状态机。
 */
export interface SpeechSegment {
  text: string;
  segmentId: string;
  rate?: number;
}

interface SpeakOnce {
  text: string;
  rate?: number;
  segmentId?: string;
}

interface SpeechContextValue {
  supported: boolean;
  voices: VoiceInfo[];
  voiceName: string | null;
  speaking: boolean;
  activeSegment: string | null;
  charIndex: number;
  error: string | null;
  hasStarted: boolean;
  speak: (request: SpeakOnce) => void;
  speakSequence: (segments: SpeechSegment[], options?: { onFinish?: () => void }) => void;
  stop: () => void;
  setVoiceName: (name: string | null) => void;
  testVoice: (name?: string | null) => void;
  refreshVoices: () => void;
}

const SpeechContext = createContext<SpeechContextValue | null>(null);

const systemEngine: SpeechEngine = browserSpeech;
const cloudEngine: SpeechEngine = cloudSpeech;

export function SpeechProvider({ children }: { children: ReactNode }) {
  const { progress, update } = useProgress();
  const bridge = getDesktopBridge();
  const [voices, setVoices] = useState<VoiceInfo[]>(() => systemEngine.listVoices());
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [webTtsEnabled, setWebTtsEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [charIndex, setCharIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const queueRef = useRef<SpeechSegment[]>([]);
  const finishRef = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);
  const segmentTokenRef = useRef(0);
  const handleRef = useRef<{ cancel: () => void } | null>(null);
  const startSegmentRef = useRef<(segment: SpeechSegment, generation: number) => void>(() => undefined);
  const intervalRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const rateRef = useRef(progress.settings.rate);
  const voiceNameRef = useRef<string | null>(progress.settings.voiceName);
  const engine = (bridge ? ttsEnabled : webTtsEnabled) ? cloudEngine : systemEngine;
  const supported = engine.isAvailable();

  rateRef.current = progress.settings.rate;
  voiceNameRef.current = progress.settings.voiceName;

  useEffect(() => {
    let alive = true;
    if (!bridge) {
      const applyWeb = () => {
        if (!alive) return;
        const config = loadWebCloudTtsConfig();
        setWebTtsEnabled(Boolean(config.enabled && config.apiKey));
      };
      applyWeb();
      const unsubscribe = subscribeWebCloudTts(applyWeb);
      return () => {
        alive = false;
        unsubscribe();
      };
    }

    const apply = (config: DesktopPublicConfig) => {
      if (alive) setTtsEnabled(Boolean(config.tts.enabled && config.tts.hasApiKey));
    };
    void bridge
      .getConfig()
      .then(apply)
      .catch(() => {
        // 读不到配置就继续用本机声音，不阻塞朗读。
      });
    const unsubscribe = bridge.onConfig(apply);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [bridge]);

  const refreshVoices = useCallback(() => {
    // 系统声音列表始终留给设置页；云端音色由云端 TTS 自己的设置管理。
    const list = systemEngine.listVoices();
    if (list.length > 0) setVoices(list);
  }, []);

  useEffect(() => {
    refreshVoices();
    if (!supported) return;
    const synth = window.speechSynthesis;
    synth.addEventListener?.('voiceschanged', refreshVoices);
    const timers = [300, 900, 1800, 3200].map((delay) => window.setTimeout(refreshVoices, delay));
    return () => {
      synth.removeEventListener?.('voiceschanged', refreshVoices);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [refreshVoices, supported]);

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (watchdogRef.current !== null) window.clearTimeout(watchdogRef.current);
    intervalRef.current = null;
    watchdogRef.current = null;
  }, []);

  const finishCurrent = useCallback(
    (generation: number, token: number) => {
      if (generation !== generationRef.current || token !== segmentTokenRef.current) return;
      clearTimers();
      handleRef.current = null;
      setActiveSegment(null);
      setCharIndex(-1);
      const next = queueRef.current.shift();
      if (!next) {
        setSpeaking(false);
        const callback = finishRef.current;
        finishRef.current = null;
        callback?.();
        return;
      }
      startSegmentRef.current(next, generation);
    },
    [clearTimers],
  );

  const startSegment = useCallback(
    (segment: SpeechSegment, generation: number) => {
      if (generation !== generationRef.current) return;
      const token = segmentTokenRef.current + 1;
      segmentTokenRef.current = token;
      const text = segment.text.trim();
      if (!text) {
        finishCurrent(generation, token);
        return;
      }
      const rate = Math.min(1.2, Math.max(0.5, segment.rate ?? rateRef.current));
      const timings: CharTiming[] = buildCharTimings(text, rate);
      const anchorRef = { current: performance.now() };
      startedRef.current = false;

      setActiveSegment(segment.segmentId);
      setCharIndex(-1);
      setError(null);
      setSpeaking(true);

      const tick = () => {
        if (generation !== generationRef.current || token !== segmentTokenRef.current) return;
        const elapsed = performance.now() - anchorRef.current;
        const index = charIndexAtElapsed(timings, elapsed);
        setCharIndex((previous) => (previous === index ? previous : index));
      };

      intervalRef.current = window.setInterval(tick, 80);
      watchdogRef.current = window.setTimeout(
        () => finishCurrent(generation, token),
        estimateSpeechMs(text, rate) + 5000,
      );

      handleRef.current = engine.speak({
        text,
        rate,
        voiceName: voiceNameRef.current,
        onStart: () => {
          if (generation !== generationRef.current || token !== segmentTokenRef.current) return;
          startedRef.current = true;
          setHasStarted(true);
          anchorRef.current = performance.now();
          tick();
        },
        onBoundary: (index) => {
          if (generation !== generationRef.current || token !== segmentTokenRef.current) return;
          const timing = timings[index];
          if (timing) {
            anchorRef.current = performance.now() - timing.startMs;
            setCharIndex(index);
          }
        },
        onEnd: () => finishCurrent(generation, token),
        onError: (reason) => {
          if (generation !== generationRef.current || token !== segmentTokenRef.current) return;
          setError(humanizeSpeechError(reason));
          finishCurrent(generation, token);
        },
      });
    },
    [engine, finishCurrent],
  );

  startSegmentRef.current = startSegment;

  const startQueue = useCallback(
    (segments: SpeechSegment[], onFinish?: () => void) => {
      engine.cancel();
      clearTimers();
      generationRef.current += 1;
      const generation = generationRef.current;
      queueRef.current = segments.filter((segment) => segment.text.trim());
      finishRef.current = onFinish ?? null;
      setError(null);
      setCharIndex(-1);
      const first = queueRef.current.shift();
      if (!first) {
        setSpeaking(false);
        setActiveSegment(null);
        onFinish?.();
        return;
      }
      startSegment(first, generation);
    },
    [clearTimers, engine, startSegment],
  );

  const speak = useCallback(
    (request: SpeakOnce) => {
      startQueue([
        {
          text: request.text,
          segmentId: request.segmentId ?? 'speech',
          rate: request.rate,
        },
      ]);
    },
    [startQueue],
  );

  const speakSequence = useCallback(
    (segments: SpeechSegment[], options?: { onFinish?: () => void }) => {
      startQueue(segments, options?.onFinish);
    },
    [startQueue],
  );

  const stop = useCallback(() => {
    generationRef.current += 1;
    segmentTokenRef.current += 1;
    engine.cancel();
    clearTimers();
    queueRef.current = [];
    finishRef.current = null;
    handleRef.current = null;
    setSpeaking(false);
    setActiveSegment(null);
    setCharIndex(-1);
  }, [clearTimers, engine]);

  useEffect(() => () => stop(), [stop]);

  const setVoiceName = useCallback(
    (name: string | null) => {
      update((previous) => ({
        ...previous,
        settings: { ...previous.settings, voiceName: name },
      }));
      voiceNameRef.current = name;
    },
    [update],
  );

  const testVoice = useCallback(
    (name?: string | null) => {
      const chosen = name === undefined ? voiceNameRef.current : name;
      if (name !== undefined) {
        voiceNameRef.current = chosen;
      }
      startQueue([
        {
          text: '你好，我是字伴。这个声音，你听得清吗？',
          segmentId: 'voice-test',
          rate: rateRef.current,
        },
      ]);
    },
    [startQueue],
  );

  const value = useMemo<SpeechContextValue>(
    () => ({
      supported,
      voices,
      voiceName: progress.settings.voiceName,
      speaking,
      activeSegment,
      charIndex,
      error,
      hasStarted,
      speak,
      speakSequence,
      stop,
      setVoiceName,
      testVoice,
      refreshVoices,
    }),
    [
      supported,
      voices,
      progress.settings.voiceName,
      speaking,
      activeSegment,
      charIndex,
      error,
      hasStarted,
      speak,
      speakSequence,
      stop,
      setVoiceName,
      testVoice,
      refreshVoices,
    ],
  );

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

function humanizeSpeechError(reason: string): string {
  if (/not-allowed|not allowed/i.test(reason)) {
    return '浏览器没让声音放出来。点一下「再念一遍」试试。';
  }
  if (/no voice|voice/i.test(reason)) {
    return '这台电脑好像没有中文声音。可以让家里人帮你装一个。';
  }
  if (/network/i.test(reason)) {
    return '声音需要联网，但这次没连上。再点一下试试。';
  }
  if (/云端|密钥|额度|模型|音色|网址/.test(reason)) {
    return reason;
  }
  return '这次没念出来。再点一下「再念一遍」。';
}

export function useSpeech(): SpeechContextValue {
  const value = useContext(SpeechContext);
  if (!value) throw new Error('useSpeech 必须在 SpeechProvider 内使用');
  return value;
}
