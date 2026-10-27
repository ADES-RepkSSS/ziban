# 08 · 光标跟随屏幕取词（桌面版）

> 写于 2026-10-23。目标：**不框选、不复制，鼠标停在哪，字伴就在旁边的小窗里说清楚那个字/词。**
> 当前 Windows 已本机实测；macOS 代码与 CI 编译流程已写，**还需要在真实 Mac 上跑一遍**（见第 9 节清单）。

## 1. 当前状态（必须先看）

| 项 | 状态 |
|---|---|
| Windows 11 x64 | ✅ 已实测：真实截屏 + 中文 OCR + 取词 + 小窗 + 本机字卡 + 可选大模型 |
| macOS 11+（建议 13+） | 🟡 代码完成、未在 Mac 实机验证；GitHub Actions `Desktop macOS OCR` 会编译 Vision helper 并识别测试图 |
| Linux | ❌ 只做能力降级，界面提示“先粘贴文字” |
| 浏览器（GitHub Pages） | ❌ 看不到别的软件；仍走“粘贴文字”路径 |
| 大模型 | ✅ 可选，OpenAI 兼容接口；默认关闭，必须家人填网址/模型/密钥并打开 |
| 语料库/爬虫 | 🟡 接口与 JSON 目录已留，爬虫还没写 |
| 截图保存 | ❌ 默认不保存；截屏文件在 OCR 后立即删除 |
| 全屏录制 | ❌ 不做；只截光标周围自适应小区域（260–420 DIP 宽，随分辨率/缩放变化） |

Windows 本机实测（2560×1600、200% 缩放、Windows 11）：

- 单次“截小区域 + WinRT OCR”：约 20–60ms；首次冷启动约 1s（PowerShell + WinRT 初始化）。
- 从鼠标停稳到小窗出现：约 380ms（含 380ms 停稳判定时约 0.8s 体感）；实测 `totalMs` 44–438ms。
- 小窗：约 400×340 DIP（无风险提示）/ 400×517 DIP（带长释义、例句、风险提示）。
- 本机词表：550 张字卡 + 约 120 条离线词条；未知词可只给拼音，或由大模型补。

## 2. 为什么不框选

“框选 → 截图 → OCR”对老人是四步操作：找热键、按住、拖一个框、等结果。每一步都可能卡住。
本方案把交互压成一步：**打开“看屏幕”，把鼠标放到字上，停一下。**

“实时”不是持续录屏，而是：

1. 每 160ms 只看光标坐标（不截屏、不 OCR）；
2. 光标停稳 380ms 才截一次小区域，区域大小随当前显示器工作区/缩放自适应；
3. 同一位置 650ms 内最多一次；同一结果 2.5s 内不重复；
4. 光标移动时不截屏，空闲 CPU 接近 0。

这样既符合“光标放在哪就查哪”，也不会让旧电脑一直发烫。

## 3. 用户体验

### 打开

首页新增一张卡：“鼠标停在哪，我就念哪” → “开始看屏幕”。
设置页也有同一个开关。首次开启时：

- Windows：直接可用（不需要授权）；
- macOS：系统会弹“字伴想录制屏幕” → 选“允许”。如果之前拒绝过，设置页会显示“打开系统设置”的大按钮。

### 使用

- 把鼠标停在不认识的字上，停一下；小窗出现在光标右下（靠近屏幕边缘会自动翻到另一侧）。
- 小窗显示：词、拼音、释义、例句、来源；有风险（验证码/转账/链接）时多一条“先别急着按”。
- 自动念“词 + 释义”（可在设置关掉）；点右上角“念”重念；点例句旁“听”只听例句。
- 点右上角“×”收起；鼠标不动不会再弹，移动后才继续。
- 全局快捷键：`Ctrl+Shift+Z`（macOS 为 `⌘+Shift+Z`）立即查鼠标下面的字；`Ctrl+Shift+H` 开/停跟随。
- 托盘菜单：打开字伴 / 暂停看屏幕 / 退出。

### 老人不会被指责

所有失败文案都是“这次没看清，再试一次”“看屏幕暂时停下来了，点开始再试一次”，
没有“错误”“失败”“你错了”。

## 4. 架构

```text
┌──────────────────────────── Renderer (apps/web) ────────────────────────────┐
│ 首页 ScreenLookupCard / 设置 ScreenSettingsSection / 小窗 LookupPage        │
│   ↕ window.zibanDesktop（preload 白名单 IPC，contextBridge）                 │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│ Main Process (apps/desktop/electron)                                        │
│  ScreenRuntime（组装配置/词表/屏幕/知识/小窗/hover）                          │
│  HoverController：光标停稳 → 截小区域 → OCR → 找字 → 本机知识 → 可选大模型     │
│  OverlayController：400px 悬浮窗、置顶、不抢焦点、setContentProtection        │
│  ┌──────────────────────────────┬───────────────────────────────────────┐  │
│  │ Windows                      │ macOS                                  │  │
│  │ PowerShell 常驻进程           │ /usr/sbin/screencapture -R 小区域       │  │
│  │  ├ System.Drawing 截屏        │  └ 需要“屏幕录制”TCC 权限              │  │
│  │  └ Windows.Media.Ocr（WinRT） │ Apple Vision（Swift helper，stdin/out） │  │
│  │ 无需屏幕授权                  │ 不需要辅助功能权限                     │  │
│  └──────────────────────────────┴───────────────────────────────────────┘  │
│  KnowledgeService：字卡 > 语料库 > 本机词表 > 大模型补缺；JSON 缓存            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 一次查询的数据流

```text
cursor point (DIP)
  → ScreenEngine.captureAtCursor(按工作区自适应，260–420 DIP 宽)
      Windows: PowerShell GetCursorPos + GetDpiForMonitor → 物理像素区域 → PNG
      macOS:   screen.getCursorScreenPoint → screencapture -R
  → OCR（WinRT / Vision）→ RawOcrPage
  → normalizeOcrPage()（core/screen.ts：统一左上角像素坐标、逐字框）
  → lookupAtPoint()（core/screen.ts：光标在哪个字、词表最长匹配 + Intl.Segmenter 整词切分）
  → KnowledgeService.localLookup()（本机字卡/词表/语料库，立即出小窗）
  → 可选 LLM enrich()（只补空缺，标 generated）
  → ScreenLookupPayload → IPC → LookupPage → Web Speech 朗读
```

## 5. Windows 实现

文件：

- `apps/desktop/electron/native/windows/ocr-host.ps1`：常驻 PowerShell，截屏 + WinRT OCR。
- `apps/desktop/electron/capabilities/screen/windows.ts`：Node 侧守护、超时、NDJSON、临时脚本 BOM。
- `apps/desktop/electron/capabilities/screen/windows-engine.ts`：`ScreenEngine` 实现。

要点（改之前先看）：

1. **必须 UTF-8 BOM**：Windows PowerShell 5.1 读无 BOM UTF-8 会按 GBK 解码，中文字符串直接把脚本语法搞坏。Node 在启动时把源码复制到临时目录并加 BOM；仓库源文件保持无 BOM，方便 diff。
2. **必须 Per-Monitor DPI Aware**：脚本启动时调 `SetProcessDpiAwarenessContext(-4)`（失败降级 `SetProcessDPIAware`），再用 `GetCursorPos` / `MonitorFromPoint` / `GetDpiForMonitor` 算物理像素区域。否则 200% 缩放下会截偏。
3. **只截小区域，但按显示器自适应**：宽度取工作区的 26%，限制在 260–420 DIP；
   高度取宽度的 52%，限制在 140–230 DIP。1280×800 下约 333×173，1920×1080 下约 420×218。
   200% 屏上 333 DIP 会变成 666 物理像素；`CopyFromScreen` 支持负坐标（多显示器在左侧）。
4. **100% 缩放会放大 2 倍再 OCR**：`dpi < 144` 时 `upscale=2`，否则 14px 的界面字对 WinRT 偏小；返回的 `cursor` 也乘了倍数。
5. **中文 OCR 语言包**：`Windows.Media.Ocr.OcrEngine.AvailableRecognizerLanguages` 必须有 `zh-Hans-CN`。没有时返回 `NO_ZH_OCR`，UI 提示去“Windows 设置 → 时间和语言 → 语言和区域”添加中文的“光学字符识别”。
6. **截图立即删**：`%TEMP%\ziban-screen-ocr-<pid>.png` 在 OCR 后 `finally` 删除。
7. **超时**：Node 侧 8s 请求超时；超时会杀掉宿主，下次使用再启动。
8. **WinRT 每个汉字一个 word**：`line.Words` 直接给逐字 bbox，比按行均分准；core 会丢掉汉字之间的 OCR 空格。

## 6. macOS 实现（重点）

### 6.1 需要什么权限

| 能力 | 权限 | 是否必须 |
|---|---|---|
| 截屏 `screencapture -R` | **屏幕录制**（Screen Recording） | 必须 |
| Apple Vision OCR | 无（只读 PNG） | 不需要 |
| 全局快捷键 | 一般不需要辅助功能；若被系统占用会注册失败 | 可选 |
| 读 AX 树/模拟按键 | 辅助功能（Accessibility） | **当前方案不用** |

所以老人只需要允许一次“屏幕录制”。这比“辅助功能”门槛低，也更容易解释：**字伴只看鼠标旁边一小块，不录整屏。**

### 6.2 为什么用 `screencapture` + 自编译 Vision helper

- `screencapture` 是 macOS 自带、Apple 签名的工具，支持 `-R x,y,w,h` 只截一块；不需要引入原生 Node 模块。
- Vision helper 是一个几十行的 Swift 程序：stdin 收 JSON，stdout 回 JSON，只读图片。
- 权限被收敛在“截屏”这一层；OCR 进程不需要任何 TCC 权限，排查简单。
- 不用 Electron `desktopCapturer` 的原因：它适合整屏/窗口共享，每帧拿全屏再裁剪在旧 MacBook 上 CPU/内存都高；而且我们只需要 2–3Hz 的小块。

### 6.3 首次运行会发生什么

1. 主进程启动时 `MacOcrHost.ensureBinary()`：
   - 优先找 `userData/bin/ziban-vision-ocr`、打包资源 `resources/bin/ziban-vision-ocr`、开发目录 `apps/desktop/dist-native/ziban-vision-ocr`；
   - 都没有时，用 `xcrun --sdk macosx swiftc` 编译 `native/macos/vision-ocr.swift` 到 `userData/bin/`。
   - 需要 Xcode Command Line Tools（免费）：`xcode-select --install`。没有时 UI 会明确说“第一次在 Mac 上用，需要安装命令行工具”，不会假装坏掉。
2. 用户点“开始看屏幕”：
   - 如果 TCC 状态是 `not-determined`，主进程调用 `desktopCapturer.getSources()` 真正触发系统弹框；
   - 800ms 后复查 `systemPreferences.getMediaAccessStatus('screen')`；
   - 仍是 `not-determined`/`denied`/`restricted` → 不启动 hover，设置页显示图文引导 + “打开系统设置”按钮（深链 `x-apple.systempreferences:...Privacy_ScreenCapture`）。
3. 截屏：
   - `screen.getCursorScreenPoint()` 拿 DIP 坐标；
   - core `regionAroundPoint()` 夹到当前显示器；
   - `/usr/sbin/screencapture -x -t png -R<x,y,w,h> <tmp>`；
   - Retina 输出是 2x；`scale = image.width / region.width`，光标位置按比例映射；
   - OCR 后删除 PNG。
4. OCR：Vision `VNRecognizeTextRequest`，`recognitionLevel=.accurate`、`usesLanguageCorrection=false`，语言 `zh-Hans/zh-Hant/en-US`；
   - 每个字符用 `candidate.boundingBox(for:)` 拿框；拿不到就退回整行框，core 均分；
   - 归一化坐标（左下原点）转成左上原点像素坐标。

### 6.4 macOS 版本与系统坑

- **macOS 11+** 才支持中文 Vision OCR；更老系统返回 `VISION_UNSUPPORTED`。
- **macOS 15 Sequoia** 对屏幕录制权限提示更频繁；如果 `screencapture` 触发每周/每月提示，这是系统行为。后续可换 `ScreenCaptureKit` + `SCContentSharingPicker` 减少提示（见第 11 节）。
- **授权后可能要重启**：部分系统版本授予“屏幕录制”后，已运行的进程仍拿不到画面。设置页应写“如果还不行，把字伴关掉再打开”。
- **bundle id + 代码签名绑定权限**：开发版（Electron.app）和打包版（Ziban.app）是两份权限；改了 bundle id 等于让所有老用户重新授权。正式版必须固定 bundle id，并按 docs/03 做签名/公证。
- **`screencapture` 被系统静默拦**：可能输出壁纸/黑图而不是报错。我们在 OCR 为空时再查一次 TCC 状态；非 granted 就报“系统没让字伴看屏幕”，不再说“没看清”。
- **全屏 App / 多桌面**：小窗 `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`；屏幕录制权限也覆盖全屏空间。
- **多显示器**：`screen.getDisplayNearestPoint` + `display.bounds` 处理负坐标；`screencapture -R` 支持负坐标，但必须在真机验证左侧副屏。

### 6.5 能不能拿到 macOS 权限？（结论）

**能，但只能由用户手动允许。** 这不是可以通过代码绕过的权限：

- 屏幕录制属于 TCC，首次采集时系统弹框；用户拒绝后只能去系统设置打开；
- 我们不能静默申请，也不应该诱导；
- 如果用户拒绝，产品降级为“粘贴文字 / 复制后查剪贴板”，不阻塞基础识字。
- 不需要辅助功能权限（当前 OCR 方案），所以比“读屏软件”少一道门槛。

### 6.6 在 Mac 上验收的完整清单

```bash
# 1. 安装依赖（Electron 会下载对应架构的运行时）
pnpm install --frozen-lockfile

# 2. 构建 Web + Electron 主进程 + 资源
pnpm desktop:build

# 3. 先单独验证 Vision helper（不需要屏幕权限）
bash apps/desktop/electron/native/macos/build-vision-ocr.sh
printf '%s\n' "{\"id\":\"1\",\"cmd\":\"ocr-file\",\"path\":\"$PWD/apps/desktop/fixtures/ocr-sample.png\"}" \
  | apps/desktop/dist-native/ziban-vision-ocr
# 期望输出包含“医院”“验证码”

# 4. 启动桌面版
pnpm desktop:start
```

验收项：

- [ ] 启动后首页出现“鼠标停在哪，我就念哪”。
- [ ] 点“开始看屏幕”，系统弹“屏幕录制”授权；允许后状态变为“正在看屏幕”。
- [ ] 打开 Safari/备忘录，鼠标停在“验证码”上，约 1s 内出现小窗，显示词/拼音/释义/例句。
- [ ] 小窗不抢焦点：停在输入框里打字时，小窗出现不会打断输入。
- [ ] 点小窗“念”，能听到中文；点“听”只念例句。
- [ ] 点“×”后鼠标不动不再弹；移动后恢复。
- [ ] `⌘+Shift+Z` 能手动查鼠标下的字；`⌘+Shift+H` 能开/停。
- [ ] 拒绝权限后，设置页出现“打开系统设置”，点它能跳到“隐私与安全性 → 屏幕录制”。
- [ ] 授权后如果仍无画面，重启字伴能恢复。
- [ ] 在“系统设置 → 隐私与安全性 → 屏幕录制”里关掉字伴，再回来看：小窗停止，并提示去打开权限，不刷屏。
- [ ] 双屏（左侧副屏、Retina）各试一次，小窗不越界、截取位置正确。
- [ ] 全屏 App（如 Keynote 演示/视频）上小窗仍可见（`visibleOnFullScreen`）。
- [ ] `pnpm typecheck`、`pnpm test`、`pnpm check` 通过。

> 注意：开发模式下 TCC 可能把权限记在 “Electron” 而不是 “字伴”。如果系统设置里找不到字伴，先看列表里有没有 Electron / Terminal，并确认是从同一个启动方式运行。正式打包版必须用固定 bundle id 再测一次。

## 7. 小窗与交互实现

- 取词单位：**整个词**。词表命中“验证码/挂号/窗口”等人工词条时优先；词表没覆盖时用
  `Intl.Segmenter('zh-CN', { granularity: 'word' })` 切词（如“今天很暖和”→“暖和”）；
  只有分词器也拿不到词时才退化为单字。“我的/这个/因为”等语法组合会跳过。
- 窗口：`400×140..560` DIP，`frame:false`、`transparent:true`、`alwaysOnTop`、`skipTaskbar`、`showInactive()`。
- 位置：光标右下 18/24 DIP；右边/下边不够就翻到左边/上边；夹在工作区。
- 宽度：工作区的 62%，最小 320、最大 400；高度：工作区的 82%，最小 240、最大 560。屏幕特别矮时卡片内部滚动。
- `setContentProtection(true)`：小窗不会出现在下一次截图里，避免 OCR 把自己的解释再认一遍。
- 状态机：`loading`（本机内容已出，模型还在补）/ `ready` / `empty`（只会念）/ `error`（没看清）。
- 自动朗读：只在 `ready` 且是新请求时念“词 + 释义”；不自动念例句（和识字卡一致）。
- 小窗按钮：鼠标进入小窗时主进程 `focus()`，避免 Windows 上 `showInactive()` 的窗口第一次点击只用于激活；
  “念”按钮在播放时显示“正在念”，语音错误会显示“这次没念出来”而不是静默。
- 失败：小窗显示“这次没看清”，带“再看一次”和“收起”，2.6s 后自动收起。

## 8. 知识管线与“以后接爬虫/语料库”

### 8.1 优先级

```text
人工字卡（content/cards/level1.yaml）
  > userData/corpus/*.json（爬虫/语料库）
  > 本机离线词表 + pinyin-pro
  > 大模型（只补空缺，标 generated）
```

大模型**不会覆盖**已有的人工释义；但可以补例句/拼音。

### 8.2 语料库文件格式（未来爬虫直接写这里）

路径：`<userData>/corpus/*.json`
（Windows：`%APPDATA%\字伴\corpus\`；macOS：`~/Library/Application Support/字伴/corpus/`）

结构校验：[`schema/corpus.schema.json`](../schema/corpus.schema.json)。

```json
{
  "version": 1,
  "name": "社区办事词表",
  "license": "CC-BY-SA-4.0",
  "entries": [
    {
      "word": "验证码",
      "pinyin": "yàn zhèng mǎ",
      "definition": "手机上收到的一串数字，只能自己用。",
      "example": "银行发来的验证码，不要告诉别人。",
      "source": "community-2026-10"
    }
  ]
}
```

给 AI/内容同学的完整制作说明、提示词和验收清单见
[docs/10-corpus-handoff.md](10-corpus-handoff.md)。

规则：

- `word` 1–8 个汉字；`definition` 必须有；`example`/`pinyin` 可空；
- 文件变更自动重载（防抖 500ms）；不需要重启；
- 同名冲突按上面优先级合并；语料库可以覆盖本机词表，但不会覆盖人工字卡；
- 爬虫只负责产出 JSON；字伴不联网抓取。

### 8.3 大模型配置

设置 → “家里人设置：电脑讲解（会联网）”：

- 网址：OpenAI 兼容 `/v1`，例如 `https://api.deepseek.com/v1`、`http://127.0.0.1:11434/v1`（本机允许 http）；
- 模型名：例如 `deepseek-chat`；
- 密钥：只在主进程使用；Windows DPAPI / macOS Keychain 加密保存；不能安全保存时只放内存，关掉要重填；
- 默认 **不** 发送屏幕上下文；勾选“把光标所在的那一行也发过去”才发；
- 缓存：`userData/ziban-cache/lookup-cache.json`，7 天、最多 400 条；设置页有“清除电脑讲解缓存”；
- 返回内容会去 HTML、拒绝 URL、限长；`generated=true` 时 UI 标“电脑生成 · 不一定对”。

> 产品红线：默认不联网；没有密钥/没打开开关时，一个请求都不会发。接大模型是家人主动配置的行为，不是默认行为。

## 9. 隐私与安全

- 只截光标周围自适应小区域（260–420 DIP 宽）；不截全屏、不录视频、不保存历史帧。
- 截图临时文件在 OCR 后立即删除；小窗 `setContentProtection` 被排除在截图外。
- OCR 全部本机完成；默认不联网。
- 大模型默认关闭；只发“词”，可选发“光标所在那一行”；不发整屏、不发截图。
- API Key 不回传渲染层；`getConfig()` 只返回 `hasApiKey`。
- Electron 安全基线：`contextIsolation:true`、`nodeIntegration:false`、`sandbox:true`、白名单 IPC、生产 CSP `default-src 'self'`。
- 小窗专用的 `overlay-ready/resize/hide` IPC 会校验 sender 必须是当前小窗，主窗口误导航到 `#/lookup` 也不会干扰。
- 渲染层网络被 CSP `connect-src 'self'` 限制；大模型请求只在主进程。
- 临时 OCR 脚本复制到 `%TEMP%` 并加 BOM，退出清理；不写系统目录。
- 检查清单：`docs/03-macos-electron.md`、`PRIVACY.md`、`SECURITY.md` 已同步。

## 10. 代码地图

```text
packages/core/src/screen.ts         OCR 归一化、光标找字、词表 + Intl.Segmenter 整词切分、自适应区域计算
packages/core/src/desktop.ts        主进程 ↔ 渲染层 IPC 类型
packages/core/src/screen.test.ts    21 个纯函数测试
apps/desktop/
  electron/main.ts                  生命周期、窗口、托盘、快捷键、IPC、smoke
  electron/preload.ts               白名单 contextBridge
  electron/overlay.ts               小窗定位/显隐/内容保护
  electron/hover.ts                 光标停稳、去重、错误退避
  electron/capabilities/screen/
    types.ts                        ScreenEngine 接口
    permissions.ts                  macOS TCC / Windows 无需权限
    windows.ts                      PowerShell 宿主守护
    windows-engine.ts               Windows ScreenEngine
    macos.ts                        screencapture + Vision helper + ScreenEngine
    index.ts                        平台工厂（全仓库少数 if(platform) 之一）
  electron/capabilities/knowledge/
    config.ts                       配置 + safeStorage
    localLexicon.ts                 50 卡 + 离线词表 + pinyin-pro
    corpus.ts                       语料库 JSON 热加载
    llm.ts                          OpenAI 兼容客户端 + 提示词 + 清洗
    cache.ts                        7 天 JSON 缓存
    service.ts                      优先级/补全/风险
  electron/native/windows/ocr-host.ps1
  electron/native/macos/vision-ocr.swift
  electron/native/macos/build-vision-ocr.sh
  fixtures/ocr-sample.png           跨平台 OCR 测试图
apps/web/src/features/lookup/       小窗页面
apps/web/src/features/screen/       首页卡片 + 设置区 + hook
apps/web/src/capabilities/desktop.ts 浏览器/桌面能力探测
scripts/build-desktop.mjs           esbuild 主进程/preload → CJS
scripts/prepare-desktop.mjs         复制字卡/native/资源
scripts/launch-electron.mjs         清 ELECTRON_RUN_AS_NODE 后启动 Electron
.github/workflows/desktop-macos.yml macOS Vision 编译 + 测试图识别
```

## 11. 测试命令

```bash
pnpm typecheck             # 三个包 strict TS
pnpm test                  # 67 个测试（含 screen 21 个 + corpus 4 个 + TTS 3 个）
pnpm check                 # 内容门禁 + 类型 + 测试 + Web 构建

pnpm desktop:build         # Web + 主进程 + 资源
pnpm desktop:start         # 启动桌面版

# 冒烟（Windows 本机；CI 不跑 GUI）
pnpm desktop:ocr-smoke     # Windows OCR / macOS Vision 测试图 + “暖”→“暖和”整词断言；不移动鼠标
pnpm desktop:lookup-smoke  # 测试窗口 + 真实截屏 + 光标取词 + 本机知识
pnpm desktop:hover-smoke   # 靠鼠标停住触发 hover，截图小窗
pnpm desktop:ui-smoke      # 只渲染小窗并截图 screenshots/desktop-lookup.png
```

当前预期：

- `ocr-smoke`：输出两行“医院挂号在二楼窗口”“验证码不要告诉别人”，exit 0。
- `lookup-smoke`：`status=ready`，`target=验证码`，`pinyin=yàn zhèng mǎ`，`source=card`。
- `hover-smoke`：`hover=true`，`overlayVisible=true`，target 为“验证码”，截图 `screenshots/desktop-hover.png`。
- `ui-smoke`：生成 `screenshots/desktop-lookup.png`，窗口约 400×517。

> 这些 smoke 使用临时 userData，不会污染真实配置。要保留日志可加 `ZIBAN_DEBUG_LOOKUP=1`。
> **必须在桌面解锁、显示器亮着时跑**：Windows 锁屏/息屏时 `CopyFromScreen` 可能返回黑帧，
> 我们会返回 `SCREEN_LOCKED`（“先解锁再试”），而不是把黑屏当成“没字”。
> 正常使用中 `powerMonitor` 收到锁屏/休眠会自动暂停跟随。

## 12. 已知限制 / 下一步

### macOS（最高优先级）

1. **真机跑第 6.6 节清单**，记录 TCC 弹框、screencapture 行为、Retina 坐标、双屏。
2. 把 Vision helper 预编译成 universal 二进制（x86_64 + arm64）随包分发，避免用户装 Xcode CLT；`build-vision-ocr.sh` 里留了 lipo 说明。
3. 用 ScreenCaptureKit 替换 `screencapture` 常驻截图，减少 macOS 15 的重复授权提示；需要新 helper。
4. 签名 + 公证 + 固定 bundle id；否则 TCC 每次都像“新 App”。
5. 若 `screencapture` 在目标系统上无法触发权限，降级方案：Electron `desktopCapturer` 截全屏后裁剪，或让用户“复制文字后按热键读剪贴板”。

### Windows

1. Windows 10 旧版本 / 无中文 OCR 语言包的提示要真机验证。
2. 受 DRM 保护的窗口会黑屏，这是系统行为，不能绕过。
3. 多显示器混合 DPI 的坐标需要再测（当前用 host 侧 `GetCursorPos` + `GetDpiForMonitor`，理论正确）。

### 通用

1. **风险提示对 OCR 错字敏感**：例如“告诉”被识别成“告讣”时，正则可能漏掉验证码风险。可改为“目标词 + 行文本”双通道提示。
2. 取词单位优先整词：词表最长匹配 → `Intl.Segmenter` 中文分词 → 最后才单字；
   但分词器对专名、新词、中英混排仍可能切错，必要时会退化为单字。以后接语料库/自定义词典可继续改善。
3. 只支持中文/英文词；数字、标点不弹窗。
4. 小窗在 800×600 等矮屏上会内部滚动；有条件再做真人测试，个人开发者不把它作为发布阻塞项。
5. 自动朗读可能在快速移动鼠标时频繁打断；已有“停稳 380ms + 去重”限制，建议有条件时真人试。
6. 大模型内容未经审校，必须保持“电脑生成 · 不一定对”；不要把它说成词典。
7. 没有 axe-core 自动检查；小窗对比度/点击区域目前人工核过。

## 13. 交接 Checklist

- [ ] 先读 [AGENTS.md](../AGENTS.md) 与 [docs/07-handoff.md](07-handoff.md)。
- [ ] `pnpm install --frozen-lockfile`，`pnpm check`。
- [ ] Windows：跑 `pnpm desktop:ocr-smoke`、`lookup-smoke`、`hover-smoke`、`ui-smoke`。
- [ ] macOS：按第 6.6 节跑一遍，记录失败点。
- [ ] 改小窗/取词后，更新本文件第 1、10、11 节与 `CHANGELOG.md`。
- [ ] 不要把截图、`apps/desktop/dist-electron`、`resources`、`dist-native` 提交。
- [ ] 新增语料库格式变更时，同时改 `corpus.ts` 与本文件 8.2。
- [ ] 新增平台时，只实现 `ScreenEngine`，不要在 hover/UI 里加 `if(platform)`。

## 14. 排错

| 现象 | 先看什么 | 处理 |
|---|---|---|
| `protocol is undefined` / 主进程第一行崩 | `ELECTRON_RUN_AS_NODE` 是否被全局设为 1 | 用 `pnpm desktop:start`（launch-electron 会清掉）；不要直接 `electron .` |
| 小窗空白/不出现 | `pnpm desktop:ui-smoke` 能否出图 | 检查 `app://ziban/` 协议与 `dist` 是否构建；看主进程日志 |
| 截到的是旧位置/偏一截 | 显示器缩放、host 的 DPI 日志 | 确认 `SetProcessDpiAwarenessContext(-4)` 生效；200% 下 `dpi=192` |
| 截到全黑 / 提示“屏幕锁着” | 桌面是否锁屏、显示器是否息屏 | 解锁并点亮屏幕再试；smoke 也需要活动桌面 |
| Windows OCR 返回空 | 语言包、截图区域 | 跑 `ocr-smoke`；设置里加中文“光学字符识别” |
| macOS 弹了权限但仍无画面 | TCC 状态、是否重启 | 关掉字伴再开；确认系统设置里勾选的是当前 App |
| macOS 提示“需要 Xcode 命令行工具” | `xcrun --find swiftc` | `xcode-select --install`；或使用预编译 helper |
| `$ready` 输出乱码/语法错 | PowerShell 脚本编码 | 必须让 Node 复制成 UTF-8 BOM 再执行 |
| 大模型 401/404 | 网址、模型名、密钥 | 设置页“试一下连不连得上”；本机 http 只允许 127.0.0.1/localhost |
| 大模型返回内容不显示 | 是否被清洗为空/含 URL | 看主进程日志；模型输出必须含中文释义 |
| 小窗遮住内容 | 屏幕边缘/高度 | 已自动翻转；capture 区域按工作区自适应（`captureSizeForWorkArea`），一般在 260–420 DIP 宽 |
