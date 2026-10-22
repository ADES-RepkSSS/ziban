import type { Card } from '@ziban/core';

interface WordTextProps {
  card: Card;
  activeSegment: string | null;
  charIndex: number;
  showPinyin?: boolean;
  onCharClick: (char: string, index: number) => void;
}

export function WordText({
  card,
  activeSegment,
  charIndex,
  showPinyin = false,
  onCharClick,
}: WordTextProps) {
  return (
    <h1 className={`word-text ${card.chars.length === 1 ? 'word-text--single' : ''}`}>
      {card.chars.map((char, index) => {
        const isSpeaking =
          (activeSegment === 'word' && charIndex === index) ||
          activeSegment === `char:${index}`;
        return (
          <button
            key={`${char}-${index}`}
            type="button"
            className={`word-char ${isSpeaking ? 'is-speaking' : ''}`}
            onClick={() => onCharClick(char, index)}
            aria-label={`单独听「${char}」`}
          >
            {showPinyin ? <span className="word-char__pinyin">{card.pinyin[index] ?? ''}</span> : null}
            <span className="word-char__glyph">{char}</span>
          </button>
        );
      })}
    </h1>
  );
}
