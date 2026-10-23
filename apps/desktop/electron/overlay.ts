/**
 * 小窗（悬浮讲解窗）管理。
 *
 * 设计约束（老人 + 隐私）：
 * - 小：默认 400×约 220 DIP，只够看一个词 + 一句解释；不遮挡大半屏；
 * - 不抢焦点：用 showInactive()/focusable=false，老人正在打字时不会被弹窗打断；
 * - 不出现在截图里：setContentProtection(true)，避免 OCR 把自己的解释再认一遍；
 * - 出现在光标旁边，靠近屏幕边缘时自动翻到另一侧；
 * - 内容变高时只向下长，超出工作区就整体上移。
 */

import { BrowserWindow, screen } from 'electron';
import type {
  DesktopPublicConfig,
  DesktopScreenStatus,
  ScreenLookupPayload,
} from '@ziban/core';

const MAX_WIDTH = 400;
const MIN_WIDTH = 320;
const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = 140;
const MAX_HEIGHT = 560;
const GAP_X = 18;
const GAP_Y = 24;

export interface OverlayOptions {
  preloadPath: string;
  webUrl: string;
  iconPath?: string;
  onLog?: (message: string) => void;
}

export class OverlayController {
  private readonly options: OverlayOptions;
  private window: BrowserWindow | null = null;
  private loaded = false;
  private webReady = false;
  private width = MAX_WIDTH;
  private height = DEFAULT_HEIGHT;
  private lastPayload: ScreenLookupPayload | null = null;
  private pendingCursor: Electron.Point | null = null;
  private lastStatus: DesktopScreenStatus | null = null;
  private lastConfig: DesktopPublicConfig | null = null;
  private anchor = { x: 0, y: 0 };

  constructor(options: OverlayOptions) {
    this.options = options;
  }

  create(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) return this.window;

    const isMac = process.platform === 'darwin';
    const window = new BrowserWindow({
      width: this.width,
      height: DEFAULT_HEIGHT,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: true,
      // macOS：panel 可以浮在其他 App 上方。窗口本身 focusable=true 是为了
      // “再念一遍/听例句”能点；显示时用 showInactive()，不会在出现时抢焦点。
      ...(isMac ? { type: 'panel' as const, acceptFirstMouse: true } : {}),
      focusable: true,
      webPreferences: {
        preload: this.options.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
        additionalArguments: ['--ziban-overlay=1'],
      },
    });

    this.window = window;
    this.loaded = false;
    this.webReady = false;

    try {
      window.setContentProtection(true);
      window.setAlwaysOnTop(true, isMac ? 'floating' : 'screen-saver');
      if (isMac) {
        window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        window.setWindowButtonVisibility(false);
      }
    } catch (error) {
      this.options.onLog?.(`悬浮窗置顶设置没成功：${String(error)}`);
    }

    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(this.options.webUrl.split('#')[0] ?? '')) event.preventDefault();
    });
    window.webContents.on('did-finish-load', () => {
      this.loaded = true;
      this.pushPending();
    });
    window.on('closed', () => {
      this.window = null;
      this.loaded = false;
      this.webReady = false;
    });

    const url = `${this.options.webUrl.replace(/#.*$/, '')}#/lookup`;
    void window.loadURL(url);
    return window;
  }

  get browserWindow(): BrowserWindow | null {
    return this.window;
  }

  get isVisible(): boolean {
    return Boolean(this.window && !this.window.isDestroyed() && this.window.isVisible());
  }

  /** 诊断/冒烟用：最近一次推给小窗的查询结果。 */
  get lastLookupPayload(): ScreenLookupPayload | null {
    return this.lastPayload;
  }

  get bounds(): Electron.Rectangle | null {
    return this.window && !this.window.isDestroyed() ? this.window.getBounds() : null;
  }

  contains(point: Electron.Point): boolean {
    const bounds = this.bounds;
    if (!bounds) return false;
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  }

  markWebReady(): void {
    this.webReady = true;
    this.pushPending();
  }

  /**
   * 鼠标进入小窗时调用。
   *
   * 小窗用 showInactive() 出现，不抢正在打字的 App 的焦点；但在 Windows 上，
   * 如果窗口未激活，第一次点击有时只用于激活窗口，按钮看起来“点了没反应”。
   * 光标已经移到小窗上，说明用户准备操作它，此时 focus() 是符合预期的。
   */
  focus(): void {
    const window = this.window;
    if (!window || window.isDestroyed() || !window.isVisible()) return;
    if (!window.isFocused()) window.focus();
  }

  private pushPending(): void {
    if (!this.loaded || !this.webReady || !this.window || this.window.isDestroyed()) return;
    // 第一次打开时先等页面挂载好再显示，避免老人看到一个空白小窗闪一下。
    if (this.lastPayload && this.pendingCursor) {
      this.position(this.pendingCursor);
      this.pendingCursor = null;
      if (!this.window.isVisible()) this.window.showInactive();
    }
    if (this.lastPayload) this.window.webContents.send('ziban:lookup', this.lastPayload);
    if (this.lastStatus) this.window.webContents.send('ziban:status-changed', this.lastStatus);
    if (this.lastConfig) this.window.webContents.send('ziban:config-changed', this.lastConfig);
  }

  /** 小窗宽度最多占工作区的 62%，在 1280 宽屏上是 400，在 800 宽屏上仍是 400，在 640 上会缩到 397。 */
  private widthFor(work: Electron.Rectangle): number {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(work.width * 0.62)));
  }

  private maxHeightFor(work: Electron.Rectangle): number {
    return Math.max(240, Math.min(MAX_HEIGHT, Math.round(work.height * 0.82)));
  }

  private position(cursor: Electron.Point): void {
    const window = this.window;
    if (!window || window.isDestroyed()) return;
    const display = screen.getDisplayNearestPoint(cursor);
    const work = display.workArea;
    this.anchor = { x: cursor.x, y: cursor.y };
    this.width = this.widthFor(work);
    const height = Math.min(this.maxHeightFor(work), Math.max(MIN_HEIGHT, this.height));

    let x = cursor.x + GAP_X;
    let y = cursor.y + GAP_Y;
    if (x + this.width > work.x + work.width) x = cursor.x - this.width - GAP_X;
    if (y + height > work.y + work.height) y = cursor.y - height - GAP_Y;
    x = Math.min(Math.max(x, work.x + 6), work.x + work.width - this.width - 6);
    y = Math.min(Math.max(y, work.y + 6), work.y + work.height - height - 6);

    window.setBounds({ x: Math.round(x), y: Math.round(y), width: this.width, height });
  }

  show(payload: ScreenLookupPayload, cursor: Electron.Point): void {
    const window = this.create();
    this.lastPayload = payload;
    if (window.isDestroyed()) return;
    if (!this.loaded || !this.webReady) {
      this.pendingCursor = cursor;
      return;
    }
    this.position(cursor);
    if (!window.isVisible()) window.showInactive();
    window.webContents.send('ziban:lookup', payload);
  }

  hide(): void {
    // 收起后丢弃待推送内容，避免“页面刚加载完又把旧小窗弹出来”。
    this.lastPayload = null;
    this.pendingCursor = null;
    const window = this.window;
    if (!window || window.isDestroyed()) return;
    window.hide();
  }

  /** 小窗内容高度变化；保持左上角/锚点，不让窗口跳来跳去。 */
  resize(height: number): void {
    if (!Number.isFinite(height)) return;
    this.height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height)));
    const window = this.window;
    if (!window || window.isDestroyed()) return;
    const bounds = window.getBounds();
    const display = screen.getDisplayNearestPoint({ x: this.anchor.x, y: this.anchor.y });
    const work = display.workArea;
    this.width = this.widthFor(work);
    const nextHeight = Math.min(
      this.maxHeightFor(work),
      Math.max(MIN_HEIGHT, this.height),
    );
    let y = bounds.y;
    if (y + nextHeight > work.y + work.height) {
      y = work.y + work.height - nextHeight - 6;
    }
    y = Math.max(work.y + 6, y);
    const x = Math.min(
      Math.max(bounds.x, work.x + 6),
      work.x + work.width - this.width - 6,
    );
    window.setBounds({ x: Math.round(x), y: Math.round(y), width: this.width, height: nextHeight });
  }

  sendStatus(status: DesktopScreenStatus): void {
    this.lastStatus = status;
    if (this.window && !this.window.isDestroyed() && this.loaded) {
      this.window.webContents.send('ziban:status-changed', status);
    }
  }

  sendConfig(config: DesktopPublicConfig): void {
    this.lastConfig = config;
    if (this.window && !this.window.isDestroyed() && this.loaded) {
      this.window.webContents.send('ziban:config-changed', config);
    }
  }

  destroy(): void {
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
    this.window = null;
    this.loaded = false;
    this.webReady = false;
  }
}
