/**
 * Windows 屏幕取词宿主（Node 侧）。
 *
 * 真正的截屏和 WinRT OCR 在 native/windows/ocr-host.ps1 里，本文件负责：
 * - 以 UTF-8 BOM 写一份临时脚本（Windows PowerShell 5.1 读无 BOM UTF-8 会按
 *   GBK 解码，中文直接变乱码并语法报错；这是必须保留的兼容点）；
 * - 启动/守护常驻 PowerShell 进程；
 * - NDJSON 请求/响应、超时、取消、退出清理。
 *
 * 平台的 DPI、光标物理坐标都在 PowerShell 里算，Node 不再做坐标换算，
 * 这样 200% 缩放和多显示器下不会出现“截到的位置偏一截”。
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import type { RawOcrChar, RawOcrLine, RawOcrPage, Rect } from '@ziban/core';

export interface WindowsHostReady {
  ok: boolean;
  engine: string;
  language: string | null;
  languages: string[];
  errorCode?: string;
  error?: string;
}

export interface WindowsCaptureResult {
  page: RawOcrPage;
  scale: number;
  dpi: number;
  origin: { x: number; y: number };
  /** 光标在 OCR 图片像素里的位置。 */
  cursor: { x: number; y: number };
  captureMs: number;
  ocrMs: number;
  language: string | null;
}

interface PendingRequest {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface HostLine {
  id?: string;
  ready?: boolean;
  ok?: boolean;
  error?: string;
  code?: string;
  errorCode?: string;
  engine?: string;
  language?: string | null;
  languages?: string[];
  lines?: RawOcrLine[];
  width?: number;
  height?: number;
  scale?: number;
  dpi?: number;
  origin?: { x: number; y: number };
  cursor?: { x: number; y: number };
  captureMs?: number;
  ocrMs?: number;
}

export class OcrHostError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OcrHostError';
    this.code = code;
  }
}

export interface WindowsOcrHostOptions {
  /** 源码目录里的 ocr-host.ps1。 */
  scriptPath: string;
  /** 临时脚本目录，默认系统 temp。 */
  tempDir?: string;
  readyTimeoutMs?: number;
  requestTimeoutMs?: number;
  onLog?: (message: string) => void;
  onExit?: (code: number | null) => void;
}

const DEFAULT_READY_TIMEOUT = 15_000;
const DEFAULT_REQUEST_TIMEOUT = 8_000;

export class WindowsOcrHost {
  private readonly options: WindowsOcrHostOptions;
  private child: ChildProcessWithoutNullStreams | null = null;
  private rl: readline.Interface | null = null;
  private tempDir: string | null = null;
  private tempScript: string | null = null;
  private pending = new Map<string, PendingRequest>();
  private nextId = 1;
  private ready: WindowsHostReady | null = null;
  private readyWaiter: {
    resolve: (ready: WindowsHostReady) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  } | null = null;
  private disposed = false;

  constructor(options: WindowsOcrHostOptions) {
    this.options = options;
  }

  get readyInfo(): WindowsHostReady | null {
    return this.ready;
  }

  private log(message: string): void {
    this.options.onLog?.(message);
  }

  /**
   * Windows PowerShell 5.1 靠 BOM 判断 UTF-8；源码在仓库里保持无 BOM
   * （方便 git diff / 其他工具），运行时复制一份带 BOM 的临时脚本。
   */
  private prepareScript(): string {
    if (this.tempDir) {
      try {
        rmSync(this.tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
      this.tempDir = null;
    }
    const source = readFileSync(this.options.scriptPath, 'utf8').replace(/^\uFEFF/, '');
    this.tempDir = mkdtempSync(path.join(this.options.tempDir ?? tmpdir(), 'ziban-ocr-'));
    this.tempScript = path.join(this.tempDir, 'ocr-host.ps1');
    writeFileSync(this.tempScript, `\uFEFF${source}`, { encoding: 'utf8' });
    return this.tempScript;
  }

  async start(): Promise<WindowsHostReady> {
    if (this.child) {
      if (this.ready) return this.ready;
      return this.waitForReady();
    }
    this.disposed = false;
    const script = this.prepareScript();
    this.log(`启动 Windows OCR 宿主：${script}`);

    const child = spawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
      ],
      { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
    );
    this.child = child;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    this.rl = readline.createInterface({ input: child.stdout });
    this.rl.on('line', (line) => this.handleLine(line));

    child.stderr.on('data', (chunk: string) => {
      const text = chunk.trim();
      if (text) this.log(`[ocr-host] ${text}`);
    });

    child.on('error', (error) => {
      this.log(`OCR 宿主启动失败：${error.message}`);
      this.rejectAll(new OcrHostError('HOST_SPAWN_FAILED', error.message));
    });

    child.on('exit', (code) => {
      this.log(`OCR 宿主退出：${String(code)}`);
      this.child = null;
      this.ready = null;
      this.rl?.close();
      this.rl = null;
      this.rejectAll(new OcrHostError('HOST_EXITED', '看屏幕的小工具停下了'));
      if (!this.disposed) this.options.onExit?.(code);
    });

    return this.waitForReady();
  }

  private waitForReady(): Promise<WindowsHostReady> {
    if (this.ready) return Promise.resolve(this.ready);
    return new Promise<WindowsHostReady>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.readyWaiter = null;
        reject(new OcrHostError('HOST_READY_TIMEOUT', '电脑准备看屏幕花的时间有点长'));
      }, this.options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT);
      this.readyWaiter = { resolve, reject, timer };
    });
  }

  private settleReady(ready: WindowsHostReady): void {
    this.ready = ready;
    const waiter = this.readyWaiter;
    if (!waiter) return;
    this.readyWaiter = null;
    clearTimeout(waiter.timer);
    waiter.resolve(ready);
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: HostLine;
    try {
      parsed = JSON.parse(trimmed) as HostLine;
    } catch {
      this.log(`[ocr-host] 无法解析输出：${trimmed.slice(0, 200)}`);
      return;
    }

    if (parsed.ready) {
      const ready: WindowsHostReady = {
        ok: parsed.ok !== false,
        engine: parsed.engine ?? 'winrt',
        language: parsed.language ?? null,
        languages: parsed.languages ?? [],
        ...(parsed.errorCode ? { errorCode: parsed.errorCode } : {}),
        ...(parsed.error ? { error: parsed.error } : {}),
      };
      this.settleReady(ready);
      return;
    }

    const id = parsed.id ?? '';
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    clearTimeout(pending.timer);
    if (parsed.ok === false) {
      pending.reject(
        new OcrHostError(parsed.code ?? 'OCR_FAILED', parsed.error ?? '这次没认出来'),
      );
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

  private request<T extends HostLine>(
    payload: Record<string, unknown>,
    timeoutMs = this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT,
  ): Promise<T> {
    const child = this.child;
    if (!child || !this.ready?.ok) {
      return Promise.reject(new OcrHostError('OCR_NOT_READY', '看屏幕还没准备好'));
    }
    const id = String(this.nextId++);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new OcrHostError('OCR_TIMEOUT', '这次看屏幕花的时间有点长'));
        // 卡死的进程留着只会越来越慢，直接收掉，下一次使用再启动。
        this.killHost();
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      try {
        child.stdin.write(`${JSON.stringify({ id, ...payload })}\n`);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private mapPage(parsed: HostLine): RawOcrPage {
    const lines: RawOcrLine[] = (parsed.lines ?? []).map((line) => ({
      text: line.text,
      ...(line.bbox ? { bbox: line.bbox } : {}),
      chars: (line.chars ?? []).map((char: RawOcrChar) => ({
        text: char.text,
        bbox: normalizeBBox(char.bbox),
      })),
    }));
    return {
      width: parsed.width ?? 0,
      height: parsed.height ?? 0,
      lines,
    };
  }

  /** 截光标周围一小块 + OCR。宽高是 DIP（96dpi 逻辑像素）。 */
  async capture(widthDip: number, heightDip: number): Promise<WindowsCaptureResult> {
    const parsed = await this.request<HostLine>({
      cmd: 'capture',
      widthDip,
      heightDip,
    });
    return {
      page: this.mapPage(parsed),
      scale: parsed.scale ?? 1,
      dpi: parsed.dpi ?? 96,
      origin: parsed.origin ?? { x: 0, y: 0 },
      cursor: parsed.cursor ?? { x: 0, y: 0 },
      captureMs: parsed.captureMs ?? 0,
      ocrMs: parsed.ocrMs ?? 0,
      language: parsed.language ?? null,
    };
  }

  /** 只识别一个图片文件；用于 fixtures 冒烟测试。 */
  async recognizeFile(filePath: string): Promise<RawOcrPage & { ocrMs: number }> {
    const parsed = await this.request<HostLine>({ cmd: 'ocr-file', path: filePath });
    return { ...this.mapPage(parsed), ocrMs: parsed.ocrMs ?? 0 };
  }

  async ping(): Promise<boolean> {
    try {
      const parsed = await this.request<HostLine>({ cmd: 'ping' }, 2000);
      return parsed.ok !== false;
    } catch {
      return false;
    }
  }

  private killHost(): void {
    const child = this.child;
    this.child = null;
    this.ready = null;
    this.rl?.close();
    this.rl = null;
    this.rejectAll(new OcrHostError('HOST_EXITED', '看屏幕的小工具重新启动了'));
    try {
      child?.stdin.end();
      child?.kill();
    } catch {
      // 进程可能已经退出。
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    const child = this.child;
    if (child) {
      try {
        child.stdin.write(`${JSON.stringify({ id: 'quit', cmd: 'quit' })}\n`);
      } catch {
        // ignore
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          this.killHost();
          resolve();
        }, 800);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    this.rejectAll(new OcrHostError('HOST_DISPOSED', '看屏幕已经关上了'));
    if (this.tempDir) {
      try {
        rmSync(this.tempDir, { recursive: true, force: true });
      } catch {
        // 临时文件删不掉不影响使用。
      }
      this.tempDir = null;
      this.tempScript = null;
    }
  }
}

function normalizeBBox(bbox: Rect | undefined): Rect {
  if (!bbox) return { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: Number.isFinite(bbox.x) ? bbox.x : 0,
    y: Number.isFinite(bbox.y) ? bbox.y : 0,
    width: Number.isFinite(bbox.width) ? Math.max(0, bbox.width) : 0,
    height: Number.isFinite(bbox.height) ? Math.max(0, bbox.height) : 0,
  };
}
