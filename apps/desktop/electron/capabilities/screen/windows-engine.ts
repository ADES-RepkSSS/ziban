/**
 * Windows 屏幕引擎：常驻 PowerShell + WinRT OCR。
 *
 * Windows 桌面程序截自己的屏幕不需要额外授权（受 DRM 保护的窗口会黑屏，
 * 这是系统行为，不是字伴的权限问题）。因此 permission 固定为 not-needed，
 * 减少老人看到“授权”字样的焦虑。
 */

import type { RawOcrPage, ScreenPermissionState } from '@ziban/core';
import { OcrHostError, WindowsOcrHost } from './windows.js';
import {
  ScreenError,
  type ScreenCaptureResult,
  type ScreenEngine,
  type ScreenStartResult,
} from './types.js';

export interface WinScreenOptions {
  scriptPath: string;
  tempDir?: string;
  onLog?: (message: string) => void;
}

export class WindowsScreenEngine implements ScreenEngine {
  readonly id = 'windows-winrt-ocr';
  readonly platform = 'win32' as const;
  private readonly options: WinScreenOptions;
  private host: WindowsOcrHost;
  private lastStart: ScreenStartResult | null = null;

  constructor(options: WinScreenOptions) {
    this.options = options;
    this.host = new WindowsOcrHost({
      scriptPath: options.scriptPath,
      ...(options.tempDir ? { tempDir: options.tempDir } : {}),
      ...(options.onLog ? { onLog: options.onLog } : {}),
      onExit: () => {
        this.lastStart = null;
      },
    });
  }

  async start(): Promise<ScreenStartResult> {
    try {
      const ready = await this.host.start();
      this.lastStart = {
        permission: 'not-needed',
        ocr: {
          ready: ready.ok,
          engine: ready.engine,
          language: ready.language,
          message: ready.ok
            ? null
            : ready.error ??
              '这台电脑还没有中文认字功能。可以请家里人在 Windows 设置里加中文语言包。',
        },
      };
    } catch (error) {
      this.lastStart = {
        permission: 'not-needed',
        ocr: {
          ready: false,
          engine: 'winrt',
          language: null,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
    return this.lastStart;
  }

  async getPermission(): Promise<ScreenPermissionState> {
    return 'not-needed';
  }

  async requestPermission(): Promise<ScreenPermissionState> {
    return 'not-needed';
  }

  async recognizeFile(filePath: string): Promise<RawOcrPage> {
    const page = await this.host.recognizeFile(filePath);
    return { width: page.width, height: page.height, lines: page.lines };
  }

  async captureAtCursor(widthDip: number, heightDip: number): Promise<ScreenCaptureResult> {
    if (!this.lastStart?.ocr.ready) {
      // 允许用户在启动失败后重试一次（比如刚装完语言包）。
      const started = await this.start();
      if (!started.ocr.ready) {
        throw new ScreenError(
          started.ocr.message?.includes('中文')
            ? 'NO_ZH_OCR'
            : 'OCR_NOT_READY',
          started.ocr.message ?? '这台电脑还没准备好认字',
        );
      }
    }

    try {
      const result = await this.host.capture(widthDip, heightDip);
      return {
        page: result.page,
        cursor: result.cursor,
        captureMs: result.captureMs,
        ocrMs: result.ocrMs,
        origin: result.origin,
        scale: result.scale,
        dpi: result.dpi,
        language: result.language,
      };
    } catch (error) {
      if (error instanceof OcrHostError && error.code === 'NO_ZH_OCR') {
        throw new ScreenError('NO_ZH_OCR', error.message.replace(/^NO_ZH_OCR:\s*/, ''));
      }
      if (error instanceof OcrHostError && error.code === 'SCREEN_LOCKED') {
        throw new ScreenError('SCREEN_LOCKED', error.message.replace(/^SCREEN_LOCKED:\s*/, ''));
      }
      if (error instanceof Error && error.message.includes('中文 OCR')) {
        throw new ScreenError('NO_ZH_OCR', error.message);
      }
      if (error instanceof ScreenError) throw error;
      throw new ScreenError(
        'CAPTURE_FAILED',
        error instanceof Error ? error.message : '这次没看清屏幕',
      );
    }
  }

  async dispose(): Promise<void> {
    await this.host.dispose();
  }
}
