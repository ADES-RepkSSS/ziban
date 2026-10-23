/**
 * Electron preload：只暴露白名单方法。
 *
 * 纪律：
 * - 不暴露 ipcRenderer、require、process 等原始对象；
 * - 每个方法只做一个明确动作，参数在主进程再次校验；
 * - 订阅函数返回 unsubscribe，React StrictMode 下不会重复挂监听。
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  DesktopBridgeApi,
  DesktopConfigPatch,
  DesktopPublicConfig,
  DesktopScreenStatus,
  DesktopUpdateStatus,
  LlmTestResult,
  ScreenLookupPayload,
} from '@ziban/core';

const isOverlay = process.argv.includes('--ziban-overlay=1');
const platform: DesktopBridgeApi['platform'] =
  process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux';

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, value: T): void => listener(value);
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
}

const api: DesktopBridgeApi = {
  version: 1,
  platform,
  isOverlay,
  getStatus: () => ipcRenderer.invoke('ziban:status') as Promise<DesktopScreenStatus>,
  startHover: () => ipcRenderer.invoke('ziban:start-hover') as Promise<DesktopScreenStatus>,
  stopHover: () => ipcRenderer.invoke('ziban:stop-hover') as Promise<DesktopScreenStatus>,
  lookupAtCursor: () => ipcRenderer.invoke('ziban:lookup-at-cursor') as Promise<ScreenLookupPayload>,
  requestScreenPermission: () =>
    ipcRenderer.invoke('ziban:request-permission') as Promise<DesktopScreenStatus>,
  openSystemSettings: (panel) => ipcRenderer.invoke('ziban:open-system-settings', panel),
  getConfig: () => ipcRenderer.invoke('ziban:get-config') as Promise<DesktopPublicConfig>,
  updateConfig: (patch: DesktopConfigPatch) =>
    ipcRenderer.invoke('ziban:update-config', patch) as Promise<DesktopPublicConfig>,
  testLlm: () => ipcRenderer.invoke('ziban:test-llm') as Promise<LlmTestResult>,
  clearCache: () => ipcRenderer.invoke('ziban:clear-cache') as Promise<number>,
  getUpdateStatus: () =>
    ipcRenderer.invoke('ziban:update-status') as Promise<DesktopUpdateStatus>,
  checkForUpdates: () =>
    ipcRenderer.invoke('ziban:check-updates') as Promise<DesktopUpdateStatus>,
  openUpdatePage: () => ipcRenderer.invoke('ziban:open-update-page') as Promise<void>,
  onUpdateStatus: (listener) =>
    subscribe<DesktopUpdateStatus>('ziban:update-status', listener),
  overlayReady: () => ipcRenderer.invoke('ziban:overlay-ready') as Promise<void>,
  focusOverlay: () => ipcRenderer.invoke('ziban:focus-overlay') as Promise<void>,
  hideOverlay: () => ipcRenderer.invoke('ziban:hide-overlay') as Promise<void>,
  resizeOverlay: (height: number) =>
    ipcRenderer.invoke('ziban:resize-overlay', height) as Promise<void>,
  openMainWindow: () => ipcRenderer.invoke('ziban:open-main') as Promise<void>,
  copyText: (text: string) => ipcRenderer.invoke('ziban:copy-text', text) as Promise<void>,
  onLookup: (listener) => subscribe<ScreenLookupPayload>('ziban:lookup', listener),
  onStatus: (listener) => subscribe<DesktopScreenStatus>('ziban:status-changed', listener),
  onConfig: (listener) => subscribe<DesktopPublicConfig>('ziban:config-changed', listener),
};

contextBridge.exposeInMainWorld('zibanDesktop', api);
