import type { Card, CardDeck } from '@ziban/core';
import rawDeck from '../content/cards.generated.json';

/**
 * 内容只读入口。
 *
 * cards.generated.json 由 scripts/build-content.mjs 生成（YAML → 校验 → JSON），
 * 不要手改；改内容请改 content/cards/level1.yaml，然后跑 pnpm content:build。
 * imageUrl 是构建时注入的相对路径，Electron/Pages 子路径都靠它。
 */
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
