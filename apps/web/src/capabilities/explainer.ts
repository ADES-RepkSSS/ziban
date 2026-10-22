import { explainSentence } from '@ziban/core';
import type { Explainer } from './contracts';

/**
 * 当前唯一的讲解实现：只解释词表里确实有的词。
 * 接本地小模型时，新增一个 Explainer 实现即可，UI 不用改。
 */
export const localExplainer: Explainer = {
  id: 'offline-glossary-v1',
  explain: explainSentence,
};
