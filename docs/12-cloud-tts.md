# 12 · 云端文本转语音（TTS）

> 状态：可选实验功能。默认关闭，继续用操作系统自带的中文语音。
> 只有用户自己填 API Key、打开开关并保存后，字伴才会把“要念的文字”发到云端。
> 这是**文字转语音**，不是语音转文字；也不做声音克隆。

## 1. 用户看到什么

设置页多一块 **“云端声音（可选）”**：

- 默认关着；关着时一个请求都不发；
- 打开后，字卡朗读、例句、屏幕讲解的“念”都改用云端声音；
- 音色由服务商的 `voice` 参数决定；系统声音设置只在关掉云端后生效；
- 没网、密钥错、额度用完时，会显示一句人话，不会反复重试轰炸用户；
- 目前**不自动回退**到本机声音；用户可以随时关掉云端，继续用本机声音。

**桌面版和网页演示版都支持**：

- 桌面版：Key 存主进程，`safeStorage` 可用时加密，渲染层只看到 `hasApiKey`；
- 网页版：没有主进程，Key 按用户要求保存在当前浏览器的 `localStorage`，请求从浏览器直接发到服务商；
  这要求服务商允许浏览器跨域（CORS），且 Key 不是“系统级安全保存”，详见下面的风险说明。

## 2. 安全与隐私

| 项 | 做法 |
|---|---|
| API Key（桌面版） | 只存主进程；`safeStorage` 可用时加密，渲染层只看到 `hasApiKey` |
| API Key（网页版） | 用户明确保存后存当前浏览器 `localStorage`；不上传到字伴服务器，但页面脚本可读 |
| 默认状态 | 桌面 `tts.enabled=false`、网页 `enabled=false`；没打开时不发请求 |
| 发什么 | 只发当前要念的文字（词、释义、例句、屏幕讲解文本） |
| 不发什么 | 不发截图、整屏、学习记录、设备标识；桌面版不回传 Key |
| 音频 | 只交给播放器；不写磁盘、不进缓存 |
| 浏览器 CORS | 网页版直接 `fetch` 服务商；服务必须允许 `Origin`、`Authorization`、`Content-Type` |
| 计费 | 由用户自己的服务商账户计费；字伴不代付、不代理 |

开启后，屏幕取词自动念“词 + 解释”时，这段文字也会发到 TTS 服务；这是“云端声音”开关的一部分，设置页已写明。
如果不想让屏幕文字离开电脑，就不要打开云端声音。

## 3. 兼容接口

按 OpenAI 的语音合成接口实现：

```http
POST {endpoint}/audio/speech
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "model": "tts-1",
  "input": "要念的中文",
  "voice": "alloy",
  "response_format": "mp3"
}
```

设置里的“网址”填 `/v1` 结尾的 base URL，例如：

```text
https://api.openai.com/v1
```

桌面主进程或网页都会补成 `/v1/audio/speech`；如果填的已经是完整 `/audio/speech` 路径，不会重复拼接。
为了安全，只接受 `https://`；本机模型可用 `http://127.0.0.1` 或 `http://localhost`。
服务必须返回 `audio/*` 内容；当前按 `mp3` 请求，但播放器也接受服务返回的 wav/ogg（取决于 Chromium 解码支持）。

网页版还必须满足浏览器 CORS：

- 服务返回 `Access-Control-Allow-Origin`（或允许当前演示站域名）；
- 预检 `OPTIONS` 允许 `Authorization` 和 `Content-Type`；
- 不能用公共 CORS 代理：代理会看到 `Authorization: Bearer`，等于泄露 Key。

如果服务不支持 CORS，浏览器会报 `Failed to fetch`；字伴会提示“换支持 CORS 的服务或用电脑版”。
OpenAI 官方接口在浏览器里可能被 CORS 拦住，实际以服务商策略为准。

> 不同兼容服务对 `model`、`voice`、`response_format` 的支持不一样；以服务商文档为准。
> 字伴不内置任何服务商密钥，也不会替用户选择服务商。

## 4. 配置步骤

1. 打开 **设置 → 云端声音（可选）**；
2. 展开“家里人设置：云端语音接口和密钥”；
3. 填网址、模型、音色、API Key；
4. 点 **保存**（保存接口和密钥）；
5. 点上面的 **打开**（立即生效，不需要再保存）；
6. 去“帮我看屏幕”粘贴一句话，点“念给我听”试听。

如果密钥不能安全保存（桌面 `keyStorage=memory-only`），关掉字伴后要重填；公用电脑不要打开。

网页版额外注意：

- Key 明文存在这个浏览器的 `localStorage`；同源脚本、浏览器扩展、共用电脑的人都可能读到；
- 只建议用**低额度、可随时吊销**的 Key；不要用主账号 Key；
- 清除浏览器站点数据会一起清掉 Key；
- 如果服务不允许 CORS，网页版无法直连；不要为了绕过限制把 Key 交给公共代理。

## 5. 代码位置

```text
apps/desktop/electron/capabilities/speech/tts.ts   主进程请求、超时、错误映射、端点校验
apps/desktop/electron/capabilities/knowledge/config.ts  密钥加密/公开配置/更新校验
apps/desktop/electron/preload.ts                  synthesizeSpeech 白名单
apps/desktop/electron/main.ts                     IPC + runtime.synthesizeSpeech
apps/web/src/capabilities/speech/cloudSpeech.ts   渲染层 <audio> 播放（不存音频）
apps/web/src/capabilities/speech/webCloudTts.ts   网页版 localStorage 配置 + 浏览器 fetch/CORS
apps/web/src/app/SpeechProvider.tsx               根据桌面配置或网页 localStorage 切换 system/cloud 引擎
apps/web/src/features/speech/CloudSpeechSettingsSection.tsx  设置 UI
packages/core/src/desktop.ts                      公共配置与 CloudSpeechResult 类型
```

数据流：

```text
桌面版：
用户点“念” → SpeechProvider 选云端引擎 → preload.synthesizeSpeech(text)
  → 主进程读取加密 Key，POST /audio/speech → 返回 audio 字节
  → 渲染层 Blob URL → <audio> 播放 → 不落盘

网页版：
用户点“念” → SpeechProvider 读 localStorage 配置 → 浏览器直接 POST /audio/speech
  → 服务返回 audio（需 CORS）→ Blob URL → <audio> 播放 → 不落盘
```

## 6. 边界与已知限制

- **不是流式**：整段合成完才播放；长段会先等一会儿。当前每段通常只有几十字。
- **没有声音列表**：音色是手填的服务商参数，不做试听列表；试听请用“念给我听”。
- **没有自动回退**：云端失败就提示，用户可关掉云端；不会在失败后偷偷改用本机声音。
- **没有重试风暴**：单次请求 45 秒超时；失败后由用户再点，不自动轮询。
- **不做声音克隆**：不提供“上传自己的声音”功能，也不保存音频。
- **不做语音转文字**：本功能只从文字到语音；录音/识别是另一个能力。
- **系统声音列表不变**：设置页仍显示系统中文声音，但云端打开时系统声音不生效。
- **网页版受 CORS 限制**：服务不允许浏览器跨域时无法播放；这不是字伴能绕过的浏览器安全边界。
- **网页版 Key 不是安全存储**：`localStorage` 明文，XSS/扩展/共用电脑都可能读取；桌面版更安全。

## 7. 验收清单

- [x] `pnpm typecheck` 通过
- [x] `pnpm test` 67 个测试通过（新增 3 个端点校验测试）
- [x] `pnpm desktop:build` 通过
- [x] 桌面版本地 mock `/v1/audio/speech` 端到端：配置保存 → 设置切换 → 点“念给我听” → 请求带 `Bearer`、文本、模型、音色 → 返回音频并播放
- [x] 网页版 CORS mock 端到端：设置页保存 localStorage → 打开 → 浏览器直接请求 → 带 `Origin`/`Bearer` → 音频播放
- [ ] 用真实服务商 Key 试听一次（涉及计费，需用户自己提供 Key；并确认服务允许 CORS）
- [ ] 真人/老人试听云端音色（未做）

## 8. 相关文档

- [docs/09 部署与使用](09-deploy-and-use.md)
- [PRIVACY.md](../PRIVACY.md)
- [SECURITY.md](../SECURITY.md)
- [docs/07 交接](07-handoff.md)
