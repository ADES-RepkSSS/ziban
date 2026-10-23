/**
 * macOS 屏幕取词：系统 `screencapture` + Apple Vision。
 *
 * 为什么拆成两个进程：
 * - 截屏用 macOS 自带的 `/usr/sbin/screencapture`：它由 Apple 签名，权限提示
 *   归到当前 App；而且支持 `-R x,y,w,h` 只截光标周围的小区域，不需要录整屏。
 * - OCR 用我们自己编译的极小 Swift 程序：只读 PNG，不碰屏幕，因此它不需要
 *   屏幕录制权限；权限问题被收敛到“截屏”这一层，排查简单。
 *
 * 为什么不是 Electron desktopCapturer：
 * - desktopCapturer 适合整屏/窗口共享，不适合 2–3Hz 取小块；每帧拿全屏
 *   thumbnail 再裁剪，在旧 MacBook 上内存/CPU 都偏高。
 * - 以后如果要更快，可换 ScreenCaptureKit 的常驻流（见 docs/08 的后续项），
 *   但 ScreenCaptureKit 需要额外 TCC 处理，先把可测试的简单路径做对。
 *
 * 隐私：截图写到 userData/tmp，OCR 完立即删除；不保留历史帧。
 */

import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import readline from 'node:readline';
import { app, nativeImage, screen } from 'electron';
import {
  regionAroundPoint,
  type RawOcrLine,
  type RawOcrPage,
  type Rect,
  type ScreenPermissionState,
} from '@ziban/core';
import { getScreenPermission, permissionHint, requestScreenPermission } from './permissions.js';
import {
  ScreenError,
  type ScreenCaptureResult,
  type ScreenEngine,
  type ScreenStartResult,
} from './types.js';

const execFileAsync = promisify(execFile);
const VISION_BINARY_NAME = 'ziban-vision-ocr';

export interface MacScreenOptions {
  /** 仓库里的 native/macos/vision-ocr.swift。 */
  swiftSourcePath: string;
  /** 用户数据目录，用来放编译后的 helper 和临时截图。 */
  userDataPath: string;
  /** 打包后的 resources 目录；开发时为仓库根目录。 */
  resourcesPath?: string;
  onLog?: (message: string) => void;
}

interface PendingRequest {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface VisionLine {
  id?: string;
  ready?: boolean;
  ok?: boolean;
  error?: string;
  engine?: string;
  width?: number;
  height?: number;
  ocrMs?: number;
  lines?: RawOcrLine[];
}

export class MacOcrHost {
  private readonly options: MacScreenOptions;
  private child: ChildProcessWithoutNullStreams | null = null;
  private rl: readline.Interface | null = null;
  private pending = new Map<string, PendingRequest>();
  private nextId = 1;
  private binaryPath: string | null = null;
  private ready: { ok: boolean; message: string | null } | null = null;
  private readyWaiter: {
    resolve: (value: { ok: boolean; message: string | null }) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  } | null = null;

  constructor(options: MacScreenOptions) {
    this.options = options;
  }

  private log(message: string): void {
    this.options.onLog?.(message);
  }

  /** 找已编译好的 helper；没有就尝试用 Xcode 命令行工具编译一次。 */
  async ensureBinary(): Promise<string> {
    if (this.binaryPath && existsSync(this.binaryPath)) return this.binaryPath;

    const candidates = [
      path.join(this.options.userDataPath, 'bin', VISION_BINARY_NAME),
      this.options.resourcesPath
        ? path.join(this.options.resourcesPath, 'bin', VISION_BINARY_NAME)
        : '',
      path.join(app.getAppPath(), 'dist-native', VISION_BINARY_NAME),
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        try {
          chmodSync(candidate, 0o755);
        } catch {
          // 只读安装目录也能执行；权限改不了不影响。
        }
        this.binaryPath = candidate;
        return candidate;
      }
    }

    const source = this.options.swiftSourcePath;
    if (!existsSync(source)) {
      throw new ScreenError(
        'OCR_FAILED',
        '找不到 macOS 的认字小工具；请重新安装字伴，或运行 pnpm desktop:prepare。',
      );
    }

    const output = path.join(this.options.userDataPath, 'bin', VISION_BINARY_NAME);
    mkdirSync(path.dirname(output), { recursive: true });

    try {
      await execFileAsync('xcrun', ['--sdk', 'macosx', '--find', 'swiftc'], { timeout: 15_000 });
    } catch {
      throw new ScreenError(
        'OCR_FAILED',
        '第一次在 Mac 上用“看屏幕”，需要安装免费的 Xcode 命令行工具：打开“终端”，输入 xcode-select --install，装完再回来。',
      );
    }

    const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
    this.log('第一次准备 macOS 认字工具，可能需要十几秒…');
    try {
      await execFileAsync(
        'xcrun',
        [
          '--sdk',
          'macosx',
          'swiftc',
          '-O',
          '-whole-module-optimization',
          // 最低 macOS 11（中文 Vision OCR 下限），避免在更高系统编译后旧机跑不了。
          '-target',
          `${arch}-apple-macos11.0`,
          '-framework',
          'Vision',
          '-framework',
          'ImageIO',
          '-framework',
          'CoreGraphics',
          source,
          '-o',
          output,
        ],
        { timeout: 240_000, maxBuffer: 4 * 1024 * 1024 },
      );
      chmodSync(output, 0o755);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ScreenError(
        'OCR_FAILED',
        `macOS 认字工具没准备成功。请确认已安装 Xcode 命令行工具。技术信息：${detail.slice(0, 300)}`,
      );
    }

    this.binaryPath = output;
    return output;
  }

  async start(): Promise<{ ok: boolean; message: string | null }> {
    if (this.child && this.ready) return this.ready;
    const binary = await this.ensureBinary();

    const child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    this.rl = readline.createInterface({ input: child.stdout });
    this.rl.on('line', (line) => this.handleLine(line));
    child.stderr.on('data', (chunk: string) => {
      const text = chunk.trim();
      if (text) this.log(`[vision-ocr] ${text}`);
    });
    child.on('error', (error) => {
      this.rejectAll(new ScreenError('OCR_FAILED', error.message));
    });
    child.on('exit', (code) => {
      this.log(`Vision OCR 退出：${String(code)}`);
      this.child = null;
      this.ready = null;
      this.rl?.close();
      this.rl = null;
      this.rejectAll(new ScreenError('OCR_FAILED', '认字小工具停下来了'));
    });

    return this.waitForReady();
  }

  private waitForReady(): Promise<{ ok: boolean; message: string | null }> {
    if (this.ready) return Promise.resolve(this.ready);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.readyWaiter = null;
        reject(new ScreenError('OCR_FAILED', 'Mac 认字工具启动超时'));
      }, 15_000);
      this.readyWaiter = { resolve, reject, timer };
    });
  }

  private settleReady(value: { ok: boolean; message: string | null }): void {
    this.ready = value;
    const waiter = this.readyWaiter;
    if (!waiter) return;
    this.readyWaiter = null;
    clearTimeout(waiter.timer);
    waiter.resolve(value);
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: VisionLine;
    try {
      parsed = JSON.parse(trimmed) as VisionLine;
    } catch {
      return;
    }

    if (parsed.ready) {
      this.settleReady({
        ok: parsed.ok !== false,
        message: parsed.ok === false ? (parsed.error ?? 'Mac 认字工具不可用') : null,
      });
      return;
    }

    const pending = this.pending.get(parsed.id ?? '');
    if (!pending) return;
    this.pending.delete(parsed.id ?? '');
    clearTimeout(pending.timer);
    if (parsed.ok === false) {
      pending.reject(new ScreenError('OCR_FAILED', parsed.error ?? '这次没认出来'));
      return;
    }
    pending.resolve(parsed as unknown as Record<string, unknown>);
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    const waiter = this.readyWaiter;
    if (waiter) {
      this.readyWaiter = null;
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  async recognizeFile(filePath: string): Promise<RawOcrPage & { ocrMs: number }> {
    if (!this.child || !this.ready?.ok) {
      throw new ScreenError('OCR_NOT_READY', 'Mac 认字工具还没准备好');
    }
    const id = String(this.nextId++);
    const parsed = await new Promise<VisionLine>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new ScreenError('OCR_FAILED', '这次认字花的时间有点长'));
      }, 10_000);
      this.pending.set(id, {
        resolve: (value) => resolve(value as VisionLine),
        reject,
        timer,
      });
      this.child?.stdin.write(
        `${JSON.stringify({
          id,
          cmd: 'ocr-file',
          path: filePath,
          languages: ['zh-Hans', 'zh-Hant', 'en-US'],
        })}\n`,
      );
    });

    return {
      width: parsed.width ?? 0,
      height: parsed.height ?? 0,
      lines: parsed.lines ?? [],
      ocrMs: parsed.ocrMs ?? 0,
    };
  }

  async dispose(): Promise<void> {
    const child = this.child;
    if (child) {
      try {
        child.stdin.write(`${JSON.stringify({ id: 'quit', cmd: 'quit' })}\n`);
      } catch {
        // ignore
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          try {
            child.kill();
          } catch {
            // ignore
          }
          resolve();
        }, 700);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    this.rejectAll(new ScreenError('OCR_FAILED', '已经关上看屏幕'));
  }
}

interface MacCapture {
  filePath: string;
  width: number;
  height: number;
  scale: number;
  captureMs: number;
}

/** 用系统 screencapture 截取一块区域；调用方负责删文件。 */
async function captureWithSystem(region: Rect, tempPath: string): Promise<MacCapture> {
  const started = Date.now();
  const rect = `${Math.round(region.x)},${Math.round(region.y)},${Math.round(region.width)},${Math.round(region.height)}`;
  try {
    await execFileAsync(
      '/usr/sbin/screencapture',
      ['-x', '-t', 'png', `-R${rect}`, tempPath],
      { timeout: 5_000 },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ScreenError(
      'CAPTURE_FAILED',
      `系统没让截屏。请检查“屏幕录制”权限。技术信息：${detail.slice(0, 200)}`,
    );
  }

  const image = nativeImage.createFromPath(tempPath);
  if (image.isEmpty()) {
    throw new ScreenError(
      'CAPTURE_FAILED',
      '截到的屏幕是空的。可能是屏幕录制权限没打开；打开后要重启字伴。',
    );
  }
  const size = image.getSize();
  return {
    filePath: tempPath,
    width: size.width,
    height: size.height,
    scale: region.width > 0 ? size.width / region.width : 1,
    captureMs: Date.now() - started,
  };
}

export class MacScreenEngine implements ScreenEngine {
  readonly id = 'macos-screencapture-vision';
  readonly platform = 'darwin' as const;
  private readonly options: MacScreenOptions;
  private host: MacOcrHost;
  private readyMessage: string | null = null;

  constructor(options: MacScreenOptions) {
    this.options = options;
    this.host = new MacOcrHost(options);
  }

  /** 清掉上次异常退出留下的临时截图（超过 1 小时），避免隐私残留。 */
  private cleanupTemp(): void {
    const dir = path.join(this.options.userDataPath, 'tmp');
    try {
      const now = Date.now();
      for (const name of readdirSync(dir)) {
        if (!name.startsWith('screen-') || !name.endsWith('.png')) continue;
        const file = path.join(dir, name);
        try {
          if (now - statSync(file).mtimeMs > 60 * 60 * 1000) rmSync(file, { force: true });
        } catch {
          // 单个文件删不掉不影响启动。
        }
      }
    } catch {
      // 目录不存在/没权限，忽略。
    }
  }

  async start(): Promise<ScreenStartResult> {
    this.cleanupTemp();
    const permission = await getScreenPermission();
    let ocrReady = false;
    try {
      const ready = await this.host.start();
      ocrReady = ready.ok;
      this.readyMessage = ready.message;
    } catch (error) {
      this.readyMessage = error instanceof Error ? error.message : String(error);
    }
    return {
      permission,
      ocr: {
        ready: ocrReady,
        engine: 'apple-vision',
        language: 'zh-Hans',
        message: ocrReady ? null : this.readyMessage,
      },
    };
  }

  async getPermission(): Promise<ScreenPermissionState> {
    return getScreenPermission();
  }

  async requestPermission(): Promise<ScreenPermissionState> {
    const state = await requestScreenPermission();
    return state;
  }

  async recognizeFile(filePath: string): Promise<RawOcrPage> {
    const page = await this.host.recognizeFile(filePath);
    return { width: page.width, height: page.height, lines: page.lines };
  }

  async captureAtCursor(widthDip: number, heightDip: number): Promise<ScreenCaptureResult> {
    const permission = await getScreenPermission();
    if (permission === 'denied' || permission === 'restricted') {
      throw new ScreenError(
        'SCREEN_PERMISSION_DENIED',
        permissionHint(permission) ?? '系统没让字伴看屏幕',
      );
    }
    if (permission === 'not-determined') {
      throw new ScreenError(
        'SCREEN_PERMISSION_NOT_DETERMINED',
        '先点“允许看屏幕”，系统会问一次。',
      );
    }

    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const region = regionAroundPoint(cursor, widthDip, heightDip, display.bounds);
    const tempPath = path.join(
      this.options.userDataPath,
      'tmp',
      `screen-${process.pid}-${Date.now()}.png`,
    );
    mkdirSync(path.dirname(tempPath), { recursive: true });

    try {
      const captured = await captureWithSystem(region, tempPath);
      const ocrStarted = Date.now();
      const page = await this.host.recognizeFile(captured.filePath);
      // 权限被系统静默收回时 screencapture 仍可能产出壁纸/黑图，OCR 为空；
      // 这时再查一次 TCC 状态，给出“去系统设置”的明确提示，而不是“没看清”。
      if (page.lines.length === 0) {
        const now = await getScreenPermission();
        if (now !== 'granted') {
          throw new ScreenError(
            'SCREEN_PERMISSION_DENIED',
            '系统现在没让字伴看屏幕。到“系统设置 → 隐私与安全性 → 屏幕录制”里打开字伴，再试一次。',
          );
        }
      }
      const scale = captured.scale;
      return {
        page: {
          width: page.width,
          height: page.height,
          lines: page.lines,
        },
        cursor: {
          x: (cursor.x - region.x) * scale,
          y: (cursor.y - region.y) * scale,
        },
        captureMs: captured.captureMs,
        ocrMs: Date.now() - ocrStarted,
        origin: { x: region.x, y: region.y },
        scale,
        dpi: Math.round(96 * scale),
        language: 'zh-Hans',
      };
    } finally {
      try {
        rmSync(tempPath, { force: true });
      } catch {
        // 删不掉也不影响使用。
      }
    }
  }

  async dispose(): Promise<void> {
    await this.host.dispose();
  }
}
