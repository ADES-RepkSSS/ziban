# 03 · macOS / Electron 工程要点

## 1. 架构

```
┌─────────────────────────────────────────────────────────┐
│ Renderer (React + TS)                                   │
│  识字卡 / 发音教练 / 屏幕助手 HUD / 首启引导             │
│  contextIsolation: true, nodeIntegration: false, CSP    │
└──────────────────┬──────────────────────────────────────┘
                   │ IPC（白名单，只暴露 caps.* 方法）
┌──────────────────▼──────────────────────────────────────┐
│ Main Process (Node 20)                                  │
│  capabilities/  ← 全仓库唯一允许出现 if(platform) 的地方  │
│    ocr   tts   asr   ax   hotkey   window               │
│  ┌──────────────┬───────────────┬────────────────────┐  │
│  │ macOS        │ Windows       │ 通用兜底            │  │
│  │ Vision OCR   │ WinRT OCR     │ RapidOCR (ONNX)    │  │
│  │ AXUIElement  │ UIAutomation  │ —                  │  │
│  └──────────────┴───────────────┴────────────────────┘  │
│  sherpa-onnx（TTS/ASR，三平台一致）                      │
│  SQLite（本地学习记录，不上云）                          │
└─────────────────────────────────────────────────────────┘
```

**纪律：全仓库只允许 `capabilities/` 下出现平台判断。** 这条守住了，Windows 上线时几乎零成本；守不住，第二年就得重写。

## 2. 能力抽象层接口（定稿）

```ts
interface PlatformCaps {
  readonly os: 'macos-x64' | 'macos-arm64' | 'win-x64';

  ocr(img: ImageBitmap): Promise<OcrBlock[]>;           // 文本 + bbox + 置信度
  speak(req: SpeakRequest): SpeakHandle;                 // 含 onBoundary 回调
  listVoices(): Promise<Voice[]>;

  readAccessibilityTree(opts: { depth: number }): Promise<AxNode[]>;
  focusedElement(): Promise<AxNode | null>;

  registerHotkey(accel: string, cb: () => void): Promise<() => void>;
  ensurePermissions(): Promise<PermissionState>;
}
```

`onBoundary`（逐字时间戳）是**识字教学的核心能力**：念句子的同时高亮当前字，老人才能把声音和字形对上。sherpa-onnx 的 VITS 需自行做音素级对齐近似；系统 TTS 走 SSML/AX 回调。

## 3. 六个坑（按翻车概率排序）

### ① 公证（Notarization）—— 唯一不能妥协的点

未公证 = 「无法打开，因为无法验证开发者」= 老人直接卸载。

- `@electron/notarize` 挂在 `afterSign`，用 App Store Connect API Key；
- **公益项目可向 Apple 申请 Developer Program 年费豁免**，周期 2–4 周，**现在就该启动**；
- 兜底：README 里放「右键 → 打开」的截图图解，App 首启做检测并提示。但这只是兜底，不是方案。

### ② 原生模块的架构匹配

`better-sqlite3`、`onnxruntime-node` 都是 ABI 敏感的。

- 必须在**对应架构的机器上** `npm rebuild --arch=arm64 | --arch=x64`，交叉编译基本不可行；
- CI：`macos-13`（x64）+ `macos-15`（arm64）各跑一遍完整构建；
- **不做 Universal 2**：需 `lipo` 合并多个原生模块，CI 失败率极高，收益只是「一个文件」。

**产物：两个 DMG**，下载页按 UA/JS 自动判断架构。

### ③ TCC 权限（辅助功能 / 屏幕录制 / 麦克风）

- 必须在**用户真实点击的同一调用栈**里触发，否则系统不弹框；
- `systemPreferences.isTrustedAccessibilityClient(true)` 引导辅助功能；
- 老人看不懂「系统设置 → 隐私与安全性 → 辅助功能」，必须做**图文引导 + 一键跳转**：
  `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"`
- **Bundle ID 永不变更**：卸载重装后授权会失效，改了 ID 等于让所有老用户重走一遍。

### ④ Apple Vision OCR 接入

Swift 写一个极薄静态库，接口只暴露 `recognize(buffer, langs) -> [{text, bbox, conf}]`，用 `node-addon-api` 包一层。`xcodebuild ARCHS="x86_64 arm64"` 出 fat `.a`。

**接口必须极简，别把 Vision 的类型泄漏到 JS 层**，这样将来换 RapidOCR 不用改调用方。

### ⑤ 语音：不要把系统 TTS 当主力

macOS「婷婷」默认是 compact 音质，机械感强；Windows SAPI 更差。两端音质不一致 = 两套产品体感。

**决策：默认用 sherpa-onnx + 中文 VITS（约 70MB），系统 TTS 只作兜底。** 这是可移植性最关键的一步——音质在两端一致，也才能保证逐字时间戳。

### ⑥ 更新与网络

`electron-updater` + GitHub Releases，国内访问慢。策略：

- 默认**手动检查**（大按钮「检查更新」），不做静默后台更新；
- 提供镜像源配置（对象存储 / jsDelivr）；
- 更新包体积大时提示「正在下载，别关电脑」，并提供进度条——老人最怕「不知道要等多久」。

## 4. 安全基线

| 项 | 设置 |
|---|---|
| `contextIsolation` | `true` |
| `nodeIntegration` | `false` |
| `sandbox` | `true`（渲染进程） |
| `webSecurity` | `true` |
| CSP | `default-src 'self'; img-src 'self' data:; media-src 'self'` |
| 外链 | 一律 `shell.openExternal` 前弹确认，或直接禁止 |
| 网络白名单 | 主进程维护允许域名，CI 静态扫描 + 运行时校验 |

**网络白名单要做成技术强制**：出现白名单外的请求，CI 直接失败。这是给老人用的软件，一次弹窗诈骗就能摧毁信任。

## 5. 首启引导（三步，每步一张图一句话）

1. **「先认识一下」**——一张图讲清「这个软件会念字给你听」。不放任何设置项。
2. **「允许它看屏幕」**——系统授权引导。**只在这时才要权限，不要一上来就要。**
3. **「试试看」**——直接进一张真实词卡（药），让他立刻听到声音。

**不在首启做任何配置选择**（语速、字号、主题）。全部用默认值；老人在使用中用「🐢 慢一点」这类按钮自行调节。

## 6. 性能预算（老人机器普遍是旧 MacBook Air）

| 指标 | 预算 |
|---|---|
| 冷启动到可交互 | < 2.5s |
| 框选 OCR 到出声 | < 1.5s（Vision）/ < 3s（RapidOCR 兜底）|
| 常驻内存 | < 250MB |
| 安装包 | < 400MB（含模型与 50 词内容） |
| 空闲 CPU | ~0（无轮询；热键走系统级注册） |

## 7. 构建矩阵

| 目标 | Runner | 产物 |
|---|---|---|
| macOS Intel | `macos-13` | `Ziban-x.y.z-x64.dmg` |
| macOS Apple Silicon | `macos-15` | `Ziban-x.y.z-arm64.dmg` |
| Windows x64 | `windows-2022` | `Ziban-Setup-x.y.z.exe`（NSIS，装到 LOCALAPPDATA，无需管理员） |

签名：macOS 用 Apple Developer ID + notarize；Windows 用 **SignPath Foundation 的免费 OSS 代码签名**。
