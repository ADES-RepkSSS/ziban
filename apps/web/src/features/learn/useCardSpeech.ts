import { useCallback, useEffect, useRef } from 'react';
import type { Card } from '@ziban/core';
import { useProgress } from '../../app/ProgressProvider';
import { useSpeech } from '../../app/SpeechProvider';

export function useCardSpeech(card: Card, autoPlay = true) {
  const { progress } = useProgress();
  const { speak, speakSequence, stop, activeSegment, charIndex, speaking, error, hasStarted } =
    useSpeech();
  const rate = progress.settings.rate;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const autoTimerRef = useRef<number | null>(null);

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
