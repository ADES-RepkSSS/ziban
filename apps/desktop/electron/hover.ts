/**
 * 光标跟随控制器。
 *
 * 目标不是“高频录屏”，而是“老人把鼠标停在字上，停一下，就有解释”：
 * 1. 每 160ms 只看光标位置（不截屏、不 OCR）；
 * 2. 光标停稳 380ms 才截一次（按显示器工作区自适应，约 260–420 DIP 宽），所以移动过程中没有开销；
 * 3. 同一位置最多 650ms 一次；同一结果 2.5s 内不重复；
 * 4. 截图只截光标周围，不截全屏；小窗自身 setContentProtection，避免 OCR 自己；
 * 5. 老人把鼠标移到小窗上时暂停截图，方便点“再念一遍/收起”。
 *
 * 失败时不要指责用户：所有错误只给“这次没看清，再试一下”这种话。
 */

import {
  isKnowledgeEmpty,
  lookupAtPoint,
  lookupKey,
  normalizeOcrPage,
  type LookupOrigin,
  type LookupTarget,
  type ScreenLookupPayload,
} from '@ziban/core';
import type { ScreenEngine } from './capabilities/screen/types.js';
import { ScreenError } from './capabilities/screen/types.js';
import type { KnowledgeService } from './capabilities/knowledge/service.js';
import type { OverlayController } from './overlay.js';

export interface HoverOptions {
  screen: ScreenEngine;
  knowledge: KnowledgeService;
  overlay: OverlayController;
  getCursorPoint: () => { x: number; y: number };
  /** 主窗口范围：光标在字伴主窗口里时不弹小窗，避免打扰。 */
  isPointInMainWindow: (point: { x: number; y: number }) => boolean;
  getCaptureSize: () => { width: number; height: number };
  onStatusRefresh: () => void;
  onError?: (message: string) => void;
  /** 成功取到词时调用，用于清掉上一次的临时错误提示。 */
  onSuccess?: () => void;
  onLog?: (message: string) => void;
}

const POLL_MS = 160;
const STILL_MS = 380;
const MIN_CAPTURE_GAP_MS = 650;
const SAME_POINT_RETRY_MS = 2500;
const MOVE_HIDE_MS = 700;
const MOVE_HIDE_DISTANCE = 90;

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class HoverController {
  private readonly options: HoverOptions;
  private timer: NodeJS.Timeout | null = null;
  private hideTimer: NodeJS.Timeout | null = null;
  private running = false;
  private busy = false;
  private requestSeq = 0;
  private lastPoint: { x: number; y: number } | null = null;
  private stillSince = 0;
  private lastCaptureAt = 0;
  private lastAttemptPoint: { x: number; y: number } | null = null;
  private lastAttemptAt = 0;
  private lastShownPoint: { x: number; y: number } | null = null;
  private lastKey: string | null = null;
  private suppressPoint: { x: number; y: number } | null = null;
  private consecutiveErrors = 0;

  constructor(options: HoverOptions) {
    this.options = options;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastPoint = null;
    this.stillSince = 0;
    this.lastKey = null;
    this.suppressPoint = null;
    this.consecutiveErrors = 0;
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_MS);
    this.options.onLog?.('开始跟随鼠标');
  }

  stop(): void {
    this.running = false;
    // 让还在路上的大模型结果作废，避免“已经收起又弹回来”。
    this.requestSeq += 1;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
    this.options.overlay.hide();
    this.options.onLog?.('暂停跟随鼠标');
    // 内部因权限/连续错误停下时也要让设置页/首页看到 hover=false。
    this.options.onStatusRefresh();
  }

  /** 用户点了“收起”：鼠标不动就不再自动弹回来。 */
  suppressUntilMove(): void {
    this.requestSeq += 1;
    this.suppressPoint = this.options.getCursorPoint();
    this.options.overlay.hide();
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  private scheduleHide(delay = MOVE_HIDE_MS): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.options.overlay.hide();
      this.lastKey = null;
    }, delay);
  }

  private cancelHide(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  private async tick(): Promise<void> {
    if (!this.running || this.busy) return;
    const cursor = this.options.getCursorPoint();

    // 鼠标在小窗上：保留小窗，暂停截图，让老人能点按钮。
    if (this.options.overlay.isVisible && this.options.overlay.contains(cursor)) {
      this.cancelHide();
      return;
    }

    // 鼠标回到字伴主窗口：把小窗收起来，别挡着自己。
    if (this.options.isPointInMainWindow(cursor)) {
      if (this.options.overlay.isVisible) this.options.overlay.hide();
      return;
    }

    if (this.suppressPoint && distance(cursor, this.suppressPoint) < 30) {
      return;
    }
    this.suppressPoint = null;

    const moved = !this.lastPoint || distance(cursor, this.lastPoint) > 4;
    if (moved) {
      this.lastPoint = cursor;
      this.stillSince = Date.now();
      if (
        this.options.overlay.isVisible &&
        this.lastShownPoint &&
        distance(cursor, this.lastShownPoint) > MOVE_HIDE_DISTANCE
      ) {
        this.scheduleHide();
      }
      return;
    }

    if (Date.now() - this.stillSince < STILL_MS) return;
    if (Date.now() - this.lastCaptureAt < MIN_CAPTURE_GAP_MS) return;
    if (this.options.isPointInMainWindow(cursor)) return;

    if (
      this.lastAttemptPoint &&
      this.lastKey &&
      this.options.overlay.isVisible &&
      distance(cursor, this.lastAttemptPoint) < 3 &&
      Date.now() - this.lastAttemptAt < SAME_POINT_RETRY_MS
    ) {
      return;
    }

    await this.runLookup('hover');
  }

  /**
   * 手动按热键/按钮触发一次。和 hover 共用同一套截图 + 取词 + 讲解，
   * 但不要求“停稳 380ms”。
   */
  async trigger(origin: LookupOrigin = 'hotkey'): Promise<ScreenLookupPayload | null> {
    return this.runLookup(origin);
  }

  private payloadFor(
    requestId: number,
    origin: LookupOrigin,
    status: ScreenLookupPayload['status'],
    target: LookupTarget | null,
    knowledge: ScreenLookupPayload['knowledge'],
    risk: ScreenLookupPayload['risk'],
    message: string | null,
    timing: ScreenLookupPayload['timing'],
  ): ScreenLookupPayload {
    return { requestId, status, target, knowledge, risk, message, origin, timing };
  }

  private async runLookup(origin: LookupOrigin): Promise<ScreenLookupPayload | null> {
    if (this.busy) return null;
    this.busy = true;
    const started = Date.now();
    const requestId = ++this.requestSeq;
    const cursor = this.options.getCursorPoint();
    this.lastAttemptPoint = cursor;
    this.lastAttemptAt = Date.now();
    this.lastCaptureAt = Date.now();

    try {
      const size = this.options.getCaptureSize();
      const capture = await this.options.screen.captureAtCursor(size.width, size.height);
      this.consecutiveErrors = 0;
      const page = normalizeOcrPage(capture.page);
      const target = lookupAtPoint(
        page,
        capture.cursor,
        this.options.knowledge.targetLexicon,
        this.options.knowledge.maxWordLength,
      );

      if (process.env.ZIBAN_DEBUG_LOOKUP) {
        this.options.onLog?.(
          `OCR ${page.lines.length} 行，光标=${capture.cursor.x},${capture.cursor.y}：${page.lines
            .map((line) => `${line.text}@${Math.round(line.rect.x)},${Math.round(line.rect.y)}`)
            .join(' | ')}`,
        );
      }

      if (!target) {
        this.lastKey = null;
        if (origin !== 'hover') {
          return this.showMessage(
            requestId,
            origin,
            '这里没看清字。把鼠标放到一个字上，停一下，再按一次。',
            capture.captureMs + capture.ocrMs,
          );
        }
        this.options.overlay.hide();
        return null;
      }

      if (process.env.ZIBAN_DEBUG_LOOKUP) {
        this.options.onLog?.(
          `取词：${target.text}（${target.lineText}）光标=${capture.cursor.x},${capture.cursor.y}`,
        );
      }

      this.options.onSuccess?.();
      const key = lookupKey(target);
      if (origin === 'hover' && key === this.lastKey && this.options.overlay.isVisible) {
        return null;
      }

      this.lastKey = key;
      this.lastShownPoint = cursor;
      this.cancelHide();

      const local = this.options.knowledge.localLookup(target);
      const timing = {
        captureMs: capture.captureMs,
        ocrMs: capture.ocrMs,
        totalMs: Date.now() - started,
      };
      const hasMeaning = Boolean(local.knowledge.definition || local.knowledge.example);
      const firstStatus = local.needsLlm ? 'loading' : 'ready';
      const firstMessage = local.needsLlm
        ? '电脑正在想更清楚的解释…'
        : hasMeaning
          ? null
          : '这个字我只会念，还讲不好。';
      const firstPayload = this.payloadFor(
        requestId,
        origin,
        firstStatus,
        target,
        local.knowledge,
        local.risk,
        firstMessage,
        timing,
      );
      this.options.overlay.show(firstPayload, cursor);

      if (!local.needsLlm || requestId !== this.requestSeq) {
        if (isKnowledgeEmpty(local.knowledge)) {
          const emptyPayload = this.payloadFor(
            requestId,
            origin,
            'empty',
            target,
            local.knowledge,
            local.risk,
            '这个字我只会念，还讲不好。',
            timing,
          );
          this.options.overlay.show(emptyPayload, cursor);
          return emptyPayload;
        }
        return firstPayload;
      }

      const enriched = await this.options.knowledge.enrich(target, local);
      if (requestId !== this.requestSeq) return firstPayload;

      const result = this.payloadFor(
        requestId,
        origin,
        isKnowledgeEmpty(enriched.knowledge) ? 'empty' : 'ready',
        target,
        enriched.knowledge,
        enriched.risk,
        enriched.warning,
        {
          captureMs: capture.captureMs,
          ocrMs: capture.ocrMs,
          totalMs: Date.now() - started,
        },
      );
      this.options.overlay.show(result, cursor);
      return result;
    } catch (error) {
      if (requestId !== this.requestSeq) return null;
      const code = error instanceof ScreenError ? error.code : null;
      const message =
        error instanceof ScreenError
          ? error.message
          : error instanceof Error
            ? error.message
            : '这次没看清屏幕，再试一下。';
      this.options.onLog?.(`取词没成功：${message}`);
      this.options.onError?.(message);
      this.options.onStatusRefresh();

      // hover 模式下权限/OCR 错误通常意味着功能不可用，不要每 2.5s 弹一次。
      if (
        origin === 'hover' &&
        (code === 'SCREEN_PERMISSION_DENIED' ||
          code === 'SCREEN_PERMISSION_NOT_DETERMINED' ||
          code === 'SCREEN_LOCKED')
      ) {
        this.stop();
        return null;
      }
      if (origin === 'hover') {
        this.consecutiveErrors += 1;
        if (this.consecutiveErrors >= 3) {
          this.running = false;
          if (this.timer) clearInterval(this.timer);
          this.timer = null;
          const stopped = this.showMessage(
            requestId,
            origin,
            '看屏幕暂时停下来了。点“开始看屏幕”再试一次。',
            300,
          );
          this.options.onStatusRefresh();
          return stopped;
        }
      }
      return this.showMessage(requestId, origin, message, Date.now() - started);
    } finally {
      this.busy = false;
    }
  }

  private showMessage(
    requestId: number,
    origin: LookupOrigin,
    message: string,
    elapsedMs: number,
  ): ScreenLookupPayload {
    const cursor = this.options.getCursorPoint();
    const payload = this.payloadFor(
      requestId,
      origin,
      'error',
      null,
      null,
      null,
      message,
      { captureMs: 0, ocrMs: 0, totalMs: elapsedMs },
    );
    this.options.overlay.show(payload, cursor);
    // 错误/空提示 2.6s 后自己收起；hover 模式不长期占屏。
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.options.overlay.hide();
    }, 2600);
    return payload;
  }

  dispose(): void {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.timer = null;
    this.hideTimer = null;
    this.options.overlay.hide();
  }
}
