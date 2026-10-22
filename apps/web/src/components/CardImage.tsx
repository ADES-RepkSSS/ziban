import { useEffect, useState } from 'react';
import type { Card } from '@ziban/core';
import { Icon } from './Icon';
import { imageUrl } from '../content/deck';

interface CardImageProps {
  card: Card;
  onActivate?: () => void;
  size?: 'study' | 'thumb' | 'detail' | 'hero';
  eager?: boolean;
}

export function CardImage({ card, onActivate, size = 'study', eager = false }: CardImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [card.id]);

  const content = failed ? (
    <span className="card-image__fallback">
      <Icon name="image" size={64} />
      <span>{card.image.alt ?? card.text}</span>
    </span>
  ) : (
    <img
      className="card-image__img"
      src={imageUrl(card)}
      alt={card.image.alt ?? card.text}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );

  if (!onActivate) {
    return <div className={`card-image card-image--${size}`}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={`card-image card-image--${size} card-image--button`}
      onClick={onActivate}
      aria-label={`看图听一听：${card.image.alt ?? card.text}`}
    >
      {content}
      <span className="card-image__hint">
        <Icon name="speaker" size={22} />
        <span>点图听一听</span>
      </span>
    </button>
  );
}
