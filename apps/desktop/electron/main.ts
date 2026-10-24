/**
 * 字伴 Electron 主进程。
 *
 * 职责边界：
 * - 窗口/托盘/全局快捷键；
 * - 能力层（截图、OCR、知识、权限）在这里组装；
 * - 所有 IPC 参数在这里再校验一遍，渲染层永远拿不到 Node/Electron 原始对象。
 *
 * 安全基线（与 docs/03 一致）：
 * contextIsolation=true, nodeIntegration=false, sandbox=true,
 * 自定义协议 app://ziban/ 加载 dist（不用 file://），生产 CSP 只允许 self。
 *
 * 屏幕取词的数据流：
 *   光标停稳 → ScreenEngine.captureAtCursor(小区域) → normalizeOcrPage
 *   → lookupAtPoint(光标在哪个字) → KnowledgeService.localLookup（立即弹窗）
 *   → 可选大模型补全 → IPC 推给小窗 → Web Speech 朗读。
 */

import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  net,
  powerMonitor,
  protocol,
  screen,
  shell,
  Tray,
  type IpcMainInvokeEvent,
} from 'electron';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  captureSizeForWorkArea,
  lookupAtPoint,
  normalizeOcrPage,
  type CloudSpeechResult,
  type DesktopConfigPatch,
  type DesktopPublicConfig,
  type DesktopScreenStatus,
  type ScreenLookupPayload,
  type ScreenPermissionState,
} from '@ziban/core';
import { createScreenEngine } from './capabilities/screen/index.js';
import type { ScreenEngine, ScreenStartResult } from './capabilities/screen/types.js';
import {
  getScreenPermission,
  openAccessibilitySettings,
  openScreenSettings,
  permissionHint,
} from './capabilities/screen/permissions.js';
import { ScreenConfigStore } from './capabilities/knowledge/config.js';
import { UpdateChecker } from './capabilities/update.js';
import { synthesizeCloudSpeech } from './capabilities/speech/tts.js';
import { loadLocalLexicon, type LocalLexicon } from './capabilities/knowledge/localLexicon.js';
import { CorpusStore } from './capabilities/knowledge/corpus.js';
import { KnowledgeCache } from './capabilities/knowledge/cache.js';
import { KnowledgeService } from './capabilities/knowledge/service.js';
import { OverlayController } from './overlay.js';
import { HoverController } from './hover.js';

const APP_SCHEME = 'app';
const APP_HOST = 'ziban';
const LOOKUP_ACCELERATOR = 'CommandOrControl+Shift+Z';
const TOGGLE_ACCELERATOR = 'CommandOrControl+Shift+H';
const OCR_SMOKE = process.argv.includes('--ocr-smoke');
const UI_SMOKE = process.argv.includes('--ui-smoke');
const LOOKUP_SMOKE = process.argv.includes('--lookup-smoke');
const HOVER_SMOKE = process.argv.includes('--hover-smoke');
const SMOKE_MODE = OCR_SMOKE || UI_SMOKE || LOOKUP_SMOKE || HOVER_SMOKE;

// 测试不要污染真实用户目录（配置/缓存/密钥）。优先用显式 ZIBAN_USER_DATA，
// 否则 smoke 模式自动落到临时目录。
if (process.env.ZIBAN_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.ZIBAN_USER_DATA));
} else if (SMOKE_MODE) {
  app.setPath('userData', path.join(app.getPath('temp'), `ziban-smoke-${process.pid}`));
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const repoRoot = path.resolve(app.getAppPath(), '..', '..');
const desktopRoot = path.join(repoRoot, 'apps', 'desktop');
const webDist = app.isPackaged
  ? path.join(process.resourcesPath, 'web')
  : path.join(repoRoot, 'apps', 'web', 'dist');
const nativePath = app.isPackaged
  ? path.join(process.resourcesPath, 'native')
  : path.join(desktopRoot, 'electron', 'native');
const resourcesPath = app.isPackaged
  ? process.resourcesPath
  : path.join(desktopRoot, 'resources');
const preloadPath = path.join(app.getAppPath(), 'dist-electron', 'preload.cjs');
const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.png')
  : path.join(desktopRoot, 'assets', 'icon.png');
const devServerUrl = process.env.ZIBAN_DEV_SERVER_URL?.replace(/\/+$/, '') ?? '';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let runtime: ScreenRuntime | null = null;
let updateChecker: UpdateChecker | null = null;
let hotkeysRegistered = false;

function log(message: string): void {
  console.log(`[ziban] ${message}`);
}

function webUrl(): string {
  return devServerUrl
    ? `${devServerUrl}/index.html`
    : `${APP_SCHEME}://${APP_HOST}/index.html`;
}

function registerAppProtocol(): void {
  protocol.handle(APP_SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== APP_HOST) return new Response('not found', { status: 404 });
      let pathname = decodeURIComponent(url.pathname);
      if (!pathname || pathname === '/') pathname = '/index.html';
      // 只允许 dist 内的文件，防路径穿越。
      const target = path.resolve(webDist, `.${pathname}`);
      if (!target.startsWith(path.resolve(webDist) + path.sep) && target !== path.join(webDist, 'index.html')) {
        return new Response('forbidden', { status: 403 });
      }
      if (!existsSync(target)) return new Response('not found', { status: 404 });
      const response = await net.fetch(pathToFileURL(target).toString());
      const headers = new Headers(response.headers);
      headers.set(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self'",
          "media-src 'self' blob:",
          "connect-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
        ].join('; '),
      );
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      log(`协议读取失败：${String(error)}`);
      return new Response('not found', { status: 404 });
    }
  });
}

function allowedOriginPrefix(): string {
  return devServerUrl ? `${devServerUrl}/` : `${APP_SCHEME}://${APP_HOST}/`;
}

function secureWebContents(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(allowedOriginPrefix())) event.preventDefault();
  });
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 680,
    show: false,
    title: '字伴',
    backgroundColor: '#f6efe2',
    autoHideMenuBar: process.platform !== 'darwin',
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // 字卡进入后会自动朗读；云端 TTS 用 <audio> 播放，不能被自动播放策略拦掉。
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  secureWebContents(window);
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    mainWindow = null;
    if (process.platform !== 'darwin') app.quit();
  });
  void window.loadURL(`${webUrl()}#/`);
  return window;
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function broadcastStatus(status: DesktopScreenStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('ziban:status-changed', status);
  }
}

function broadcastConfig(config: DesktopPublicConfig): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('ziban:config-changed', config);
  }
}

function trusted(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? '';
  return url.startsWith(allowedOriginPrefix());
}

function assertTrusted(event: IpcMainInvokeEvent): void {
  if (!trusted(event)) throw new Error('不受信任的页面');
}

/** 小窗相关 IPC 只接受小窗自己的 webContents，主窗口误导航到 #/lookup 也不会干扰。 */
function isOverlaySender(event: IpcMainInvokeEvent): boolean {
  const overlayWindow = runtime?.overlay.browserWindow;
  return Boolean(overlayWindow && !overlayWindow.isDestroyed() && event.sender === overlayWindow.webContents);
}

/**
 * 运行时：把配置、词表、屏幕引擎、小窗、hover 组装在一起。
 * 放在 main.ts 里是为了让生命周期清楚；真正的平台逻辑都在 capabilities/。
 */
class ScreenRuntime {
  readonly config: ScreenConfigStore;
  readonly lexicon: LocalLexicon;
  readonly corpus: CorpusStore;
  readonly cache: KnowledgeCache;
  readonly knowledge: KnowledgeService;
  readonly engine: ScreenEngine;
  readonly overlay: OverlayController;
  readonly hover: HoverController;
  private startResult: ScreenStartResult | null = null;
  private permission: ScreenPermissionState = 'unknown';
  private lastError: string | null = null;
  private engineStarting: Promise<void> | null = null;

  constructor() {
    this.config = new ScreenConfigStore(app.getPath('userData'));
    this.lexicon = loadLocalLexicon({
      appPath: repoRoot,
      resourcesPath,
      onLog: log,
    });
    this.corpus = new CorpusStore(app.getPath('userData'), log);
    this.cache = new KnowledgeCache(app.getPath('userData'));
    this.knowledge = new KnowledgeService({
      lexicon: this.lexicon,
      corpus: this.corpus,
      cache: this.cache,
      getLlmConfig: () => {
        const stored = this.config.get();
        return {
          enabled: stored.llmEnabled,
          endpoint: stored.llmEndpoint,
          model: stored.llmModel,
          apiKey: this.config.getApiKey(),
          shareContext: stored.shareContext,
        };
      },
      onLog: log,
    });
    this.engine = createScreenEngine({
      appPath: repoRoot,
      nativePath,
      userDataPath: app.getPath('userData'),
      resourcesPath,
      onLog: log,
    });
    this.overlay = new OverlayController({
      preloadPath,
      webUrl: webUrl(),
      ...(existsSync(iconPath) ? { iconPath } : {}),
      onLog: log,
    });
    this.hover = new HoverController({
      screen: this.engine,
      knowledge: this.knowledge,
      overlay: this.overlay,
      getCursorPoint: () => screen.getCursorScreenPoint(),
      isPointInMainWindow: (point) => {
        if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return false;
        const bounds = mainWindow.getBounds();
        return (
          point.x >= bounds.x &&
          point.x <= bounds.x + bounds.width &&
          point.y >= bounds.y &&
          point.y <= bounds.y + bounds.height
        );
      },
      getCaptureSize: () => {
        // 不写死 340×180：按当前显示器工作区自适应，DPI 由平台层换算。
        const cursor = screen.getCursorScreenPoint();
        const display = screen.getDisplayNearestPoint(cursor);
        return captureSizeForWorkArea(display.workArea);
      },
      onStatusRefresh: () => this.broadcast(),
      onError: (message) => {
        this.lastError = message;
      },
      onSuccess: () => {
        this.lastError = null;
      },
      onLog: log,
    });
  }

  getStatus(): DesktopScreenStatus {
    const started = this.startResult;
    const permission = this.permission;
    const hint =
      permissionHint(permission) ??
      (started && !started.ocr.ready ? started.ocr.message : null) ??
      (!hotkeysRegistered
        ? '快捷键被别的软件占了；点“开始看屏幕”也可以用。'
        : this.lastError);
    return {
      platform:
        process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux',
      hover: this.hover.isRunning,
      permission,
      ocr: started?.ocr ?? {
        ready: false,
        engine: 'none',
        language: null,
        message: '正在准备看屏幕…',
      },
      llm: this.knowledge.llmStatus,
      hotkeys: {
        lookup: LOOKUP_ACCELERATOR,
        toggle: TOGGLE_ACCELERATOR,
        registered: hotkeysRegistered,
      },
      hint,
      lastError: this.lastError,
    };
  }

  broadcast(): void {
    broadcastStatus(this.getStatus());
    updateTrayMenu();
  }

  async ensureStarted(): Promise<void> {
    if (this.engineStarting) return this.engineStarting;
    this.engineStarting = (async () => {
      try {
        this.permission = await getScreenPermission();
        this.startResult = await this.engine.start();
        this.permission = await this.engine.getPermission();
        if (!this.startResult.ocr.ready) {
          this.lastError = this.startResult.ocr.message;
        }
      } catch (error) {
        this.permission = await this.engine.getPermission().catch(() => 'unknown');
        this.startResult = {
          permission: this.permission,
          ocr: {
            ready: false,
            engine: 'none',
            language: null,
            message: error instanceof Error ? error.message : String(error),
          },
        };
        this.lastError = this.startResult.ocr.message;
      } finally {
        this.engineStarting = null;
        this.broadcast();
      }
    })();
    return this.engineStarting;
  }

  async startHover(): Promise<DesktopScreenStatus> {
    await this.ensureStarted();
    // 用户可能刚在“系统设置”里改了屏幕录制权限；每次开始都重新查一次，
    // 避免必须重启字伴才能生效。
    this.permission = await this.engine.getPermission();
    if (!this.startResult?.ocr.ready) {
      this.lastError = this.startResult?.ocr.message ?? '这台电脑还没准备好认字';
      this.broadcast();
      return this.getStatus();
    }

    if (this.permission === 'not-determined') {
      this.permission = await this.engine.requestPermission();
    }
    if (
      this.permission === 'denied' ||
      this.permission === 'restricted' ||
      this.permission === 'not-determined'
    ) {
      this.lastError = permissionHint(this.permission);
      this.broadcast();
      return this.getStatus();
    }

    this.config.update({ hoverEnabled: true });
    this.lastError = null;
    this.hover.start();
    this.broadcast();
    broadcastConfig(this.config.getPublic());
    return this.getStatus();
  }

  stopHover(): DesktopScreenStatus {
    this.config.update({ hoverEnabled: false });
    this.hover.stop();
    this.broadcast();
    broadcastConfig(this.config.getPublic());
    return this.getStatus();
  }

  async toggleHover(): Promise<DesktopScreenStatus> {
    return this.hover.isRunning ? this.stopHover() : this.startHover();
  }

  async requestPermission(): Promise<DesktopScreenStatus> {
    await this.ensureStarted();
    this.permission = await this.engine.requestPermission();
    this.broadcast();
    return this.getStatus();
  }

  async lookupAtCursor(): Promise<ScreenLookupPayload> {
    await this.ensureStarted();
    this.permission = await this.engine.getPermission();
    if (!this.startResult?.ocr.ready) {
      return this.failLookup(this.startResult?.ocr.message ?? '这台电脑还没准备好认字');
    }
    if (this.permission === 'not-determined') {
      this.permission = await this.engine.requestPermission();
      if (this.permission !== 'granted' && this.permission !== 'not-needed') {
        this.broadcast();
        return this.failLookup(permissionHint(this.permission) ?? '先允许字伴看屏幕');
      }
    }
    if (this.permission === 'denied' || this.permission === 'restricted') {
      return this.failLookup(permissionHint(this.permission) ?? '系统没让字伴看屏幕');
    }
    try {
      return (
        (await this.hover.trigger('hotkey')) ??
        this.failLookup('这里没看清字。把鼠标放到一个字上，停一下，再按一次。')
      );
    } catch (error) {
      return this.failLookup(error instanceof Error ? error.message : '这次没看清屏幕');
    }
  }

  private errorPayload(message: string): ScreenLookupPayload {
    this.lastError = message;
    this.broadcast();
    return {
      requestId: 0,
      status: 'error',
      target: null,
      knowledge: null,
      risk: null,
      message,
      origin: 'hotkey',
      timing: null,
    };
  }

  /** 手动热键失败时也要让小窗给一句人话，而不是只在设置页里。 */
  private failLookup(message: string): ScreenLookupPayload {
    const payload = this.errorPayload(message);
    this.overlay.show(payload, screen.getCursorScreenPoint());
    return payload;
  }

  async updateConfig(patch: DesktopConfigPatch): Promise<DesktopPublicConfig> {
    const error = this.config.update(patch);
    if (error) throw new Error(error);
    if (typeof patch.hoverEnabled === 'boolean') {
      if (patch.hoverEnabled) await this.startHover();
      else this.stopHover();
    }
    this.broadcast();
    broadcastConfig(this.config.getPublic());
    return this.config.getPublic();
  }

  async testLlm(): Promise<{ ok: boolean; message: string; latencyMs: number | null }> {
    return this.knowledge.testLlm();
  }

  async synthesizeSpeech(text: string): Promise<CloudSpeechResult> {
    const stored = this.config.get();
    if (!stored.ttsEnabled) {
      return {
        ok: false,
        audio: null,
        mimeType: null,
        message: '云端语音关着。可以在设置里打开，或者继续用本机声音。',
      };
    }
    return synthesizeCloudSpeech(text, {
      provider: stored.ttsProvider,
      endpoint: stored.ttsEndpoint,
      model: stored.ttsModel,
      voice: stored.ttsVoice,
      apiKey: this.config.getTtsApiKey(),
    });
  }

  clearCache(): number {
    const before = this.knowledge.cacheSize;
    this.knowledge.clearCache();
    return before;
  }

  async dispose(): Promise<void> {
    this.hover.dispose();
    this.overlay.destroy();
    await this.engine.dispose();
    this.knowledge.dispose();
  }
}

function updateTrayMenu(): void {
  if (!tray || !runtime) return;
  const running = runtime.hover.isRunning;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开字伴', click: () => showMainWindow() },
      {
        label: running ? '暂停看屏幕' : '开始看屏幕',
        click: () => {
          void (running ? runtime?.stopHover() : runtime?.startHover());
        },
      },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]),
  );
  tray.setToolTip(running ? '字伴 · 正在看屏幕' : '字伴 · 看屏幕');
}

function createTray(): void {
  if (!existsSync(iconPath)) {
    log('没有托盘图标，跳过托盘');
    return;
  }
  try {
    const image = nativeImage.createFromPath(iconPath);
    if (image.isEmpty()) return;
    tray = new Tray(image.resize({ width: 16, height: 16 }));
    tray.on('click', () => showMainWindow());
    updateTrayMenu();
  } catch (error) {
    log(`托盘创建失败：${String(error)}`);
  }
}

function registerHotkeys(): void {
  try {
    const lookupOk = globalShortcut.register(LOOKUP_ACCELERATOR, () => {
      void runtime?.lookupAtCursor();
    });
    const toggleOk = globalShortcut.register(TOGGLE_ACCELERATOR, () => {
      void runtime?.toggleHover();
    });
    hotkeysRegistered = lookupOk && toggleOk;
    if (!hotkeysRegistered) {
      log(`全局快捷键部分被占用：lookup=${lookupOk} toggle=${toggleOk}`);
    }
  } catch (error) {
    hotkeysRegistered = false;
    log(`全局快捷键注册失败：${String(error)}`);
  }
}

function registerIpc(): void {
  ipcMain.handle('ziban:status', (event) => {
    assertTrusted(event);
    return runtime?.getStatus();
  });

  ipcMain.handle('ziban:start-hover', async (event) => {
    assertTrusted(event);
    if (!runtime) throw new Error('还没有准备好');
    return runtime.startHover();
  });

  ipcMain.handle('ziban:stop-hover', (event) => {
    assertTrusted(event);
    if (!runtime) throw new Error('还没有准备好');
    return runtime.stopHover();
  });

  ipcMain.handle('ziban:lookup-at-cursor', async (event) => {
    assertTrusted(event);
    if (!runtime) throw new Error('还没有准备好');
    return runtime.lookupAtCursor();
  });

  ipcMain.handle('ziban:request-permission', async (event) => {
    assertTrusted(event);
    if (!runtime) throw new Error('还没有准备好');
    return runtime.requestPermission();
  });

  ipcMain.handle('ziban:open-system-settings', async (event, panel: unknown) => {
    assertTrusted(event);
    if (panel === 'accessibility') await openAccessibilitySettings();
    else await openScreenSettings();
  });

  ipcMain.handle('ziban:get-config', (event) => {
    assertTrusted(event);
    if (!runtime) throw new Error('还没有准备好');
    return runtime.config.getPublic();
  });

  ipcMain.handle('ziban:update-config', async (event, patch: unknown) => {
    assertTrusted(event);
    if (!runtime) throw new Error('还没有准备好');
    if (!patch || typeof patch !== 'object') throw new Error('配置格式不对');
    return runtime.updateConfig(patch as DesktopConfigPatch);
  });

  ipcMain.handle('ziban:test-llm', async (event) => {
    assertTrusted(event);
    if (!runtime) throw new Error('还没有准备好');
    return runtime.testLlm();
  });

  ipcMain.handle('ziban:synthesize-speech', async (event, text: unknown) => {
    assertTrusted(event);
    if (!runtime) throw new Error('还没有准备好');
    if (typeof text !== 'string' || !text.trim()) {
      return {
        ok: false,
        audio: null,
        mimeType: null,
        message: '没有要念的字。',
      } satisfies CloudSpeechResult;
    }
    if (Array.from(text).length > 2_000) {
      return {
        ok: false,
        audio: null,
        mimeType: null,
        message: '一次要念的字太多了，先分段。',
      } satisfies CloudSpeechResult;
    }
    return runtime.synthesizeSpeech(text);
  });

  ipcMain.handle('ziban:clear-cache', (event) => {
    assertTrusted(event);
    if (!runtime) throw new Error('还没有准备好');
    return runtime.clearCache();
  });

  ipcMain.handle('ziban:update-status', (event) => {
    assertTrusted(event);
    return (
      updateChecker?.getStatus() ?? {
        state: 'unknown',
        currentVersion: app.getVersion(),
        latestVersion: null,
        url: null,
        checkedAt: null,
        message: null,
      }
    );
  });

  ipcMain.handle('ziban:check-updates', async (event) => {
    assertTrusted(event);
    if (!updateChecker) throw new Error('版本检查还没准备好');
    return updateChecker.check(true);
  });

  ipcMain.handle('ziban:open-update-page', async (event) => {
    assertTrusted(event);
    const status = updateChecker?.getStatus();
    if (status?.state !== 'available' || !status.url) return;
    // url 已在 UpdateChecker 里白名单校验，只可能是 github.com/ADES-RepkSSS/ziban/...
    await shell.openExternal(status.url);
  });

  ipcMain.handle('ziban:overlay-ready', (event) => {
    assertTrusted(event);
    if (!isOverlaySender(event)) return;
    runtime?.overlay.markWebReady();
  });

  ipcMain.handle('ziban:hide-overlay', (event) => {
    assertTrusted(event);
    if (!isOverlaySender(event)) return;
    runtime?.hover.suppressUntilMove();
  });

  ipcMain.handle('ziban:focus-overlay', (event) => {
    assertTrusted(event);
    if (!isOverlaySender(event)) return;
    runtime?.overlay.focus();
  });

  ipcMain.handle('ziban:resize-overlay', (event, height: unknown) => {
    assertTrusted(event);
    if (!isOverlaySender(event)) return;
    const value = typeof height === 'number' ? height : Number(height);
    if (Number.isFinite(value)) runtime?.overlay.resize(value);
  });

  ipcMain.handle('ziban:open-main', (event) => {
    assertTrusted(event);
    showMainWindow();
  });

  ipcMain.handle('ziban:copy-text', (event, text: unknown) => {
    assertTrusted(event);
    if (typeof text === 'string') clipboard.writeText(text.slice(0, 2000));
  });
}

async function runOcrSmoke(): Promise<void> {
  const timeout = setTimeout(() => {
    console.error('OCR smoke 超时');
    app.exit(6);
  }, 120_000);
  timeout.unref?.();
  const fixture = app.isPackaged
    ? path.join(process.resourcesPath, 'fixtures', 'ocr-sample.png')
    : path.join(desktopRoot, 'fixtures', 'ocr-sample.png');
  const engine = createScreenEngine({
    appPath: repoRoot,
    nativePath,
    userDataPath: app.getPath('userData'),
    resourcesPath,
    onLog: log,
  });
  let exitCode = 5;
  try {
    const started = await engine.start();
    if (!started.ocr.ready) {
      console.error(`OCR 不可用：${started.ocr.message ?? '未知原因'}`);
      exitCode = 2;
    } else if (!existsSync(fixture)) {
      console.error(`缺少测试图：${fixture}`);
      exitCode = 3;
    } else {
      const page = normalizeOcrPage(await engine.recognizeFile(fixture));
      const texts = page.lines.map((line) => line.text);
      const lexicon = loadLocalLexicon({ appPath: repoRoot, resourcesPath });
      const warm = page.lines
        .flatMap((line) => line.chars)
        .find((char) => char.text === '暖');
      const wholeWord = warm
        ? lookupAtPoint(
            page,
            { x: warm.rect.x + warm.rect.width / 2, y: warm.rect.y + warm.rect.height / 2 },
            lexicon,
          )
        : null;
      console.log(
        JSON.stringify(
          {
            engine: started.ocr.engine,
            language: started.ocr.language,
            lines: texts,
            chars: page.lines.reduce((sum, line) => sum + line.chars.length, 0),
            wholeWord: wholeWord?.text ?? null,
            wholeWordKind: wholeWord?.kind ?? null,
          },
          null,
          2,
        ),
      );
      // 测试图里至少有“医院”或“验证码”；OCR 允许少量错字，但不应完全空白。
      // 第三行“今天很暖和”必须取到“暖和”，不能只取“暖”。
      const ok =
        texts.some((text) => text.includes('医院') || text.includes('验证')) &&
        wholeWord?.text === '暖和';
      exitCode = ok ? 0 : 4;
    }
  } catch (error) {
    console.error(`OCR 冒烟失败：${error instanceof Error ? error.message : String(error)}`);
    exitCode = 5;
  } finally {
    await engine.dispose().catch(() => undefined);
  }
  clearTimeout(timeout);
  app.exit(exitCode);
}

/**
 * 端到端取词冒烟：在当前光标附近显示一个测试窗口，走真实的“截屏 → OCR →
 * 光标取词 → 本机知识”路径。用于 Windows 本机验证和 macOS 真机回归。
 */
/** 只在 smoke 里用：把鼠标移到屏幕物理坐标，保证测试可重复。 */
function moveCursorPhysical(x: number, y: number): void {
  const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ZibanCursor {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  public static void Aware() { try { if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return; } catch {} try { SetProcessDPIAware(); } catch {} }
}
'@
[ZibanCursor]::Aware() | Out-Null
[ZibanCursor]::SetCursorPos(${Math.round(x)}, ${Math.round(y)}) | Out-Null
`;
  execFileSync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { timeout: 8_000, windowsHide: true },
  );
}

async function runLookupSmoke(): Promise<void> {
  const timeout = setTimeout(() => {
    console.error('LOOKUP smoke 超时');
    app.exit(9);
  }, 90_000);
  timeout.unref?.();

  const display = screen.getPrimaryDisplay();
  const bounds = display.workArea;
  const width = 900;
  const height = 300;
  const x = Math.round(bounds.x + Math.max(20, (bounds.width - width) / 2));
  const y = Math.round(bounds.y + Math.max(20, (bounds.height - height) / 2));

  const testWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#fff;color:#111;font-family:"Microsoft YaHei","PingFang SC",sans-serif;padding:24px 32px}
    p{margin:0 0 14px;font-size:44px;line-height:1.35}
  </style></head><body>
    <p>医院挂号在二楼窗口</p>
    <p>验证码不要告诉别人</p>
  </body></html>`;
  await testWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  app.focus({ steal: true });
  testWindow.setAlwaysOnTop(true, 'screen-saver');
  testWindow.show();
  testWindow.moveTop();
  testWindow.focus();

  ipcMain.handle('ziban:overlay-ready', () => {
    runtime?.overlay.markWebReady();
  });
  ipcMain.handle('ziban:get-config', () => ({
    hoverEnabled: false,
    autoSpeak: false,
    checkUpdates: false,
    ocrLanguage: 'zh-Hans',
    captureWidthDip: 0,
    captureHeightDip: 0,
    shareContext: false,
    llm: { enabled: false, endpoint: '', model: '', hasApiKey: false, keyStorage: 'safe' },
    tts: { enabled: false, provider: 'openai', endpoint: '', model: '', voice: '', hasApiKey: false, keyStorage: 'safe' },
  }));
  ipcMain.handle('ziban:resize-overlay', () => undefined);

  runtime = new ScreenRuntime();
  await new Promise((resolve) => setTimeout(resolve, 700));
  await runtime.ensureStarted();
  await new Promise((resolve) => setTimeout(resolve, 700));

  // 引擎准备好后再移动光标，避免窗口还没画出来就截屏。
  const scale = display.scaleFactor;
  moveCursorPhysical((x + 155) * scale, (y + 150) * scale);
  await new Promise((resolve) => setTimeout(resolve, 3_000));

  // 诊断信息：只在 smoke 模式打印，帮助定位“光标没落在字上”还是 OCR 空。
  const capture = await runtime.engine.captureAtCursor(340, 180);
  const debugPage = normalizeOcrPage(capture.page);
  console.log(
    JSON.stringify(
      {
        cursor: capture.cursor,
        origin: capture.origin,
        scale: capture.scale,
        lines: debugPage.lines.map((line) => ({ text: line.text, rect: line.rect })),
      },
      null,
      2,
    ),
  );

  const payload = await runtime.lookupAtCursor();
  console.log(
    JSON.stringify(
      {
        status: payload.status,
        target: payload.target?.text ?? null,
        line: payload.target?.lineText ?? null,
        pinyin: payload.knowledge?.pinyin ?? null,
        definition: payload.knowledge?.definition ?? null,
        source: payload.knowledge?.source ?? null,
        message: payload.message,
        timing: payload.timing,
        permission: runtime.getStatus().permission,
        ocr: runtime.getStatus().ocr,
      },
      null,
      2,
    ),
  );

  // 调试用：保持小窗/测试窗口不退出，方便用真实鼠标点小窗按钮。
  const holdMs = Number(process.env.ZIBAN_LOOKUP_HOLD ?? 0);
  if (Number.isFinite(holdMs) && holdMs > 0) {
    console.log(`LOOKUP smoke 保持 ${holdMs}ms，等待真实鼠标输入…`);
    await new Promise((resolve) => setTimeout(resolve, holdMs));
  }

  testWindow.destroy();
  await runtime.dispose();
  const ok =
    payload.status === 'ready' &&
    Boolean(payload.target) &&
    (payload.target?.text.includes('验证码') || payload.target?.text.includes('医院'));
  clearTimeout(timeout);
  app.exit(ok ? 0 : 10);
}

/** hover 冒烟：不调用 lookup，靠鼠标停住触发，验证整条跟随链路。 */
async function runHoverSmoke(): Promise<void> {
  const timeout = setTimeout(() => {
    console.error('HOVER smoke 超时');
    app.exit(11);
  }, 90_000);
  timeout.unref?.();

  const display = screen.getPrimaryDisplay();
  const bounds = display.workArea;
  const width = 900;
  const height = 300;
  const x = Math.round(bounds.x + Math.max(20, (bounds.width - width) / 2));
  const y = Math.round(bounds.y + Math.max(20, (bounds.height - height) / 2));
  const testWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#fff;color:#111;font-family:"Microsoft YaHei","PingFang SC",sans-serif;padding:24px 32px}
    p{margin:0 0 14px;font-size:44px;line-height:1.35}
  </style></head><body>
    <p>医院挂号在二楼窗口</p>
    <p>验证码不要告诉别人</p>
  </body></html>`;
  await testWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  testWindow.showInactive();

  const scale = display.scaleFactor;
  moveCursorPhysical((x + 155) * scale, (y + 150) * scale);

  ipcMain.handle('ziban:overlay-ready', () => runtime?.overlay.markWebReady());
  ipcMain.handle('ziban:get-config', () => ({
    hoverEnabled: true,
    autoSpeak: false,
    checkUpdates: false,
    ocrLanguage: 'zh-Hans',
    captureWidthDip: 0,
    captureHeightDip: 0,
    shareContext: false,
    llm: { enabled: false, endpoint: '', model: '', hasApiKey: false, keyStorage: 'safe' },
    tts: { enabled: false, provider: 'openai', endpoint: '', model: '', voice: '', hasApiKey: false, keyStorage: 'safe' },
  }));
  ipcMain.handle('ziban:resize-overlay', (_event, value: unknown) => {
    const heightValue = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(heightValue)) runtime?.overlay.resize(heightValue);
  });
  ipcMain.handle('ziban:status', () => runtime?.getStatus());
  ipcMain.handle('ziban:hide-overlay', () => runtime?.hover.suppressUntilMove());
  ipcMain.handle('ziban:focus-overlay', () => runtime?.overlay.focus());

  runtime = new ScreenRuntime();
  await new Promise((resolve) => setTimeout(resolve, 700));
  await runtime.ensureStarted();
  await runtime.startHover();

  // 等“停稳 380ms + 截图 OCR + 小窗加载”全部完成。
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const payload = runtime.overlay.lastLookupPayload;
  const overlayWindow = runtime.overlay.browserWindow;
  let screenshot: string | null = null;
  if (overlayWindow) {
    const image = await overlayWindow.webContents.capturePage();
    const dir = path.join(repoRoot, 'screenshots');
    mkdirSync(dir, { recursive: true });
    screenshot = path.join(dir, 'desktop-hover.png');
    writeFileSync(screenshot, image.toPNG());
  }
  console.log(
    JSON.stringify(
      {
        hover: runtime.getStatus().hover,
        overlayVisible: runtime.overlay.isVisible,
        screenshot,
        status: payload?.status ?? null,
        target: payload?.target?.text ?? null,
        definition: payload?.knowledge?.definition ?? null,
        source: payload?.knowledge?.source ?? null,
        timing: payload?.timing ?? null,
      },
      null,
      2,
    ),
  );

  runtime.stopHover();
  testWindow.destroy();
  await runtime.dispose().catch(() => undefined);
  const ok = Boolean(payload?.target) && payload?.status !== 'error';
  clearTimeout(timeout);
  app.exit(ok ? 0 : 12);
}

async function runUiSmoke(): Promise<void> {
  // 防止加载失败时 smoke 永远不退出（CI/命令行会卡死）。
  const hardTimeout = setTimeout(() => {
    console.error('UI smoke 超时：小窗没有在 15 秒内完成渲染');
    app.exit(8);
  }, 15_000);
  hardTimeout.unref?.();

  // UI smoke 不启动完整 runtime；给小窗页面补最小 IPC，验证真实渲染路径。
  ipcMain.handle('ziban:overlay-ready', () => {
    overlay.markWebReady();
  });
  ipcMain.handle('ziban:resize-overlay', (_event, height: unknown) => {
    const value = typeof height === 'number' ? height : Number(height);
    if (Number.isFinite(value)) overlay.resize(value);
  });
  ipcMain.handle('ziban:hide-overlay', () => {
    overlay.hide();
  });
  ipcMain.handle('ziban:focus-overlay', () => {
    overlay.focus();
  });
  ipcMain.handle('ziban:status', () => ({
    platform: process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux',
    hover: false,
    permission: 'granted',
    ocr: { ready: true, engine: 'demo', language: 'zh-Hans', message: null },
    llm: { enabled: false, configured: false, message: null },
    hotkeys: { lookup: LOOKUP_ACCELERATOR, toggle: TOGGLE_ACCELERATOR, registered: true },
    hint: null,
    lastError: null,
  }));
  ipcMain.handle('ziban:get-config', () => ({
    hoverEnabled: false,
    autoSpeak: false,
    checkUpdates: false,
    ocrLanguage: 'zh-Hans',
    captureWidthDip: 0,
    captureHeightDip: 0,
    shareContext: false,
    llm: {
      enabled: false,
      endpoint: '',
      model: '',
      hasApiKey: false,
      keyStorage: 'safe',
    },
    tts: {
      enabled: false,
      provider: 'openai',
      endpoint: '',
      model: '',
      voice: '',
      hasApiKey: false,
      keyStorage: 'safe',
    },
  }));

  const overlay = new OverlayController({
    preloadPath,
    webUrl: webUrl(),
    ...(existsSync(iconPath) ? { iconPath } : {}),
    onLog: log,
  });
  const window = overlay.create();
  const cursor = screen.getCursorScreenPoint();
  const payload: ScreenLookupPayload = {
    requestId: 1,
    status: 'ready',
    origin: 'demo',
    message: null,
    timing: { captureMs: 12, ocrMs: 38, totalMs: 260 },
    target: {
      text: '验证码',
      kind: 'word',
      lineText: '银行发来的验证码，不要告诉别人。',
      charIndex: 5,
      charRect: { x: 120, y: 40, width: 90, height: 30 },
      lineRect: { x: 20, y: 40, width: 520, height: 30 },
      point: { x: 165, y: 55 },
    },
    knowledge: {
      word: '验证码',
      pinyin: 'yàn zhèng mǎ',
      definition: '手机上收到的一串数字，只能自己用。',
      example: '银行发来的验证码，不要告诉别人。',
      source: 'card',
      sourceLabel: '本机字卡',
      generated: false,
      confidence: 'high',
      updatedAt: Date.now(),
    },
    risk: {
      level: 'danger',
      title: '先别急着按',
      advice: '这句话里提到了验证码。先问家里人，别告诉别人。',
    },
  };
  overlay.show(payload, cursor);
  await new Promise((resolve) => setTimeout(resolve, 2600));

  // 调试用：保持小窗不退出，方便用真实鼠标点按钮（不进入正式构建流程）。
  const holdMs = Number(process.env.ZIBAN_UI_HOLD ?? 0);
  if (Number.isFinite(holdMs) && holdMs > 0) {
    console.log(`UI smoke 保持 ${holdMs}ms，等待真实鼠标输入…`);
    await new Promise((resolve) => setTimeout(resolve, holdMs));
  }

  try {
    console.log(`UI smoke：窗口可见=${window.isVisible()} 页面=${window.webContents.getURL()}`);
    const image = await window.webContents.capturePage();
    const dir = path.join(repoRoot, 'screenshots');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'desktop-lookup.png');
    writeFileSync(file, image.toPNG());
    console.log(`UI smoke 截图：${file}`);
    console.log(`窗口尺寸：${JSON.stringify(window.getBounds())}`);
    app.exit(image.isEmpty() ? 6 : 0);
  } catch (error) {
    console.error(`UI smoke 失败：${String(error)}`);
    app.exit(7);
  } finally {
    overlay.destroy();
  }
}

app.on('second-instance', () => showMainWindow());

app.whenReady().then(async () => {
  app.setAppUserModelId('org.ziban.desktop');
  if (!devServerUrl) registerAppProtocol();

  if (OCR_SMOKE) {
    await runOcrSmoke();
    return;
  }
  if (UI_SMOKE) {
    await runUiSmoke();
    return;
  }
  if (LOOKUP_SMOKE) {
    await runLookupSmoke();
    return;
  }
  if (HOVER_SMOKE) {
    await runHoverSmoke();
    return;
  }

  runtime = new ScreenRuntime();
  updateChecker = new UpdateChecker({
    currentVersion: app.getVersion(),
    userDataPath: app.getPath('userData'),
    isEnabled: () => runtime?.config.get().checkUpdates ?? true,
    onStatus: (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ziban:update-status', status);
      }
    },
    onLog: log,
  });
  registerIpc();
  createMainWindow();
  createTray();
  registerHotkeys();
  void runtime.ensureStarted();
  updateChecker.start();

  if (runtime.config.get().hoverEnabled) {
    // 上次退出时是开着的，等引擎准备好再恢复；如果权限被撤销，startHover 会给出提示。
    setTimeout(() => {
      void runtime?.startHover();
    }, 1200);
  }

  powerMonitor.on('lock-screen', () => runtime?.hover.stop());
  powerMonitor.on('suspend', () => runtime?.hover.stop());
  powerMonitor.on('unlock-screen', () => {
    if (runtime?.config.get().hoverEnabled) void runtime.startHover();
  });
  powerMonitor.on('resume', () => {
    if (runtime?.config.get().hoverEnabled) void runtime.startHover();
  });
});

app.on('activate', () => {
  if (!OCR_SMOKE && !UI_SMOKE) showMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

let cleaningUp = false;
app.on('before-quit', (event) => {
  if (cleaningUp) return;
  event.preventDefault();
  cleaningUp = true;
  globalShortcut.unregisterAll();
  updateChecker?.dispose();
  void (async () => {
    try {
      await Promise.race([
        runtime?.dispose() ?? Promise.resolve(),
        new Promise<void>((resolve) => setTimeout(resolve, 3_000)),
      ]);
    } finally {
      app.quit();
    }
  })();
});


// 未捕获异常不要弹系统英文框；记录到控制台，保持 App 可用。
process.on('uncaughtException', (error) => {
  log(`未捕获异常：${error.stack ?? error.message}`);
});
process.on('unhandledRejection', (reason) => {
  log(`未处理的 Promise：${String(reason)}`);
});
