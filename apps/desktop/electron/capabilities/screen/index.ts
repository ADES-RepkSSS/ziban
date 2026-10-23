/**
 * 屏幕能力工厂：全仓库唯一出现 if (platform) 的地方之一（另一个是 permissions.ts）。
 *
 * 新增 Linux 支持时，只要实现 ScreenEngine 并在 switch 里加分支，
 * hover / knowledge / overlay 都不需要改。
 */

import type { ScreenEngine } from './types.js';
import { WindowsScreenEngine } from './windows-engine.js';
import { MacScreenEngine } from './macos.js';
import { ScreenError } from './types.js';

export interface CreateScreenEngineOptions {
  /** 仓库根目录 / 打包后的 app 路径，用于定位 native 资源。 */
  appPath: string;
  /** 例如 <repo>/apps/desktop/electron/native。 */
  nativePath: string;
  /** 用户数据目录，macOS 用来放编译后的 helper 和临时截图。 */
  userDataPath: string;
  /** 打包后的 resources 目录；开发时可为 undefined。 */
  resourcesPath?: string;
  onLog?: (message: string) => void;
}

class UnsupportedScreenEngine implements ScreenEngine {
  readonly id = 'unsupported';
  readonly platform: 'linux' = 'linux';
  private readonly message: string;

  constructor(message: string) {
    this.message = message;
  }

  async start() {
    return {
      permission: 'unknown' as const,
      ocr: {
        ready: false,
        engine: 'none',
        language: null,
        message: this.message,
      },
    };
  }

  async captureAtCursor(): Promise<never> {
    throw new ScreenError('UNSUPPORTED_PLATFORM', this.message);
  }

  async recognizeFile(): Promise<never> {
    throw new ScreenError('UNSUPPORTED_PLATFORM', this.message);
  }

  async getPermission() {
    return 'unknown' as const;
  }

  async requestPermission() {
    return 'unknown' as const;
  }

  async dispose(): Promise<void> {
    // no-op
  }
}

export function createScreenEngine(options: CreateScreenEngineOptions): ScreenEngine {
  if (process.platform === 'win32') {
    return new WindowsScreenEngine({
      scriptPath: `${options.nativePath}/windows/ocr-host.ps1`,
      ...(options.onLog ? { onLog: options.onLog } : {}),
    });
  }

  if (process.platform === 'darwin') {
    return new MacScreenEngine({
      swiftSourcePath: `${options.nativePath}/macos/vision-ocr.swift`,
      userDataPath: options.userDataPath,
      ...(options.resourcesPath ? { resourcesPath: options.resourcesPath } : {}),
      ...(options.onLog ? { onLog: options.onLog } : {}),
    });
  }

  return new UnsupportedScreenEngine(
    '这台电脑的系统还不在支持范围里。可以先让家里人把字粘贴到“帮我看屏幕”。',
  );
}
