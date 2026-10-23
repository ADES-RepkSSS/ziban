# 06 · 挂到 GitHub 与社区化

> 这份文档解决三件事：**怎么把仓库推上去**、**仓库主页怎么填**、**开源协议和社区怎么设**。
> 所有命令按 Windows PowerShell 写；macOS/Linux 只差路径。
>
> 本文以 `ADES-RepkSSS/ziban` 为例。如果你换仓库名，把下面所有 `ziban` 和 Pages 地址相应替换。

## 0. 已经替你准备好的文件

| 文件 | 作用 |
|---|---|
| `README.md` | 仓库首页：定位、截图、功能、快速开始、路线图、许可 |
| `LICENSE` / `NOTICE` | 代码 Apache-2.0；第三方依赖说明 |
| `content/LICENSE.md` | 词表/释义/例句/手绘配图 CC BY-SA 4.0 |
| `CONTRIBUTING.md` | 开发、内容、老人测试伦理、DCO、PR 流程 |
| `CODE_OF_CONDUCT.md` | 行为准则（含隐私与测试伦理） |
| `SECURITY.md` | 私密漏洞报告、范围、响应 |
| `PRIVACY.md` | 不建账号、不统计、本地存储、剪贴板/网络说明 |
| `GOVERNANCE.md` | 角色、决策、发布、资金、维护者更替 |
| `CHANGELOG.md` | 版本记录 |
| `.github/workflows/ci.yml` | push/PR：内容门禁 + 类型 + 测试 + 构建 |
| `.github/workflows/pages.yml` | 自动把 Web 版部署到 GitHub Pages |
| `.github/dependabot.yml` | 每周依赖与 Actions 更新 |
| `.github/ISSUE_TEMPLATE/*` | 问题、功能、老人观察、内容纠错四个模板 |
| `.github/pull_request_template.md` | PR 检查清单（含安全/无障碍/DCO） |
| `docs/assets/social-preview.png` | 1280×640 社交预览图，上传到仓库 Settings |
| `docs/assets/*.png` | README 用的稳定截图（`screenshots/` 本身被 gitignore） |
| `.gitattributes` / `.editorconfig` / `.nvmrc` | 换行、编码、Node 版本 |

**还没有替你做的事**：没有 `git init`、没有建远程仓库、没有 push。原因是你需要用自己的 GitHub 身份和仓库名，避免把提交历史绑到错误的账号。

## 1. 建仓前 5 分钟检查

在 `D:\haness_agent\help_old` 打开 PowerShell：

```powershell
# 1) 确认没有 node_modules / dist / screenshots 被误加
git init -b main
git add .
git status

# 2) 看将要提交的文件数量与体积
git diff --cached --stat
```

你应该看到：

- ✅ `apps/`、`packages/`、`content/`、`docs/`、`scripts/`、`tools/`、根目录的 md/json/yml；
- ✅ `content/images/*.svg`、`apps/web/public/images/*.svg`；
- ✅ `pnpm-lock.yaml`、`LICENSE`、`NOTICE`、`.github/`；
- ❌ 不应出现 `node_modules/`、`apps/web/dist/`、`screenshots/`、`tools/output/`、`.env`。

如果看到了不该提交的：

```powershell
git rm -r --cached node_modules apps/web/dist screenshots tools/output
```

再检查一遍：

```powershell
git status --ignored
```

### 个人信息/密钥

```powershell
# 看已暂存内容里有没有可能的密钥（没有输出最好）
git diff --cached | Select-String -Pattern "api[_-]?key|secret|token|password|BEGIN (RSA|OPENSSH) PRIVATE KEY"
```

不要提交：GitHub token、OpenAI key、真实老人姓名/电话/住址/病历、银行截图、身份证照片。

## 2. 把代码推上 GitHub

先设置提交身份（只需一次）：

```powershell
git config --global user.name "你的名字"
git config --global user.email "你的 GitHub 邮箱"
```

如果不想公开真实邮箱，用 GitHub 提供的 `ID+username@users.noreply.github.com`。

### 方式 A：GitHub CLI（推荐，少踩坑）

```powershell
# 安装（已装可跳过）
winget install --id GitHub.cli

# 登录：选 GitHub.com → HTTPS → Login with a web browser
gh auth login

# 在项目根目录
cd D:\haness_agent\help_old
git init -b main
git add .
git commit -s -m "feat: 字伴 v0.1 实验版（Web）"

# 建一个公开空仓库，并把当前目录推上去
gh repo create ziban --public --source=. --remote=origin --push `
  --description "从帮不识字的老人看懂屏幕开始：鼠标停在哪，字伴就念哪。长期探索“先使用、后识字”，让孩子在探索互联网时主动查字。公益开源、离线优先、无广告、无账号。"
```

`gh repo create` 如果提示仓库名已存在，换一个名字（如 `ziban-app`、`ziban-elderly`）。

### 方式 B：网页建空仓库 + git push

1. 打开 <https://github.com/new>；
2. Repository name 填 `ziban`；
3. 选 **Public**；
4. **不要**勾 “Add a README file / .gitignore / license”（本地已经有了）；
5. Create repository；
6. 回到 PowerShell：

```powershell
cd D:\haness_agent\help_old
git init -b main
git add .
git commit -s -m "feat: 字伴 v0.1 实验版（Web）"
git remote add origin https://github.com/ADES-RepkSSS/ziban.git
git push -u origin main
```

### 认证

- **HTTPS**：push 时弹窗登录，或使用 Git Credential Manager；PAT 只勾选该仓库的 Contents 读写，不要用 classic token 全权限。
- **SSH**：`ssh-keygen -t ed25519 -C "you@example.com"`，把 `~/.ssh/id_ed25519.pub` 加到 GitHub → Settings → SSH keys，然后把 remote 换成 `git@github.com:ADES-RepkSSS/ziban.git`。
- Token 不要贴在 issue、README、聊天记录里；泄露后立刻 revoke。

## 3. 把仓库主页填好

进入仓库首页，点右侧 **About** 旁边的齿轮：

### Description（简介，直接复制）

```text
从帮不识字的老人看懂屏幕开始：鼠标停在哪，字伴就念哪。长期探索“先使用、后识字”，让孩子在探索互联网时主动查字。公益开源、离线优先、无广告、无账号。
```

> 仓库 About 的 description 有长度限制；这段约 70 个汉字，适合直接粘贴。

### 短版（发群 / 申请公益项目用）

```text
字伴把查字典简化成“停一下”：鼠标停在屏幕上的字，就念读音、讲意思、给例句。它最初服务不识字的老人，长期想验证“先使用、后识字”的儿童场景——让探索互联网的内驱力带着孩子主动认字。开源、离线优先、无广告。当前 Windows 桌面取词已实测，macOS 待真机；儿童场景是方向，不是已验证的儿童产品。
```

### 给合作机构的一句话

```text
字伴用“光标停一下就能查字”降低低识字老人使用电脑和办事的门槛；长期探索“先使用、后识字”的儿童识字范式。代码 Apache-2.0、内容 CC BY-SA 4.0，可被学校、社区和公益机构自由采用。
```

### English one-liner

```text
Ziban is an open-source, offline-first companion that helps elderly Chinese users with low literacy read, learn and understand screens through pictures, speech and plain-language explanations.
```

### Website

部署完 GitHub Pages 后填：

```text
https://ades-repksss.github.io/ziban/
```

### Topics（直接复制，逗号分隔）

```text
chinese, elderly, accessibility, a11y, literacy, text-to-speech, offline-first, react, typescript, electron, public-interest, education, assistive-technology
```

### Social preview

Settings → General → **Social preview** → Upload an image：

```text
docs/assets/social-preview.png
```

## 4. 开 GitHub Pages（免费演示站）

1. 先把代码 push 到 `main`；
2. 仓库 **Settings → Pages**；
3. **Build and deployment → Source** 选 **GitHub Actions**；
4. 打开 **Actions**，等 `Deploy web demo to GitHub Pages` 变绿；
5. 地址形如 `https://ades-repksss.github.io/ziban/`；
6. 把它填回 About 的 Website。

说明：

- 工作流已经写好：`pnpm build` → 上传 `apps/web/dist` → deploy-pages；
- Vite 使用 `base: './'` + hash 路由，放在 `/ziban/` 子路径下也能用；
- 私有仓库用 Pages 需要 GitHub Pro/公开仓库；公开仓库免费；
- 首次部署后如果 404，等 1–2 分钟或看 Actions 日志；确认 Pages Source 是 “GitHub Actions” 而不是 “Deploy from a branch”。

## 5. 第一次 Release

```powershell
git tag -a v0.1.0 -m "v0.1.0 experimental web release"
git push origin v0.1.0
```

然后 GitHub → Releases → **Draft a new release**：

- Tag：`v0.1.0`
- Title：`v0.1.0 实验版：50 张识字卡 + 粘贴文字朗读`
- 说明可直接从 [CHANGELOG.md](../CHANGELOG.md) 复制 0.1.0 段；
- 勾选 “Set as the latest release”；
- **不要**把未审校内容说成“正式版”。

## 6. 社区化设置（建仓当天就能做）

### 6.1 Features

Settings → General → Features：

- ✅ Issues
- ✅ Discussions
- ✅ Projects（可选）
- ❌ Wiki（文档已经在 `docs/`，避免两份真相）

### 6.2 分支保护

Settings → Branches → Add branch protection rule：

- Branch name pattern：`main`
- ✅ Require a pull request before merging（至少 1 个 approval）
- ✅ Require status checks to pass：选 `content / types / tests / build`
- ✅ Require conversation resolution
- ✅ Do not allow bypassing（如果只有你一个人，可先不勾，等有维护者再开）
- ✅ Require linear history（可选）

### 6.3 安全

Settings → Code security and analysis：

- ✅ Private vulnerability reporting（对应 SECURITY.md）
- ✅ Dependabot alerts
- ✅ Dependabot security updates
- ✅ Secret scanning / Push protection（公开仓库一般免费）

### 6.4 Discussions 分类建议

- 📢 公告
- 🙋 使用反馈（老人/子女）
- 🧠 内容讨论（释义、词表、图片）
- 🛠 开发
- 🧪 测试招募
- 💡 想法

### 6.5 Labels 建议先建

| Label | 用途 |
|---|---|
| `good first issue` | 新人第一单 |
| `help wanted` | 明确缺人 |
| `bug` | 功能坏了 |
| `content` | 词表/释义/图片/文章 |
| `accessibility` | 大字、对比度、键盘、屏幕阅读器 |
| `elderly-test` | 老人观察/测试 |
| `needs-triage` | 待维护者看 |
| `security` | 安全（细节走私密） |
| `dependencies` | Dependabot |
| `docs` | 文档 |

### 6.6 建仓后先开这 8 个 issue

不要用“欢迎贡献”当第一屏；给具体任务。

1. `good first issue` 补一张 Windows 启动图文教程（含 `pnpm install` 失败怎么办）
2. `content` 审校 50 张卡片的释义与例句（每条带来源/理由）
3. `elderly-test` 找 3 位老人做“第一次查字”无指导测试
4. `accessibility` 跑 axe-core + 对比度 + 1024×768 检查，列出 critical
5. `help wanted` macOS 真机验收：屏幕录制 TCC、Retina 坐标、全屏/双屏；预编译 Vision helper
6. `help wanted` sherpa-onnx 中文 VITS spike：音质、逐字对齐、安装包体积
7. `docs` 给 README 补 GitHub Pages 演示地址与 CI badge
8. `good first issue` 写英文 README（只翻译定位/运行/许可，不翻译全部内容）

### 6.7 维护者与 CODEOWNERS

- 至少 2 名维护者后再加 `.github/CODEOWNERS`；
- 每个模块至少 2 个 owner（对应 docs/04 的 R6 单人维护风险）；
- 维护者名单写进 `GOVERNANCE.md` 或 `MAINTAINERS.md`；
- 连续 3 个月不活跃转荣誉维护者。

## 7. 开源协议怎么选

### 7.1 代码：推荐 Apache-2.0（当前已用）

| 协议 | 适合 | 代价 |
|---|---|---|
| **MIT** | 想最大范围被采用、最少解释成本 | 没有明确专利授权；大公司仍可能用 |
| **Apache-2.0** ✅ | 公益项目、希望学校/公司/基金会都能用；有专利授权与 NOTICE | 比 MIT 多一点合规动作（保留 NOTICE、标注修改） |
| **MPL-2.0** | 想“文件级 copyleft”，允许闭源组合 | JS 构建产物边界不直观，社区理解成本高 |
| **GPL-3.0** | 强烈希望衍生作品继续开源 | 很多公司/集成方会直接避开；对 web 分发约束有限 |
| **AGPL-3.0** | SaaS 也必须开源 | 本项目是本地应用，用不上；会显著缩小贡献者池 |

**结论：保持 Apache-2.0。** 它和“公益、可被机构采用、防止专利流氓”的目标最匹配；MIT 也可接受，但没必要为了少 200 字放弃专利条款。

### 7.2 内容：推荐 CC BY-SA 4.0（当前已用）

- 词表、释义、例句、手绘配图：**CC BY-SA 4.0**；
- 原因：与中文维基词典/CC-CEDICT 兼容；要求署名 + 相同方式共享，防止被闭源内容商白嫖；
- 如果你更想“随便用”，可改 **CC BY 4.0**；如果想让内容进入公共领域，用 **CC0**。但公益内容库建议保留 SA。
- 图片若来自 ARASAAC 等 **NC** 来源：不能进主仓库，单独资源包 + 用户首次启动确认下载（见 docs/02）。

### 7.3 模型/语音

- 代码协议不覆盖模型权重；
- 接入 sherpa-onnx / VITS 前，逐个确认模型许可证与商用/再分发条款；
- 许可不明或 NC 的模型：**不进主仓库**，放独立 release，首启由用户确认下载；
- 在 `NOTICE` / `models/README.md` 记录来源、版本、许可、SHA256。

### 7.4 贡献者协议：DCO，不用 CLA

- 要求 `git commit -s`，即 Developer Certificate of Origin 1.1；
- Apache-2.0 第 5 条已经覆盖“贡献按本许可授权”，不需要另签 CLA；
- CLA 会劝退志愿者，尤其非程序员内容贡献者；
- 内容贡献在 PR 模板里确认可按 CC BY-SA 4.0 分发；
- 可在 GitHub Marketplace 启用 DCO 检查 App；不装 App 时由维护者检查 PR 里的 `Signed-off-by`。

### 7.5 商标

Apache-2.0 **不授予**项目名称/Logo 的商标权。社区变大后建议加 `TRADEMARKS.md`：允许“基于字伴的衍生作品”如实描述，不允许用“字伴官方”误导老人。现在不急。

## 8. 社区化不是挂个协议

协议只解决“能不能用”，社区解决“有没有人持续做”。最少做这五件：

1. **具体的第一单**：`good first issue` 要能在 1–3 小时内完成，且有人 48 小时内回复。
2. **固定节奏**：每两周一次 triage；每月一次 release/开发日志；不要让 PR 挂两个月。
3. **非程序员入口**：内容审校、老人测试、文档、翻译；不要只写“欢迎开发者”。
4. **公开决策**：路线图、三原则变更走 RFC；不要只在私聊里定。
5. **双 owner**：每个模块至少两人能合并/救火；这是 docs/04 里 R6 的唯一缓解。

### 首批招募文案（可直接发）

```text
字伴是一个开源、离线优先的中文识字助手：把查字典简化成“停一下”。当前从老人场景开始——鼠标停在屏幕上的字，小窗就念读音、讲意思、给例句；长期想验证“先使用、后识字”的儿童场景。
现在 v0.1 Web + 0.2 桌面取词刚开源，最缺：
1) 中文老师/编辑帮审 50 张卡片的释义（每条要有来源）；
2) 家里有 65–85 岁、识字量低的老人，帮做 20 分钟无指导试用；
3) macOS 真机验收（屏幕录制权限/Vision）与 sherpa-onnx 语音接入；
4) 帮设计“有家长同意、不收集孩子个人信息”的儿童识字观察方案（暂不直接招儿童测试）。
不需要会写代码也能帮。仓库：<链接>
```

## 9. 发布前 checklist

- [ ] `pnpm check` 通过
- [ ] `git status` 没有 `node_modules` / `dist` / `screenshots` / `tools/output` / `.env`
- [ ] README 截图路径存在（`docs/assets/*.png`）
- [ ] LICENSE / NOTICE / 内容许可齐全
- [ ] CI 绿；Pages 部署绿
- [ ] About 简介、Topics、Website、Social preview 填好
- [ ] Private vulnerability reporting 开启
- [ ] Discussions / Issues 模板生效
- [ ] 第一版 Release notes 明确写“实验版、内容 draft”
- [ ] 没有把老人个人信息、密钥、真实诈骗链接提交进去

## 10. 当前配置

已经按你的 GitHub 用户名填好：

- 仓库：`ADES-RepkSSS/ziban`
- README clone 地址、CI badge、Pages 演示链接
- `package.json` 的 `repository` / `homepage` / `bugs`
- 本文的命令与 Pages 地址

**还需要你在 GitHub 网页上做**：创建空仓库 → push → Settings → Pages 选 GitHub Actions → 建 `v0.1.0` release。

如果你最后用了别的仓库名（例如 `ziban-app`），把 README、`package.json` 和本文里的 `ziban` / Pages 地址一起替换。
