import type { Card, CardDeck } from '@ziban/core';
import rawDeck from '../content/cards.generated.json';

const deck = rawDeck as unknown as CardDeck;

export const cards: Card[] = deck.cards;
export const cardById = new Map(cards.map((card) => [card.id, card]));
export const knownChars = new Set(cards.flatMap((card) => card.chars));

export function getCard(id: string | undefined): Card | undefined {
  return id ? cardById.get(id) : undefined;
}

export function imageUrl(card: Card): string {
  return card.imageUrl ?? `./images/${card.image.file}`;
}

export function cardsByScene(scene: Card['scene']): Card[] {
  return cards.filter((card) => card.scene === scene);
}
