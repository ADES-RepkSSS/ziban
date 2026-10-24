# 09 · 部署与使用

> 这份文档给两类人看：
> 1. **使用者/家人**：怎么启动、首页每个图是什么意思、怎么用屏幕取词；
> 2. **部署者/维护者**：怎么把网页版发布出去、怎么在 Windows/macOS 上跑桌面版、怎么配置可选的大模型与语料库。
>
> 当前版本是实验版：网页版可直接部署；桌面版可从源码运行，Windows 另有免安装绿色版；
> 还没有 DMG/NSIS 安装包、签名和自动更新。

## 1. 三分钟上手（Windows）

```powershell
cd D:\haness_agent\help_old
pnpm install --frozen-lockfile
pnpm desktop:build
pnpm desktop:start
```

启动后：

1. **先解锁 Windows、点亮屏幕**；
2. 首页第一张大卡是 **“看屏幕上的字”**；
3. 点 **“开始看屏幕”**；
4. 切到浏览器/微信/其他软件，把鼠标停在不认识的字上，停约半秒；
5. 小窗出现：词、拼音、释义、例句、来源；有风险时会多一条提醒；
6. 点小窗右上角 `×` 收起；托盘菜单“退出”或关主窗口退出。

快捷键：

- `Ctrl+Shift+Z`：立即查鼠标下面的字
- `Ctrl+Shift+H`：开/停“看屏幕”

> 不要直接运行 `electron .`。本机环境可能有 `ELECTRON_RUN_AS_NODE=1`，会让 Electron 以 Node 方式启动并报 `protocol is undefined`；`pnpm desktop:start` 已处理。

## 2. 首页怎么读（给不识字的老人）

首页不是课程页，而是**按图找工具**：

| 图 | 工具 | 用途 |
|---|---|---|
| 电脑屏幕 + 放大镜 | **看屏幕上的字**（第一张，最大） | 鼠标停在哪，就念哪；不认识的字不用复制 |
| 几张识字卡 | **每天三个字** | 有图、有声音、不考试；今天认完还能再认三个 |
| 四张小图卡 | **看图找字** | 忘了的字，按场景看图点选 |
| 剪贴板 + 声音 | **帮我看屏幕** | 把短信、通知、网页文字粘进来，整段念/讲 |
| 右上角齿轮 | **设置** | 语速、声音、字号、屏幕取词、家人设置 |
| 底部“怎么用” | **三步介绍** | 第一次用或忘了怎么操作时，再听一遍 |

> 屏幕取词是电脑版功能。网页版第一张卡会明确写“先粘贴文字”，不会假装能看别的软件。
> 首次打开直接进首页，不再强制看完三步介绍；需要教程时点底部“怎么用”。

## 3. 网页版部署

### 3.1 本地开发

```bash
pnpm install --frozen-lockfile
pnpm dev
# 打开 http://127.0.0.1:4173
```

`pnpm dev` 会先构建内容（YAML → JSON/SVG），再启动 Vite。修改内容后重新跑即可。

### 3.2 本地生产构建

```bash
pnpm build
# 产物：apps/web/dist
```

`base: './'`，所以 `dist` 可以直接放到任意子路径；路由是 hash（`#/...`），静态服务器不需要 SPA fallback。

本地预览：

```bash
pnpm preview
# 打开 http://127.0.0.1:4173
```

### 3.3 GitHub Pages（当前演示站）

仓库已带 [.github/workflows/pages.yml](../.github/workflows/pages.yml)：

1. 仓库 Settings → Pages → **Source 选 GitHub Actions**（不要选 Jekyll/Static HTML）；
2. push 到 `main`，或手动跑 `Deploy web demo to GitHub Pages`；
3. 部署地址：<https://ades-repksss.github.io/ziban/>。

> **演示站是网页版，没有屏幕取词功能**：浏览器不能读取其他软件，只能粘贴文字。
> 首页的“看屏幕上的字”卡会明确标“网页演示版 · 没有屏幕取词”；桌面版才有光标跟随取词。

工作流做的事：

```text
pnpm install --frozen-lockfile
pnpm build                    # 内容构建 + Vite 构建
upload apps/web/dist          # 上传静态产物
deploy-pages                  # 发布
```

> 页面加载本身会经过 GitHub 的服务器；这是托管行为，不是字伴代码的联网行为。

### 3.4 其他静态托管

把 `apps/web/dist` 整个目录上传到任意静态服务器（Nginx、对象存储、Netlify、Vercel 等）即可：

- 不需要 Node 运行时；
- 不需要重写规则（hash 路由）；
- 确保 `index.html`、`assets/`、`images/` 保持相对路径结构；
- 如果放在子路径（例如 `/ziban/`），`base: './'` 已处理，直接放子目录即可。

## 4. 桌面版部署（从源码运行）

### 4.1 Windows 10/11 x64

要求：Node.js 22.12+、pnpm 11、Windows 10 1809+ / 11。

```powershell
pnpm install --frozen-lockfile
pnpm desktop:build
pnpm desktop:start
```

- 首次安装会下载 Electron 运行时；
- `pnpm desktop:build` = 内容构建 + Web 构建 + Electron 主进程/preload 编译 + 资源复制；
- 不需要屏幕录制权限；
- 需要 Windows 自带的中文 OCR 语言包：设置 → 时间和语言 → 语言和区域 → 中文（简体）→ 光学字符识别；
- 自检：`pnpm desktop:ocr-smoke`。

#### Windows 绿色版（实验，可双击）

```powershell
pnpm desktop:build
pnpm desktop:package
# release\ziban-win32-x64\Ziban.exe
# release\ziban-win32-x64.zip
```

- 不需要安装；把整个 `ziban-win32-x64` 目录拷走，双击 `Ziban.exe`（或 `启动字伴.cmd`）；
- 这是便携版，不会写注册表/开始菜单；数据仍在 `%APPDATA%\字伴\`；
- 未签名，Windows SmartScreen 可能提示“未知发布者”；正式分发前要签名；
- 它仍然是 Electron 的绿色目录（约 200MB），不是 NSIS 安装包；安装包/自动更新尚未做。

### 4.2 macOS 11+（建议 13+）

要求：Node.js 22.12+、pnpm 11、Xcode Command Line Tools、允许字伴“屏幕录制”。

```bash
pnpm install --frozen-lockfile
pnpm desktop:build
pnpm desktop:start
```

首次运行会有两步准备：

1. **编译 Vision OCR helper**：`MacOcrHost` 调用
   `xcrun --sdk macosx swiftc ... -target <arch>-apple-macos11.0` 编译
   [vision-ocr.swift](../apps/desktop/electron/native/macos/vision-ocr.swift) 到 userData；
   没装命令行工具时，界面会提示 `xcode-select --install`。
2. **屏幕录制权限**：点“开始看屏幕”时系统弹框，选“允许”；
   如果之前拒绝过，去“系统设置 → 隐私与安全性 → 屏幕录制”打开字伴，
   部分系统版本需要把字伴关掉再打开。

不需要“辅助功能”权限。完整真机清单见 [docs/08](08-screen-lookup.md) 第 6.6 节。

当前没有 DMG、签名和公证；Gatekeeper/权限提示可能把开发版记成 “Electron”，这是正常的开发态现象。

### 4.3 打包分发（Windows 绿色版已有；安装包/macOS 尚未完成）

当前可用于 Windows 的只有上面的**绿色版目录/zip**；没有 NSIS 安装包、没有自动更新、没有 macOS DMG。
正式分发前还需要：

- macOS：**必须在 macOS 上构建** `electron-builder` 的 `.app`/DMG；固定 bundle id、Developer ID 签名、公证；
- Windows：`electron-builder` NSIS（装到 LOCALAPPDATA，无需管理员）、代码签名；
- Windows 绿色版换成带图标的 exe（`rcedit`/electron-builder），避免显示 Electron 默认图标；
- 把 `apps/desktop/resources` 里的 `web/`、`cards.generated.json`、`native/` 打进应用资源；
- macOS 预编译 universal Vision helper，避免用户装 Xcode CLI Tools。

**在 Windows 上不能可靠地打 macOS 包**：`.app` 的 Info.plist、签名、公证、TCC 权限都依赖 macOS；
本仓库的 `desktop:package` 在非 Windows 平台会直接提示，不会伪造一个不能用的 `.app`。

### 4.4 数据目录

桌面版只写本机 userData：

| 平台 | 路径 |
|---|---|
| Windows | `%APPDATA%\字伴\` |
| macOS | `~/Library/Application Support/字伴/` |

里面有：

- `screen-config.json`：看屏幕开关、自动朗读、大模型配置（密钥用系统安全存储加密）；
- `ziban-cache/lookup-cache.json`：电脑讲解缓存（7 天，可清除）；
- `corpus/*.json`：本地语料库（可选）；
- `tmp/`：OCR 临时截图，识别后立即删除。

开发/测试可用 `ZIBAN_USER_DATA` 指向临时目录，避免污染真实配置：

```powershell
$env:ZIBAN_USER_DATA = "$env:TEMP\ziban-test"
pnpm desktop:start
```

## 5. 使用说明（老人场景）

### 5.1 看屏幕上的字

1. 首页点 **“开始看屏幕”**；
2. 切到要看的软件；
3. 鼠标停在字上约半秒；
4. 小窗出现：
   - 大字：词或字
   - 拼音（有就显示）
   - “什么意思”：一句口语解释
   - “例句”：一句生活例句
   - 来源：本机字卡 / 本机词表 / 语料库 / 电脑生成
   - 风险提示（验证码、转账、链接等）
5. 点右上角“念”重念；点例句旁“听”只听例句；点 `×` 收起。

如果小窗说“这里没看清字”：

- 把鼠标放到字上，停一下再按 `Ctrl+Shift+Z`；
- 或检查屏幕是否锁着/黑着；
- Windows 检查中文 OCR 语言包。

### 5.2 每天三个字

- 首页第二张卡：每天 3 张新卡 + 最多 3 张到期复习；
- 进入卡片自动念“词 + 释义”；
- 点单字只念这个字；点释义/例句/图片分别朗读；
- 不记对错、不考试、不催；完成后可以“再认三个”。

### 5.3 看图找字 / 粘贴文字 / 设置

- **看图找字**：按看病、取钱、出门等场景筛选，点图片听词；
- **帮我看屏幕**：把短信/通知/网页文字粘贴到框里，逐句念、用大白话讲、提示风险；
- **设置**：语速、声音、拼音、字号、屏幕取词、清除记录、云端声音；
- “家人设置：电脑讲解”里可以配置大模型（默认关闭）；
- “云端声音（可选）”里可以填自己的 TTS API Key（默认关闭；桌面/网页都可用，网页需 CORS，见 [docs/12](12-cloud-tts.md)）。

### 5.4 云端声音（可选，文字转语音）

默认用系统自带中文语音。想让朗读更像真人，可以在 **设置 → 云端声音（可选）** 填：

- 服务：OpenAI 兼容 `/audio/speech`，或阿里云百炼 **Qwen-TTS**；
- 网址：OpenAI 填 `https://api.openai.com/v1`；Qwen 默认 `https://dashscope.aliyuncs.com/api/v1`（北京）；
- 模型：OpenAI 如 `tts-1`；Qwen 如 `qwen3-tts-flash`；
- 音色：OpenAI 如 `alloy`；Qwen 如 `Cherry`；
- 密钥：桌面版只在主进程使用（Windows DPAPI / macOS Keychain 加密）；网页版按用户要求存当前浏览器 `localStorage`；
- 保存后点“打开”；打开后，字卡、例句、屏幕讲解的朗读都会走云端。

注意：

- 默认关闭，关着时一个请求都不发；
- 打开后会把当前要念的**文字**发到用户填的服务，按服务商计费；不发截图/整屏/学习记录；
- 音频不落盘；失败只提示，不自动重试；
- 屏幕取词的自动念也会走云端，不想让屏幕文字离开电脑就不要打开；
- 网页演示版也能用：Key 按用户要求存在当前浏览器 `localStorage`，请求直接从浏览器发到服务商；
  服务必须允许 CORS（百炼实测允许），Key 可被同源脚本读取，公共电脑不要保存，详见 docs/12。

详见 [docs/12-cloud-tts.md](12-cloud-tts.md)。

### 5.5 版本更新提示

- 桌面版启动 3 秒后，主进程只读 GitHub 公共版本信息；有新版本会在首页出现一条提示；
- 点“去 GitHub 看看”打开 Releases 页面；**不会自动下载、不会自动安装**；
- “设置 → 版本”可以关闭自动检查，或手动点“检查更新”；
- 24 小时内不重复请求；失败静默，不弹错误框；
- 完全关闭：设环境变量 `ZIBAN_DISABLE_UPDATE_CHECK=1`。

## 6. 可选：接入大模型

默认不联网。默认例外只有启动后的 GitHub 版本检查（只读公共信息、可在“设置 → 版本”关闭）；大模型和云端 TTS 只有家人主动配置并打开后才会请求。

设置 → 看屏幕上的字 → 家人设置：电脑讲解：

- 网址：OpenAI 兼容 `/v1`，例如 `https://api.deepseek.com/v1`；
- 模型名：例如 `deepseek-chat`；
- 密钥：只在主进程使用；Windows DPAPI / macOS Keychain 加密；
- “把光标所在的那一行也发过去”：默认关闭，勾选后才会发当前行；不发截图、不发整屏；
- 缓存 7 天、最多 400 条；可一键清除；
- 生成内容标“电脑生成 · 不一定对”，不覆盖本机字卡释义。

> 不要把 API Key 写进仓库、README、issue 或聊天记录。

## 7. 可选：本地语料库 / 爬虫

仓库已带第一批 **293 条实验语料**（7 个文件，`source=auto-*`，**机器审校草稿，未人工审校**）。
它不会自动进入安装包；需要显式安装：

```bash
pnpm corpus:install                 # 复制 7 个文件到真实 userData
pnpm corpus:install -- --dry-run    # 只看路径
```

路径：`<userData>/corpus/*.json`（Windows `%APPDATA%\字伴\corpus`；
macOS `~/Library/Application Support/字伴/corpus`），格式见
[schema/corpus.schema.json](../schema/corpus.schema.json)，说明见
[docs/10](10-corpus-handoff.md)。

- 词条变更自动热加载（防抖 500ms）；
- 优先级：字卡 > 语料库 > 本机词表 > 大模型补缺；
- 爬虫只负责写本地 JSON，字伴不联网抓取；
- 每条必须有 `word`、`definition`，最好有 `source`/`license`；
- 小窗会显示“机器审校 · … · 不一定对”，不要对外称人工审校；
- 屏幕语料**没有图片字段**，不需要为新语料画 SVG；只有新增字卡才需要。

## 8. 自检与排错

```bash
pnpm check                    # 内容门禁 + 语料 lint + 类型 + 64 测试 + Web 构建 + GitHub 检查
pnpm desktop:build            # 桌面构建
pnpm desktop:package          # Windows 绿色版（release/ziban-win32-x64）
pnpm desktop:ocr-smoke        # OCR 测试图 + “暖”→“暖和”整词断言
pnpm desktop:lookup-smoke     # 真实截屏 + 取词
pnpm desktop:hover-smoke      # 光标跟随 + 小窗
pnpm desktop:ui-smoke         # 只渲染小窗
```

| 现象 | 处理 |
|---|---|
| `protocol is undefined` | 用 `pnpm desktop:start`，不要 `electron .` |
| 主窗口空白 | 先 `pnpm desktop:build`；确认 `apps/web/dist/index.html` 存在 |
| 看屏幕没反应 | 首页点“开始看屏幕”；检查托盘/设置状态 |
| 提示“屏幕锁着” | 解锁屏幕、点亮显示器 |
| Windows 认不出中文 | 安装中文 OCR 语言包；跑 `desktop:ocr-smoke` |
| macOS 提示需要 Xcode | `xcode-select --install`，再重开字伴 |
| macOS 授权后仍无画面 | 关掉字伴再开；检查“屏幕录制”里是否勾选当前 App |
| 小窗挡住内容 | 会自动翻转；`×` 收起，鼠标不动不再弹 |
| 大模型 401/404 | 检查网址、模型名、密钥；本机 http 只允许 127.0.0.1/localhost |
| 网页版想看别的软件 | 浏览器做不到；用电脑版，或先粘贴文字 |

## 9. 部署检查清单

- [ ] `pnpm install --frozen-lockfile` 通过
- [ ] `pnpm check` 通过
- [ ] 网页：`pnpm build`，`apps/web/dist` 可访问；Pages Source 为 GitHub Actions
- [ ] 桌面：`pnpm desktop:build`，`pnpm desktop:start` 能打开
- [ ] Windows：`desktop:ocr-smoke` 通过；屏幕取词实测
- [ ] macOS：Xcode CLI Tools、屏幕录制权限、Vision helper 编译、Retina/双屏实测
- [ ] 云端 TTS（可选）：默认关闭；只在本机用户同意后填 Key，真实服务试听一次，确认不落盘、不泄露 Key
- [ ] 没有把 `screen-config.json`、截图、密钥提交进仓库
- [ ] 更新了 `CHANGELOG.md` 与相关文档

## 10. 相关文档

- [README](../README.md)：项目介绍与快速开始
- [docs/05](05-experimental-v0.1.md)：v0.1 Web 能力边界
- [docs/07](07-handoff.md)：交接快照、架构、已知问题
- [docs/08](08-screen-lookup.md)：屏幕取词实现、macOS 权限、语料库格式
- [docs/10](10-corpus-handoff.md)：语料库制作、AI 提示词、验收
- [docs/12](12-cloud-tts.md)：云端文本转语音、API Key、隐私与验收
- [PRIVACY.md](../PRIVACY.md)、[SECURITY.md](../SECURITY.md)：数据与安全
