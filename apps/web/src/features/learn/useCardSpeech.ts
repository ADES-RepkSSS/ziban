import { useCallback, useEffect, useRef } from 'react';
import type { Card } from '@ziban/core';
import { useProgress } from '../../app/ProgressProvider';
import { useSpeech } from '../../app/SpeechProvider';

/**
 * 单张卡的朗读编排。
 *
 * 设计取舍：
 * - 进入卡片 450ms 后自动念“词 + 释义”。**不自动念例句**，否则一张卡要听太久；
 *   例句由用户点句子单独触发。
 * - 用户在任何时刻点字/释义/例句/图片，都先取消还没触发的自动朗读，
 *   否则 450ms 后会自动朗读会把用户刚点的声音抢掉。
 * - rate 从设置里实时读取，但放在 ref 里，避免语速变化导致整个 effect 重跑、把当前朗读打断。
 */
export function useCardSpeech(card: Card, autoPlay = true) {
  const { progress } = useProgress();
  const { speak, speakSequence, stop, activeSegment, charIndex, speaking, error, hasStarted } =
    useSpeech();
  const rate = progress.settings.rate;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const autoTimerRef = useRef<number | null>(null);

  // 只取消“还没开始”的自动朗读，不取消正在播放的声音；
  // 正在播放的声音由 speak()/speakSequence() 自己 cancel 上一个队列。
  const cancelAuto = useCallback(() => {
    if (autoTimerRef.current !== null) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const playCard = useCallback(() => {
    cancelAuto();
    const base = rateRef.current;
    const segments = [
      { text: card.text, segmentId: 'word', rate: Math.max(0.55, base * 0.9) },
      { text: card.meaning, segmentId: 'meaning', rate: base },
    ];
    speakSequence(segments);
  }, [cancelAuto, card.meaning, card.text, speakSequence]);

  const playChar = useCallback(
    (char: string, index: number) => {
      cancelAuto();
      speak({
        text: char,
        rate: Math.max(0.55, rateRef.current * 0.8),
        segmentId: `char:${index}`,
      });
    },
    [cancelAuto, speak],
  );

  const playMeaning = useCallback(() => {
    cancelAuto();
    speak({ text: card.meaning, rate: rateRef.current, segmentId: 'meaning' });
  }, [cancelAuto, card.meaning, speak]);

  const playSentence = useCallback(() => {
    cancelAuto();
    if (!card.sentence) return;
    speak({ text: card.sentence, rate: rateRef.current, segmentId: 'sentence' });
  }, [cancelAuto, card.sentence, speak]);

  const playImage = useCallback(() => {
    cancelAuto();
    if (!card.image.alt) return;
    speak({ text: card.image.alt, rate: rateRef.current, segmentId: 'image' });
  }, [cancelAuto, card.image.alt, speak]);

  useEffect(() => {
    if (!autoPlay) return;
    // 延迟一点，等页面切换/图片布局稳定；清理时同时清 timer 和朗读，
    // 避免离开卡片后声音还在继续。
    autoTimerRef.current = window.setTimeout(() => {
      autoTimerRef.current = null;
      playCard();
    }, 450);
    return () => {
      cancelAuto();
      stop();
    };
  }, [autoPlay, cancelAuto, card.id, playCard, stop]);

  return {
    playCard,
    playChar,
    playMeaning,
    playSentence,
    playImage,
    activeSegment,
    charIndex,
    speaking,
    error,
    hasStarted,
  };
}
