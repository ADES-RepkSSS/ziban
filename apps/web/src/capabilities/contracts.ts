import type { RiskNote, SentenceExplanation } from '@ziban/core';

/**
 * 附加功能的契约。
 *
 * 这一版只实现 Explainer（离线词表）。ScreenReader / PageReader /
 * PronunciationCoach 先定接口，等 Electron 壳和本地模型接入时再实现，
 * 基础识字卡不依赖它们。
 */

export interface Explainer {
  readonly id: string;
  /** 只能返回有把握的解释；没把握时必须返回 plain: null，不许编。 */
  explain(sentence: string): SentenceExplanation;
}

export interface ScreenFrame {
  width: number;
  height: number;
  /** data URL 或原始像素，由具体平台决定；上层只关心交给 OCR。 */
  data: string | ArrayBuffer;
}

export interface OcrBlock {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
}

export interface ScreenReader {
  readonly id: string;
  isAvailable(): boolean;
  capture(): Promise<ScreenFrame>;
  recognize(frame: ScreenFrame): Promise<OcrBlock[]>;
  /** 可选：原生能力可以直接读 AX 树，比 OCR 更准。 */
  readAccessibilityTree?(): Promise<OcrBlock[]>;
}

export interface PageContent {
  title: string;
  url: string;
  sentences: string[];
}

export interface PageReader {
  readonly id: string;
  canRead(url: string): boolean;
  read(url: string): Promise<PageContent>;
}

export interface PronunciationAttempt {
  target: string;
  audio: Blob | ArrayBuffer;
}

export interface PronunciationFeedback {
  /** null 表示没有可靠判断，绝不硬说“你读错了”。 */
  toneMatch: number | null;
  rhythmMatch: number | null;
  message: string;
}

export interface PronunciationCoach {
  readonly id: string;
  isAvailable(): boolean;
  evaluate(attempt: PronunciationAttempt): Promise<PronunciationFeedback>;
}

export type { RiskNote, SentenceExplanation };
