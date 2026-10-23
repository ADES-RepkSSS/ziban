/**
 * 屏幕能力层自己的类型。
 *
 * 上层（hover / knowledge / overlay）只依赖 ScreenEngine，不关心底层是
 * WinRT、Apple Vision 还是将来的 RapidOCR。平台判断只允许出现在本目录。
 */

import type {
  OcrStatus,
  RawOcrPage,
  ScreenPermissionState,
} from '@ziban/core';

export interface ScreenCaptureResult {
  /** 平台原始 OCR 结果；由 ScreenService 统一 normalize。 */
  page: RawOcrPage;
  /** 光标在 OCR 图片像素里的位置。 */
  cursor: { x: number; y: number };
  captureMs: number;
  ocrMs: number;
  /** 截图区域原点（DIP / 物理像素，仅诊断用）。 */
  origin: { x: number; y: number };
  /** 图片像素 / DIP 的倍率（Retina 为 2）。 */
  scale: number;
  dpi: number;
  language: string | null;
}

export interface ScreenStartResult {
  ocr: OcrStatus;
  permission: ScreenPermissionState;
}

export interface ScreenEngine {
  readonly id: string;
  readonly platform: 'win32' | 'darwin' | 'linux';
  /** 启动 OCR 子进程/检查权限；失败要返回可读的 OcrStatus，不要 throw 到 UI。 */
  start(): Promise<ScreenStartResult>;
  captureAtCursor(widthDip: number, heightDip: number): Promise<ScreenCaptureResult>;
  recognizeFile(filePath: string): Promise<RawOcrPage>;
  getPermission(): Promise<ScreenPermissionState>;
  /** 必须在用户点击的调用栈里触发；macOS 会弹系统授权框。 */
  requestPermission(): Promise<ScreenPermissionState>;
  dispose(): Promise<void>;
}

export class ScreenError extends Error {
  readonly code:
    | 'SCREEN_PERMISSION_DENIED'
    | 'SCREEN_PERMISSION_NOT_DETERMINED'
    | 'SCREEN_LOCKED'
    | 'CAPTURE_FAILED'
    | 'NO_ZH_OCR'
    | 'OCR_FAILED'
    | 'UNSUPPORTED_PLATFORM'
    | 'OCR_NOT_READY';

  constructor(code: ScreenError['code'], message: string) {
    super(message);
    this.name = 'ScreenError';
    this.code = code;
  }
}
