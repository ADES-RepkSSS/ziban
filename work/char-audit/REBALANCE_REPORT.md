# 550 词卡·单字频率与相似词重排（2026-11-01）

> 目标：降低“电/证/车/卡/费/号/机/票/药/站”头部拥挤，同时不再制造一批只出现 1 次的字；并删掉同结构、低学习价值的重复词。
> 结果：**550 张 → 550 张**；最高频字 **17 → 10**；只出现 1 次的字 **282 → 265**；2–4 次带 **186 → 194** 个字。

---

## 1. 数字对比

| 指标 | 重排前 | 重排后 | 变化 |
|---|---:|---:|---:|
| 卡片 | 550 | 550 | 0 |
| 不同单字 | 530 | 526 | −4 |
| 总出现次数 | 1224 | 1209 | −15 |
| 最高频字 | 电 17 | 药/费/卡/站/车/电/证/机/票 10 | **−7** |
| 只出现 1 次 | 282 (53.2%) | 265 (50.4%) | **−17** |
| 出现 2–4 次 | 186 | 194 | **+8** |
| 出现 ≥10 次 | 10 个字 | 9 个字 | −1 |

重排后 Top 10：

```text
药10 费10 卡10 站10 车10 电10 证10 机10 票10 号9
```

完整新基线已重新生成到 `work/char-stats/cards-550.{md,json,txt,csv}`；`docs/14` 的基线表和示例也同步更新。

## 2. 做了什么

### 2.1 删除 28 张（全部 level2，50 张基线 c_* 一张未动）

去重/缩写（14）：
`w_498 身份证号`、`w_144 取号机`、`w_178 检票`、`w_489 来电显示`、`w_293 来电`、`w_491 客服电话`、`w_137 网上银行`、`w_120 网银`、`w_190 网约车`、`w_186 动车`、`w_188 列车`、`w_262 断电`、`w_147 站点`、`w_431 收银`。

低价值/术语（11）：
`w_360 证明`、`w_380 换证`、`w_389 证件`、`w_369 优待证`、`w_331 充电宝`、`w_097 信用卡`、`w_098 储蓄卡`、`w_122 工资卡`、`w_101 年费`、`w_139 手续费`、`w_057 药水`。

同义/同结构（3）：
`w_124 回单`（并到凭条）、`w_088 流水`（并到明细）、`w_454 假冒`（并到冒充/虚假）。

> 删除的 28 张图已从 `content/images/` 删除（不是只从 YAML 删引用）；`content/images` 从 552 → 552（删 28、加 28，3 张替换复用原文件名）。

### 2.2 替换 3 张（防止“心/省/室”归零）

| id | 原词 | 新词 | 场景 | 理由 |
|---|---|---|---|---|
| `w_046` | 心电图 | **心脏** | health | 心电图的“心”是全库唯一载体；心脏更基础 |
| `w_321` | 省电 | **省钱** | money | 省电是设置项，省钱是老人日常；省字保留 |
| `w_203` | 候车室 | **卧室** | home | 候车室在“候车”之内；卧室补家场景缺口 |

### 2.3 新增 28 张

**健康/慢病（10）**：高血压、体温、护工、退烧、中医、血压计、假牙、手脚、牙科、眼科。
**日常动作（10）**：吃饭、散步、穿衣、起床、关灯、开窗、锁门、烧饭、拖地、擦窗。
**生活/办事（8）**：牙刷、养老院、买菜、路牌、打字、护照、声明、还钱。

选词规则（来自 `frequency-plan.md`）：
- 2 字词 Σ现有字频 ≤9 且每字 ≤6；3 字词 Σ≤12 且每字 ≤5；
- 任一字的现有频次 ≥7 不用；0 次字 ≥2 个不用；
- 冻结字：电、证、车、卡、费、号、机、票、药、站；
- 新词目标字全部在 common2000；优先复用现有字，但没有强求“零新字”（如 `脏`、`卧` 是本次新增的卡面字），整体 1 次字仍下降。

## 3. “假 X”怎么处理

审计确认当前 550 张里**没有**“假文件/假签证/假机票”这类按物件换字的系列。原有 6 个含“假”的词：

- 保留：`假币`（现金实物风险）、`假警察`（公检法/安全账户）、`假客服`（退款/理赔）、`假医生`（保健品/免费体检）、`虚假`（官方反诈话术）。
- 删除：`假冒`（与“冒充/虚假”重叠，且“冒”已由感冒/冒充承担）。

理由：四个“假+职业/物件”不是同结构换字，而是四套独立的骗局识别点；删它们会削弱安全场景。下一批若出现“假文件/假签证/假机票/假合同”这种同一骗局按物件拆卡，按 `similarity-plan.md` 4.3 的规则拒绝。

## 4. 产物与复现

```text
work/char-audit/
├─ REBALANCE_REPORT.md          ← 本文
├─ frequency-plan.md / .json    ← F1 频率审计（重排前）
├─ similarity-plan.md / .json   ← S1 相似词审计（重排前）
├─ integration-plan.md          ← E1 整合风险
├─ rebalance-data.json          ← 28 新增 + 3 替换 + 28 删除的完整数据
├─ rebalance-map.json           ← id/旧词/新词/动作 对照
├─ make-rebalance-data.mjs      ← 重新生成 rebalance-data
├─ apply-rebalance-yaml.mjs     ← 写回 level2.yaml（保留注释与顺序）
├─ generate-rebalance-images.py ← 生成 31 张新图（含 6 个新图标/props）
├─ validate-content-images.py   ← 550 张卡图 XML/尺寸/禁字检查
├─ remove-orphan-images.mjs     ← 删除被删卡的孤儿图
└─ new-images-3.png             ← 31 张新图抽检
```

复跑：

```powershell
# 1) 从备份恢复原 500 张 level2（仅重做时需要）
Copy-Item work/char-audit/backup/level2.yaml content/cards/level2.yaml -Force

# 2) 生成数据/写 YAML/生成图
node work/char-audit/make-rebalance-data.mjs
node work/char-audit/apply-rebalance-yaml.mjs
python work/char-audit/generate-rebalance-images.py
node work/char-audit/remove-orphan-images.mjs

# 3) 校验与重建
pnpm content:validate
pnpm content:build
pnpm cards:chars
node -e "const j=require('./work/char-stats/cards-550.json');const c=j.counts;console.log({cards:j.cards,unique:j.uniqueChars,total:j.totalOccurrences,once:c.filter(x=>x.count===1).length,two4:c.filter(x=>x.count>=2&&x.count<=4).length,max:c[0].count})"
```

## 5. 残余问题

- 1 次字仍有 265 个（50.4%）。这是 550 张、1209 个字次下的结构性结果；继续降需要再补“零新字”的日常词，但每补一个都会改变场景配额，需要单独评审。
- 场景分布变为：health 92 · money 70 · travel 61 · home 96 · contact 65 · gov 59 · shopping 54 · safety 53。没有代码断言，但 health/home 偏多、money/travel 偏少；下一轮若新增，优先 money/travel/safety。
- 新增图的语义以“图标+道具”为主，`养老院`（房子+爱心人）、`护照`（证件卡）、`声明`（文件+对勾）是近似表达，不是精细插画；已通过 `content:validate` 与 550 图 XML 检查，但没有人工审校。
- 所有卡仍是 `status: draft`；`gen.model` 标为 `deepseek-flash`、`prompt_ver: rebalance@1`，便于回溯。
