/**
 * 版本检查（只提示，不自动更新）。
 *
 * 设计边界：
 * - 只访问 GitHub 公共接口：latest release → tags → 仓库 main 的 package.json；
 * - 不发送设备信息、不做埋点；User-Agent 只带版本号；
 * - 结果缓存 24 小时，避免每次启动都请求；
 * - 网络失败/限流时静默（state=error），不打扰老人；
 * - 默认开启，可在设置里关闭，或设 ZIBAN_DISABLE_UPDATE_CHECK=1；
 * - 只接受 github.com/ADES-RepkSSS/ziban/... 的链接，防止被篡改成任意地址。
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DesktopUpdateStatus } from '@ziban/core';

const REPO = 'ADES-RepkSSS/ziban';
const API_ROOT = `https://api.github.com/repos/${REPO}`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
const CACHE_FILE = 'ziban-cache/update-check.json';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;

export interface UpdateCheckerOptions {
  currentVersion: string;
  userDataPath: string;
  /** 用户设置里的“自动检查新版本”；关闭后启动时不联网。 */
  isEnabled: () => boolean;
  onStatus?: (status: DesktopUpdateStatus) => void;
  onLog?: (message: string) => void;
}

interface CachedStatus {
  checkedAt: number;
  status: DesktopUpdateStatus;
}

/** 支持 v1.2.3 / 1.2.3；预发布标签只比较前三段。 */
export function compareVersions(left: string, right: string): number | null {
  const parse = (value: string): [number, number, number] | null => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value.trim());
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index]! > b[index]! ? 1 : -1;
  }
  return 0;
}

function safeReleaseUrl(candidate: string | null | undefined): string {
  if (!candidate) return RELEASES_PAGE;
  try {
    const url = new URL(candidate);
    if (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname.startsWith(`/${REPO}/`)
    ) {
      return url.toString();
    }
  } catch {
    // fall through
  }
  return RELEASES_PAGE;
}

export class UpdateChecker {
  private readonly options: UpdateCheckerOptions;
  private readonly cachePath: string;
  private status: DesktopUpdateStatus;
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<DesktopUpdateStatus> | null = null;

  constructor(options: UpdateCheckerOptions) {
    this.options = options;
    this.cachePath = path.join(options.userDataPath, CACHE_FILE);
    this.status = {
      state: 'unknown',
      currentVersion: options.currentVersion,
      latestVersion: null,
      url: null,
      checkedAt: null,
      message: null,
    };
    this.loadCache();
  }

  getStatus(): DesktopUpdateStatus {
    return { ...this.status };
  }

  /** 启动后延迟 3 秒检查，不阻塞窗口/OCR。 */
  start(): void {
    if (process.env.ZIBAN_DISABLE_UPDATE_CHECK === '1') return;
    if (!this.options.isEnabled()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.options.isEnabled()) return;
      void this.check(false);
    }, 3_000);
    this.timer.unref?.();
  }

  async check(force = false): Promise<DesktopUpdateStatus> {
    if (this.inFlight) return this.inFlight;
    if (!force && this.isCacheFresh()) return this.getStatus();
    if (!force && !this.options.isEnabled()) return this.getStatus();
    if (process.env.ZIBAN_DISABLE_UPDATE_CHECK === '1') return this.getStatus();

    this.setStatus({ ...this.status, state: 'checking', message: null });
    this.inFlight = this.fetchLatest()
      .then((result) => {
        const checkedAt = Date.now();
        const next: DesktopUpdateStatus = {
          ...result,
          currentVersion: this.options.currentVersion,
          checkedAt,
        };
        this.setStatus(next);
        this.saveCache(next);
        return this.getStatus();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.options.onLog?.(`检查更新没成功：${message}`);
        const next: DesktopUpdateStatus = {
          ...this.status,
          state: 'error',
          checkedAt: Date.now(),
          message: '暂时没连上 GitHub，稍后再试。',
        };
        this.setStatus(next);
        return this.getStatus();
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async fetchLatest(): Promise<Omit<DesktopUpdateStatus, 'currentVersion' | 'checkedAt'>> {
    // 1) 正式 release
    const release = await this.getJson<{ tag_name?: string; html_url?: string }>(
      `${API_ROOT}/releases/latest`,
      true,
    );
    if (release?.tag_name) {
      return this.resultFor(release.tag_name, safeReleaseUrl(release.html_url));
    }

    // 2) 没有 release 时看 tag
    const tags = await this.getJson<Array<{ name?: string }>>(`${API_ROOT}/tags?per_page=1`, true);
    const tag = Array.isArray(tags) ? tags.find((item) => item.name)?.name : null;
    if (tag) return this.resultFor(tag, RELEASES_PAGE);

    // 3) 都没有时看 main 的 package.json。
    // 用 GitHub Contents API 而不是 raw.githubusercontent.com：部分网络会重置 raw 连接，
    // 但 api.github.com 通常可用；这样没有 release/tag 时也能判断版本。
    const pkg = await this.getJson<{ content?: string; encoding?: string }>(
      `${API_ROOT}/contents/package.json`,
      true,
    );
    if (pkg?.content) {
      try {
        const json = Buffer.from(pkg.content, 'base64').toString('utf8');
        const version = (JSON.parse(json) as { version?: unknown }).version;
        if (typeof version === 'string' && version) {
          return this.resultFor(version, RELEASES_PAGE);
        }
      } catch {
        // 内容不是合法 package.json 时继续返回 unknown。
      }
    }

    return {
      state: 'unknown',
      latestVersion: null,
      url: null,
      message: 'GitHub 上还没有版本标签。',
    };
  }

  private resultFor(
    latestVersion: string,
    url: string,
  ): Omit<DesktopUpdateStatus, 'currentVersion' | 'checkedAt'> {
    const cmp = compareVersions(latestVersion, this.options.currentVersion);
    if (cmp === null) {
      return { state: 'unknown', latestVersion, url, message: '版本号格式看不懂。' };
    }
    return {
      state: cmp > 0 ? 'available' : 'current',
      latestVersion,
      url,
      message: cmp > 0 ? `有新版本 ${latestVersion}` : null,
    };
  }

  private async getJson<T>(url: string, allowNotFound: boolean): Promise<T | null> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': `Ziban/${this.options.currentVersion}`,
        Accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  }

  private setStatus(status: DesktopUpdateStatus): void {
    this.status = status;
    this.options.onStatus?.(this.getStatus());
  }

  private isCacheFresh(): boolean {
    return Boolean(this.status.checkedAt && Date.now() - this.status.checkedAt < CACHE_MAX_AGE_MS);
  }

  private loadCache(): void {
    if (!existsSync(this.cachePath)) return;
    try {
      const cached = JSON.parse(readFileSync(this.cachePath, 'utf8')) as CachedStatus;
      if (
        cached &&
        typeof cached.checkedAt === 'number' &&
        cached.status &&
        ['current', 'available'].includes(cached.status.state) &&
        Date.now() - cached.checkedAt < CACHE_MAX_AGE_MS
      ) {
        // 应用可能已经升级：用当前版本重新判定，避免旧缓存继续提示“有新版本”。
        const cmp = cached.status.latestVersion
          ? compareVersions(cached.status.latestVersion, this.options.currentVersion)
          : null;
        const state = cmp !== null && cmp > 0 ? 'available' : 'current';
        this.status = {
          ...cached.status,
          state,
          currentVersion: this.options.currentVersion,
          message: state === 'available' ? cached.status.message : null,
        };
      }
    } catch {
      // 缓存坏了不影响启动。
    }
  }

  private saveCache(status: DesktopUpdateStatus): void {
    try {
      const file = path.join(this.options.userDataPath, CACHE_FILE);
      mkdirSync(path.dirname(file), { recursive: true });
      const temp = `${file}.tmp`;
      const payload: CachedStatus = { checkedAt: status.checkedAt ?? Date.now(), status };
      writeFileSync(temp, `${JSON.stringify(payload)}\n`, { encoding: 'utf8', mode: 0o600 });
      renameSync(temp, file);
    } catch {
      // 写缓存失败不影响检查结果。
    }
  }
}
