# 语料来源与许可

> 本批是**机器审校草稿**。来源类型、证据强度、许可都写在下面，便于审计和回滚。

## 1. 来源类型：self（项目组自写口语解释）

- 释义与例句由项目组（含 AI 编辑）用日常口语写成，**没有抄词典、百科、论坛、公众号原文**；
  不保留任何论坛/贴吧/知乎文本，也不使用真实聊天记录或屏幕截图。
- 目标词来自“屏幕场景词表”登记：医院叫号屏/自助机、银行网点/手机银行、政务大厅/办事指南、
  手机设置/微信、公交地铁站牌、反诈宣传页、购物订单页。
- `source_ref` 指向这批登记（`self-screen-inventory-2026-11#<theme>`），**不是**逐条截图证据。
  也就是说：词“会出现在屏幕上”目前是编辑判断，需要真人用真机复核后才能当事实。

## 2. 来源类型与可用性（对照交接手册第 3 节）

| 类型 | 本批是否使用 | 说明 |
|---|---|---|
| self | 是 | 项目组自写；标 self，保留评审记录 |
| dict | 否 | 没有抄 CC-CEDICT/维基词典文本 |
| gov / official_faq | 否 | 没有整段引用官方 FAQ；事实性表述保持最保守 |
| volunteer_cc0 | 否 | — |
| forum | 否 | 只作为“老人会在哪卡住”的方向，不保留原文 |

## 3. 许可

- 本目录文本：CC-BY-SA-4.0（与仓库 `content/` 一致）。
- `corpus/chars/common2000.txt`：Jun Da《Modern Chinese Character Frequency List》排序，
  只保留《现代汉语常用字表》2500 字后取前 2000；字表本身是事实性字符清单，使用时保留出处。
- 不含第三方图片、语音权重、词典文本。

## 4. source_ref 索引

| 主题 | source_ref | 运行时 source |
|---|---|---|
| hospital | self-screen-inventory-2026-11#hospital | auto-hospital-2026-11 |
| bank | self-screen-inventory-2026-11#bank | auto-bank-2026-11 |
| gov | self-screen-inventory-2026-11#gov | auto-gov-2026-11 |
| phone | self-screen-inventory-2026-11#phone | auto-phone-2026-11 |
| transit | self-screen-inventory-2026-11#transit | auto-transit-2026-11 |
| fraud | self-screen-inventory-2026-11#fraud | auto-fraud-2026-11 |
| shopping | self-screen-inventory-2026-11#shopping | auto-shopping-2026-11 |

## 5. AI 参与与评审强度

- 生成：AI 编辑按附录 A 提示词产出 3 稿中的 1 稿（本批为单稿 + 人工式重读修正）。
- 评审：Judge A/B 由子代理按两份 rubric 独立打分；R1 另加三审；确定性硬 lint 兜底。
- **没有人工审校**，也没有老人测试。评审结论只代表“机器没发现明显问题”，不代表内容正确。
- 风险词（验证码/转账/冻结/退款/中奖/密码/链接/客服/汇款/投资/高息/屏幕共享/远程控制等）
  只解释“是什么”，例句带“别/不要/先问”提醒；发布前仍需人工逐条看。

## 6. 发布前必须补的

1. 真人用真机核对每条词确实出现在对应屏幕/单据上（补截图或界面文案，替换现在的 scene 登记）。
2. 医疗/金融/政务/防骗四类 R1 词 100% 人工复核；建议再抽 10 条给真实老人读。
3. 给 `source_ref` 补更细的批次/文档标识；不要写成“网上”。
