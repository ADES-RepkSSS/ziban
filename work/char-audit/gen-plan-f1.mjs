import fs from 'node:fs';

const rows = JSON.parse(fs.readFileSync('work/char-audit/cards-with-freq.json', 'utf8'));
const byId = new Map(rows.map((r) => [r.id, r]));
const freqOf = (list) => { const f = new Map(); for (const r of list) for (const ch of r.chars) f.set(ch, (f.get(ch) || 0) + 1); return f; };
const baseFreq = freqOf(rows);
const sorted0 = [...baseFreq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const YAML = (await import('yaml')).default;
const baselineIds = new Set(YAML.parse(fs.readFileSync('content/cards/level1.yaml', 'utf8')).map((c) => c.id));
if (baselineIds.size !== 50) throw new Error('level1.yaml should have 50 cards');

const R = {
  w_498: { phase: 'P1', reason: '是「身份证」(基线卡 c_shenfenzheng) 的字面子串；「证件上那串号码」只教一次就够，隐私规则另有「个人信息」(w_469) 承担', coveredBy: ['c_shenfenzheng', 'w_469'] },
  w_144: { phase: 'P1', reason: '「取号」(w_348) 已经教了同一个动作，机器名是多余的一层；全库 86 组「一卡是另一卡子串」之一', coveredBy: ['w_348'] },
  w_178: { phase: 'P1', reason: '是「检票口」(w_201) 的字面子串，连例句都发生在检票口', coveredBy: ['w_201'] },
  w_203: { phase: 'P1', reason: '是「候车」(w_166) 的字面子串，屋子名不必单独一张', coveredBy: ['w_166'] },
  w_489: { phase: 'P1', reason: '手机屏幕上的同一个现象，「未接来电」(w_488) 与「境外来电」(w_490) 已各教一遍；5 张来电类卡里第 3 张', coveredBy: ['w_488', 'w_490'] },
  w_293: { phase: 'P1', reason: '抽象底座词；老人屏幕上真正看到的是「未接来电」，不是「来电」这个概念', coveredBy: ['w_488', 'w_490'] },
  w_491: { phase: 'P1', reason: '「电话」是基线卡，「客服」(w_451)、「假客服」(w_492) 已覆盖骗术场景；再单列一张只剩高频字', coveredBy: ['c_dianhua', 'w_451', 'w_492'] },
  w_137: { phase: 'P1', reason: '与「手机银行」(w_093)、「网银」(w_120) 三张卡教同一件事；手机银行是最贴近现在的一张，保留', coveredBy: ['w_093'] },
  w_120: { phase: 'P1', reason: '就是「网上银行」的简称，同一概念的第二次出现', coveredBy: ['w_093'] },
  w_262: { phase: 'P1', reason: '与「停电」(w_265，难度 1) 同义；两颗词形容同一件事', coveredBy: ['w_265'] },
  w_190: { phase: 'P1', reason: '「打车」(w_189) 是老人的口语词，网约车是同一个动作的书面名', coveredBy: ['w_189'] },
  w_186: { phase: 'P1', reason: '与「火车」(w_187)、「高铁」(w_185) 属同类；三种车型对低识字老人是负担', coveredBy: ['w_187', 'w_185'] },
  w_188: { phase: 'P1', reason: '同上，且「一长串连在一起的车」是给孩子的解释，不是老人需要的词', coveredBy: ['w_187'] },
  w_360: { phase: 'P2', reason: '上位/流程词；老人真正要带的是具体证件，不是「开一张证明」这个概念', coveredBy: ['c_shenfenzheng', 'w_362', 'w_354'] },
  w_380: { phase: 'P2', reason: '流程词；「补办」(w_381)、「到期」(w_383) 已把这件事讲清楚', coveredBy: ['w_381', 'w_383'] },
  w_389: { phase: 'P2', reason: '上位词，具体证件已有 7 张卡；教了「证件」反而没有可指的东西', coveredBy: ['c_shenfenzheng', 'w_390', 'w_364'] },
  w_369: { phase: 'P2', reason: '只在少数地区/退伍军人场景用；「老年证」(w_390)、「老年卡」(w_370) 已教「凭证受照顾」这件事', coveredBy: ['w_390', 'w_370'] },
  w_046: { phase: 'P2', reason: '检查项目名；「报告单」(w_002)、「检查单」(w_017) 已教那张纸。且它是全库唯一的「心」，→ 换成「心脏」', coveredBy: ['w_002'], replacedBy: '心脏' },
  w_321: { phase: 'P2', reason: '手机设置项，不是生活词 → 换成「省钱」', coveredBy: [], replacedBy: '省钱' },
  w_331: { phase: 'P2', reason: '与「电池」(w_319) 重复；老人在家很少用充电宝', coveredBy: ['w_319'] },
  w_097: { phase: 'P2', reason: '老人多数只持储蓄卡；「银行卡」(w_138) 已覆盖卡本身', coveredBy: ['w_138'] },
  w_098: { phase: 'P2', reason: '银行产品名，口语就是「银行卡」；难度 3 更该先砍', coveredBy: ['w_138'] },
  w_122: { phase: 'P2', reason: '退休后是「退休金」(w_127) 打进卡；工资卡是子女场景', coveredBy: ['w_127', 'w_138'] },
  w_101: { phase: 'P2', reason: '费用名目里最细的一层，办卡时柜台会口头说；「缴费」已覆盖动作', coveredBy: ['c_jiaofei'] },
  w_139: { phase: 'P2', reason: '同上；跨行取款时柜台会说，不必单独一张卡教', coveredBy: ['c_jiaofei', 'w_079'] },
  w_057: { phase: 'P2', reason: '剂型细节；「药片」(w_056) 已教「药的形式」，液体药看瓶子就知道', coveredBy: ['w_056', 'c_yao'] },
  w_147: { phase: 'P2', reason: '地图用语；「车站」「站牌」「站台」已覆盖实体站', coveredBy: ['w_180', 'w_146', 'w_181'] },
};

const P1 = Object.entries(R).filter(([, v]) => v.phase === 'P1').map(([id]) => id);
const P2 = Object.entries(R).filter(([, v]) => v.phase === 'P2').map(([id]) => id);
const ALL = [...P1, ...P2];

const remove = ALL.map((id) => {
  const r = byId.get(id);
  if (!r) throw new Error(`unknown id ${id}`);
  if (baselineIds.has(id)) throw new Error(`baseline card in remove list: ${id}`);
  const chars = [...r.chars];
  const highChars = Object.fromEntries(chars.filter((c) => (baseFreq.get(c) || 0) >= 5).map((c) => [c, baseFreq.get(c)]));
  return {
    id, text: r.text, level: r.level, scene: r.scene, total: r.total,
    chars, highChars,
    phase: R[id].phase,
    reason: R[id].reason,
    coveredBy: R[id].coveredBy,
    ...(R[id].replacedBy ? { replacedBy: R[id].replacedBy } : {}),
  };
});

const replace = [
  { id: 'w_046', from: '心电图', to: '心脏', newChars: ['脏'], newCost: (baseFreq.get('心') ?? 0) + (baseFreq.get('脏') ?? 0), savesChars: ['心'], requiresNewImage: true, requiresNewMeaning: true, reason: '心电图是全库唯一的「心」；换成心脏更基础且不归零「心」字' },
  { id: 'w_321', from: '省电', to: '省钱', newChars: [], newCost: (baseFreq.get('省') ?? 0) + (baseFreq.get('钱') ?? 0), savesChars: ['省'], requiresNewImage: true, requiresNewMeaning: true, reason: '「省电」是手机设置项，「省钱」才是老人天天想的；不引入新字，钱 6→7 ≤ 上限' },
  { id: 'w_203', from: '候车室', to: '卧室', newChars: ['卧'], newCost: (baseFreq.get('卧') ?? 0) + (baseFreq.get('室') ?? 0), savesChars: ['室'], requiresNewImage: true, requiresNewMeaning: true, reason: '候车室在「候车」之内；卧室补家场景缺口（家 86 张卡没有卧室）' },
];

const keep = [
  ['c_dianhua', '全库唯一「打电话」的基线词；17 张电卡其余都是它的变体'],
  ['c_shenfenzheng', '证家族唯一必需品，其余 14 张都是它的延伸'],
  ['w_138', '银行卡：卡的实物载体，卡家族 13 张里最该留的一张'],
  ['w_022', '医保卡：看病买药第一张卡'],
  ['w_364', '社保卡：领钱+看病，替代不了'],
  ['c_yanzhengma', '验证码：防骗核心，证家族里最该留的一张'],
  ['w_478', '保证金：全库 total 最高（32），但例句是防骗句型「交保证金才能领奖，是骗人的」；砍掉就丢骗术样本。若必须再降 证/保/金，它是唯一可牺牲的防骗词（押金 w_025、定金 w_421、中奖 c_zhongjiang、公检法 w_495 部分覆盖）'],
  ['c_jiaofei', '缴费：水电气话费的统一动作'],
  ['w_018', '收费处：医院排队实际地点'],
  ['c_guahao', '挂号：看病第一步'],
  ['w_348', '取号：政务/银行排队实际动作（取号机被它包含，故删机不删它）'],
  ['w_201', '检票口：进站实际地点（检票被它包含，故删检票不删它）'],
  ['w_163', '车票：出行必备'],
  ['w_180', '车站：出行必备'],
  ['w_141', '电费：缴费场景唯一具名账单'],
  ['w_140', '水费：同上'],
  ['w_142', '燃气费：同上'],
  ['w_254', '电视：家里最常开的电器'],
  ['w_271', '电梯：上下楼唯一通道'],
  ['w_265', '停电：高频生活事件（难度 1）'],
  ['w_208', '电饭锅：做饭主设备'],
  ['w_370', '老年卡：老人坐车进公园的卡'],
  ['w_390', '老年证：老年身份凭证'],
  ['w_390_dup', ''],
].filter(([id]) => id !== 'w_390_dup');

const keepHigh = keep.map(([id, why]) => {
  const r = byId.get(id);
  if (!r) throw new Error(`bad keep id ${id}`);
  return { id, text: r.text, total: r.total, chars: [...r.chars], why };
});

const control = [
  { id: 'w_478', text: '保证金', note: '保留（防骗）；但它是「证/保/金」三个字的最贵出口，若将来必须再降频，优先动它' },
  { id: 'w_390/w_370', text: '老年证 / 老年卡', note: '两张都留；「优待证」移除后「凭证受照顾」只剩这两张，不再新增老年类证卡' },
  { id: 'w_488/w_490', text: '未接来电 / 境外来电', note: '来电类只留这两张；来电、来电显示、客服电话移除' },
  { id: 'w_483', text: '洗钱', note: '防骗；洗 8，保留但「洗」字冻结' },
  { id: 'w_201/w_348', text: '检票口 / 取号', note: '保留实体场景名，删掉被它们包含的动词卡' },
  { id: 'w_097/w_098/w_122', text: '信用卡/储蓄卡/工资卡', note: '全部移除，由「银行卡」承担；银行产品名对 <500 字老人是噪音' },
];

const add = [
  ['高血压', '慢病是第一大老人健康主题，全库只有「血压」没有「高血压」；3 个字全在 2–4 带'],
  ['体温', '只有「体温计」，没有「量体温」'],
  ['牙刷', '只有「刷牙」（动作），没有物'],
  ['护工', '只有「陪护」，没有「护工」这个身份'],
  ['退烧', '只有「发烧」，没有「退烧」；也救回 1 次的「烧」'],
  ['中医', '只有西医科室（内科/急诊），缺中医'],
  ['血压计', '家里自测血压的设备；与「血压」互补（数是血压，表是血压计）'],
  ['假牙', '65+ 高频物件；「假」目前只用于骗术（假币/假警察/假客服/假医生/假冒）'],
  ['养老院', '「老」只用于老年证/老年卡，缺养老机构'],
  ['手脚', '身体词缺口（可换「腿脚」，但会引入新字「腿」，暂不推荐）'],
];
const addCandidates = add.map(([text, why]) => {
  const chars = [...text];
  const newChars = chars.filter((c) => !baseFreq.has(c));
  const cost = chars.reduce((s, c) => s + (baseFreq.get(c) ?? 0), 0);
  const maxChar = Math.max(...chars.map((c) => baseFreq.get(c) ?? 0));
  if (cost > 9 || maxChar > 6 || newChars.length > 0) throw new Error(`violates rule: ${text} cost=${cost} max=${maxChar} new=${newChars}`);
  return { text, cost, maxChar, chars: chars.map((c) => ({ char: c, freq: baseFreq.get(c) ?? 0 })), newChars, why };
});

// projections
const kept1 = rows.filter((r) => !P1.includes(r.id));
const kept2 = rows.filter((r) => !ALL.includes(r.id));
const addCards = addCandidates.map((a, i) => ({ id: `x_${i}`, text: a.text, chars: a.text, scene: 'new', level: 2 }));
const kept3 = [...kept2, ...addCards];
function met(list) {
  const f = freqOf(list);
  const total = [...f.values()].reduce((a, b) => a + b, 0);
  const sorted = [...f.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const counts = [...f.values()].sort((a, b) => a - b);
  const mean = total / f.size;
  let sa = 0;
  for (const x of counts) for (const y of counts) sa += Math.abs(x - y);
  const hist = new Map();
  for (const n of f.values()) hist.set(n, (hist.get(n) || 0) + 1);
  return {
    cards: list.length, uniqueChars: f.size, totalOccurrences: total, max: sorted[0][1],
    mean: +mean.toFixed(2), gini: +(sa / (2 * counts.length * counts.length * mean)).toFixed(3),
    charsAt1: hist.get(1) || 0, charsAt1Pct: +((hist.get(1) || 0) / f.size * 100).toFixed(1),
    charsAt2to4: counts.filter((n) => n >= 2 && n <= 4).length,
    charsAt10plus: counts.filter((n) => n >= 10).length,
    top15: sorted.slice(0, 15).map(([c, n]) => ({ char: c, count: n })),
    _f: f, _sorted: sorted,
  };
}
const m0 = met(rows), m1 = met(kept1), m2 = met(kept2), m3 = met(kept3);
const strip = (m) => { const { _f, _sorted, ...rest } = m; return rest; };

const projectedTop = sorted0.slice(0, 20).map(([c, n]) => ({ char: c, before: n, afterP1: m1._f.get(c) ?? 0, after: m2._f.get(c) ?? 0 }));

const gone = [...baseFreq.keys()].filter((c) => !m2._f.has(c));

const plan = {
  schemaVersion: 1,
  generatedAt: '2026-10-28',
  scope: 'read-only analysis; no content/cards/*.yaml, image or content file was modified',
  inputs: ['work/char-audit/cards-with-freq.json', 'work/char-stats/cards-550.json', 'content/cards/level1.yaml', 'content/cards/level2.yaml'],
  method: {
    countedField: 'target word text only (same as pnpm cards:chars default)',
    unit: 'occurrences of Han characters; a char appearing twice in one word counts twice',
    note: 'cards-with-freq total = sum of the char frequencies of that card; it is a crowding weight, NOT the number of occurrences the card contributes',
  },
  baseline: strip(m0),
  target: {
    max: 10,
    min: 1,
    notes: [
      'max=10 的依据：每个头部字「互不重复、老人必须会」的词正好 10 张（电/证/车/卡/费/药/站/机/票 各 10，号 9）。上限 10 时一个必备概念都不必删；上限 8 就必须删必备词。',
      '成本曲线：把全部字压到 ≤12 需改写 11 次出现（0.9%）；≤10 需 26 次（2.1%）；≤8 需 52 次（4.2%）；≤6 需 102 次（8.3%）。12→10 清的是纯冗余，10→8 开始动正常词，10 是拐点。',
      'min 不设为「每个字至少 N 次」：一个字出现 1 次才进得了词表，强行要求 ≥2 等于要求扩词。守的是 floor 计数。',
      'floor 目标：1 次字数不得上升（当前 282/530 = 53.2%）。硬规则：新词不引入 0 次字；优先复用 2–4 次带（186 字 / 488 次 / 39.9%）。',
      '不追求均匀：530 字分 1224 次，平均 2.31。若做成每字 2 次要吃掉 1060 次，只剩 164 次给电/证/卡/药，反而破坏必备词。目标是「有界」，不是「均匀」。',
      '注意 Gini 不是验收指标：本方案只把 Gini 从 0.414 压到 0.395，因为 282 个 1 次字几乎不动。验收看 max、1 次字数、2–4 次带三个数。',
    ],
  },
  remove,
  replace,
  keepHigh,
  control,
  freezeChars: ['电', '证', '车', '卡', '费', '号', '机', '票', '药', '站'],
  addCandidates,
  selectionRule: {
    accept2Char: 'sum(charFreq) <= 9 and every char <= 6',
    accept3Char: 'sum(charFreq) <= 12 and every char <= 5',
    rejectIfAnyCharFreqAtLeast: 7,
    rejectIfNewCharsAtLeast: 2,
    frozenChars: '电 证 车 卡 费 号 机 票 药 站 — new cards may not use them unless essential AND one old card is removed first',
  },
  projectedTop,
  projection: { S0_current: strip(m0), S1_removeP1: strip(m1), S2_removeP1P2: strip(m2), S3_removeP1P2_plus_add: strip(m3) },
  histogram: {
    before: Object.fromEntries([...new Set(baseFreq.values())].sort((a, b) => b - a).map((n) => [n, [...baseFreq.values()].filter((x) => x === n).length])),
    afterRemove27: Object.fromEntries([...new Set(m2._f.values())].sort((a, b) => b - a).map((n) => [n, [...m2._f.values()].filter((x) => x === n).length])),
  },
  sideEffects: {
    charsLostEntirelyAfterRemove27: gone,
    restoredByReplace: { '心': 'w_046 心电图 → 心脏', '省': 'w_321 省电 → 省钱', '室': 'w_203 候车室 → 卧室' },
    stillLost: gone.filter((c) => !['心', '省', '室'].includes(c)),
    note: '显 和 续 值得下一批补词优先救回（如「显示」cost 4：显1+示3）',
  },
  bounds: {
    head: '对头部是可达的下确界：27 张全部移除且不补词时 Top10 全部 <=10，这是「只靠删」的最好结果；再往下压（<=8）必须删必备词，属内容缩水。',
    floor: '对 1 次字是上界：删卡只能让 1 次字消失或不变，绝不会让它变熟。S2 的 277 里有「字整个消失」带来的假下降。真正下降要等补词。',
    gini: '对 Gini 是上限估计：只从 0.414 降到 0.395。',
    caveat: '模拟假设「移除即消失、不补词」。实际若同时补词或只删一部分，数字会往中间走；真实值以合并后重跑 pnpm cards:chars 为准。',
  },
  verification: [
    'pnpm content:validate',
    'pnpm cards:chars -- --top 12',
    'pnpm check',
    '不要手改 work/char-stats 历史报告；重跑覆盖',
  ],
  counts: {
    removeTotal: remove.length,
    removeP1: P1.length,
    removeP2: P2.length,
    removePctOfDeck: +((remove.length / rows.length) * 100).toFixed(1),
    occurrencesRedirected: ALL.reduce((s, id) => s + [...byId.get(id).chars].length, 0),
    occurrencesRedirectedPct: +(ALL.reduce((s, id) => s + [...byId.get(id).chars].length, 0) / 1224 * 100).toFixed(1),
  },
};

fs.writeFileSync('work/char-audit/frequency-plan.json', JSON.stringify(plan, null, 2) + '\n', 'utf8');
console.log('written. remove=' + remove.length + ' P1=' + P1.length + ' P2=' + P2.length + ' keep=' + keepHigh.length + ' add=' + addCandidates.length);
console.log('S2 max=' + m2.max + ' cards=' + m2.cards + ' singles=' + m2.charsAt1 + ' S3 singles=' + m3.charsAt1);
