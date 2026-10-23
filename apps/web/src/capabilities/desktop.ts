/**
 * 浏览器/Electron 的能力探测。
 *
 * 页面只通过这里判断“有没有桌面能力”，不直接摸 window.zibanDesktop，
 * 这样浏览器构建、单元测试、以后做浏览器扩展都走同一条降级路径。
 */

import type { DesktopBridgeApi } from '@ziban/core';

declare global {
  interface Window {
    /** 由 apps/desktop/electron/preload.ts 注入；浏览器里不存在。 */
    zibanDesktop?: DesktopBridgeApi;
  }
}

export function getDesktopBridge(): DesktopBridgeApi | null {
  if (typeof window === 'undefined') return null;
  return window.zibanDesktop ?? null;
}

export function isDesktopApp(): boolean {
  return Boolean(getDesktopBridge());
}

export function isOverlayWindow(): boolean {
  return getDesktopBridge()?.isOverlay ?? false;
}
