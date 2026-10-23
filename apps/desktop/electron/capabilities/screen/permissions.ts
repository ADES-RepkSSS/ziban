/**
 * 屏幕录制权限（macOS TCC）与 Windows 的“不需要权限”。
 *
 * macOS 的关键事实：
 * - 屏幕录制权限（Screen Recording）不是麦克风/摄像头那种可以用
 *   systemPreferences.askForMediaAccess() 主动申请的；必须真正发起一次
 *   屏幕采集，系统才会弹框。这里用 desktopCapturer.getSources() 触发。
 * - 授权后有些系统版本要重启应用才生效；UI 文案要提。
 * - 权限绑定 bundle id + 代码签名；开发版（Electron.app）和打包版是两份权限。
 * - 辅助功能（Accessibility）只在读 AX 树/模拟按键时需要，当前 OCR 方案不需要。
 */

import {
  desktopCapturer,
  shell,
  systemPreferences,
  type DesktopCapturerSource,
} from 'electron';
import type { ScreenPermissionState } from '@ziban/core';

function mapStatus(status: string): ScreenPermissionState {
  switch (status) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'restricted':
      return 'restricted';
    case 'not-determined':
      return 'not-determined';
    default:
      return 'unknown';
  }
}

export function isMac(): boolean {
  return process.platform === 'darwin';
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export async function getScreenPermission(): Promise<ScreenPermissionState> {
  if (isWindows()) return 'not-needed';
  if (!isMac()) return 'unknown';
  try {
    return mapStatus(systemPreferences.getMediaAccessStatus('screen'));
  } catch {
    return 'unknown';
  }
}

/**
 * 触发 macOS 屏幕录制授权。
 *
 * 注意：这个函数会“真的截一张非常小的图”。不要一启动就调用；只能在用户
 * 点击“允许看屏幕”时调用，否则老人一打开软件就被系统弹框吓到。
 */
export async function requestScreenPermission(): Promise<ScreenPermissionState> {
  if (!isMac()) return getScreenPermission();
  const before = await getScreenPermission();
  if (before === 'granted') return before;

  try {
    const sources: DesktopCapturerSource[] = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 32, height: 18 },
      fetchWindowIcons: false,
    });
    // 没权限时 sources 可能是空数组；这里不把它当失败，后面再查状态。
    void sources;
  } catch {
    // 权限被拒绝时 Electron 可能直接抛错，状态查询会给出 denied。
  }

  // 给系统设置留一点时间写入 TCC 状态；不要在这里弹窗骚扰用户。
  await new Promise((resolve) => setTimeout(resolve, 800));
  return getScreenPermission();
}

export async function openScreenSettings(): Promise<void> {
  if (!isMac()) return;
  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  );
}

export async function openAccessibilitySettings(): Promise<void> {
  if (!isMac()) return;
  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  );
}

/** 老人能看懂的下一步，避免直接抛系统术语。 */
export function permissionHint(state: ScreenPermissionState): string | null {
  switch (state) {
    case 'granted':
    case 'not-needed':
      return null;
    case 'not-determined':
      return '点“允许看屏幕”，系统会问一次。选“允许”才能看到屏幕上的字。';
    case 'denied':
      return '系统现在不让字伴看屏幕。点“打开系统设置”，在“隐私与安全性 → 屏幕录制”里打开字伴，再回来试。';
    case 'restricted':
      return '这台电脑的管理设置不允许看屏幕。可以让家里人帮忙检查。';
    default:
      return '这台电脑的屏幕权限还看不清。可以先让家里人帮忙看看系统设置。';
  }
}
