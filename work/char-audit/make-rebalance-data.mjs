import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';

const root = process.cwd();
const require = createRequire(path.join(root, 'apps', 'desktop', 'package.json'));
const pinyinMod = await import(pathToFileURL(require.resolve('pinyin-pro')).href);
const pinyin = pinyinMod.pinyin ?? pinyinMod.default.pinyin;
const py = (text) => {
  const overrides = { 还钱: ['huán', 'qián'], 心脏: ['xīn', 'zàng'] };
  return overrides[text] ?? pinyin(text, { toneType: 'symbol', type: 'array', nonZh: 'removed' });
};
const chars = (text) => [...text];

const removeIds = [
  'w_498', 'w_144', 'w_178', 'w_489', 'w_293', 'w_491', 'w_137', 'w_120', 'w_262', 'w_190',
  'w_186', 'w_188', 'w_360', 'w_380', 'w_389', 'w_369', 'w_331', 'w_097', 'w_098', 'w_122',
  'w_101', 'w_139', 'w_057', 'w_147', 'w_454', 'w_431', 'w_124', 'w_088',
];

const replacements = [
  {
    id: 'w_046', text: '心脏', scene: 'health', level: 2, image: 'cards500-046.svg',
    meaning: '身上一直在跳的东西',
    sentence: '走快一点，心脏就跳得厉害。',
    alt: '一颗红色的心脏，旁边有一条跳动的线',
    visual: { icon: 'heart', props: [], accent: 'red' },
  },
  {
    id: 'w_321', text: '省钱', scene: 'money', level: 2, image: 'cards500-321.svg',
    meaning: '少花不该花的钱',
    sentence: '自己做饭，能省不少钱。',
    alt: '一个存钱罐，旁边有一枚硬币',
    visual: { icon: 'piggy-bank', props: ['coin'], accent: 'amber' },
  },
  {
    id: 'w_203', text: '卧室', scene: 'home', level: 1, image: 'cards500-203.svg',
    meaning: '睡觉的那间屋子',
    sentence: '卧室的灯坏了，晚上很黑。',
    alt: '一间卧室，里面有一张床和一盏床头灯',
    visual: { icon: 'bed', props: ['clock'], accent: 'amber' },
  },
];

const additions = [
  ['w_501', '高血压', 'health', 2, '血压一直比平常高', '奶奶有高血压，每天都要量一量。', '一只手臂上绑着血压计袖带，表上的指针偏高', 'blood-pressure', [], 'red'],
  ['w_502', '体温', 'health', 1, '身上有多热', '先量一下体温，看发不发烧。', '一支体温计，旁边有一杯温水', 'thermometer', [], 'blue'],
  ['w_503', '牙刷', 'home', 1, '刷牙用的小刷子', '牙刷用久了要换一把新的。', '一把牙刷和一支牙膏', 'toothbrush', [], 'teal'],
  ['w_504', '护工', 'health', 2, '在医院照顾病人的人', '住院时请个护工帮忙照顾。', '一位穿工作服的护工在病床边照顾老人', 'nurse', [], 'green'],
  ['w_505', '退烧', 'health', 1, '让身上的热退下去', '吃了药，烧慢慢退了。', '一支体温计，旁边有一个箭头', 'thermometer', ['arrow'], 'blue'],
  ['w_506', '中医', 'health', 2, '用草药和推拿治病', '他去看中医，开了几副药。', '一位中医在给老人把脉，旁边放着草药', 'doctor', ['leaf'], 'green'],
  ['w_507', '血压计', 'health', 2, '量血压用的表', '家里的血压计要常常校准。', '一台放在桌上的血压计，连着一根袖带', 'blood-pressure', [], 'blue'],
  ['w_508', '假牙', 'health', 1, '装在嘴里代替真牙', '假牙要拿下来刷干净。', '一颗白色的假牙', 'tooth', [], 'blue'],
  ['w_509', '养老院', 'gov', 2, '老人住进去有人照顾', '老人住在养老院有人照顾。', '一栋小楼，门口站着一位老人', 'community', [], 'amber'],
  ['w_510', '手脚', 'health', 1, '手和脚，身上能动的两头', '天冷了，手脚容易发凉。', '一只手和一只脚画在一起', 'limbs', [], 'teal'],
  ['w_511', '吃饭', 'home', 1, '把饭放进嘴里咽下去', '慢慢吃饭，别急着咽。', '一个人坐在桌边端着碗吃饭', 'bowl', ['steam'], 'amber'],
  ['w_512', '散步', 'health', 1, '慢慢走一走活动身体', '饭后到楼下散步半小时。', '两个老人在小区里慢慢走路', 'walking', [], 'green'],
  ['w_513', '穿衣', 'home', 1, '把衣服穿到身上', '天凉了，多穿一件衣服。', '一个人正把外套穿到身上，旁边有衣架', 'hanger', [], 'pink'],
  ['w_514', '起床', 'home', 1, '睡醒了从床上起来', '早上七点起床，先喝杯水。', '一个人从床上坐起来，窗外有太阳', 'bed', ['clock'], 'amber'],
  ['w_515', '关灯', 'home', 1, '把灯关掉不亮了', '出门前记得关灯。', '一只手按下墙上的开关，灯灭了', 'switch-off', [], 'red'],
  ['w_516', '开窗', 'home', 1, '把窗户打开透气', '屋里闷，开窗透透气。', '一扇窗户向外打开，风吹进来', 'window', ['arrow'], 'blue'],
  ['w_517', '锁门', 'home', 1, '出门前把门锁上', '睡觉前检查一下有没有锁门。', '一扇门，门边挂着一把锁', 'door', ['lock'], 'teal'],
  ['w_518', '烧饭', 'home', 1, '把生的东西做熟', '中午在家烧饭，不去外面吃。', '灶上放着锅，锅里冒着热气', 'pot', ['steam'], 'red'],
  ['w_519', '买菜', 'shopping', 1, '去市场把菜买回来', '早上去菜场买菜，便宜又新鲜。', '一个菜篮子，里面装着青菜和萝卜', 'basket', ['leaf'], 'green'],
  ['w_520', '路牌', 'travel', 1, '路边写着路名的牌子', '看不懂路牌，就问一下路人。', '路边立着一块路牌，牌上有一个箭头', 'road-sign', [], 'red'],
  ['w_521', '拖地', 'home', 1, '用拖把把地擦干净', '地上有水，拿拖把拖一拖。', '一个人拿着拖把在拖地', 'mop', ['drop'], 'blue'],
  ['w_522', '擦窗', 'home', 2, '把窗户上的灰擦掉', '过年之前把窗户擦干净。', '一只手拿抹布擦窗户', 'window', ['spark'], 'blue'],
  ['w_523', '打字', 'contact', 2, '用手指按键盘写字', '字太小，打字看不清。', '两只手在键盘上打字', 'keyboard', [], 'teal'],
  ['w_524', '护照', 'gov', 2, '出国要用的证件', '出国要带护照和机票。', '一本护照，旁边有一张机票', 'id-card', ['badge'], 'amber'],
  ['w_525', '声明', 'gov', 2, '公开说清楚一件事', '居委会贴了一张声明。', '一张写了字的纸，旁边有一个对勾', 'document', ['check'], 'blue'],
  ['w_526', '牙科', 'health', 2, '看牙治牙的科室', '牙疼得厉害，去牙科看看。', '一张牙科治疗椅，旁边站着牙医', 'tooth', [], 'teal'],
  ['w_527', '眼科', 'health', 2, '看眼睛的科室', '眼睛看不清，先挂眼科。', '一台眼科检查仪，前面有一只眼睛', 'eye', [], 'blue'],
  ['w_528', '还钱', 'money', 2, '把借的钱还给人家', '借的钱要按时还。', '一双手把纸币递给另一个人', 'cash', ['arrow'], 'green'],
];

const existing = [
  ...YAML.parse(fs.readFileSync('content/cards/level1.yaml', 'utf8')),
  ...YAML.parse(fs.readFileSync('content/cards/level2.yaml', 'utf8')),
];
const existingTexts = new Set(existing.map((c) => c.text));
const existingIds = new Set(existing.map((c) => c.id));
for (const id of removeIds) if (!existingIds.has(id)) throw new Error(`remove id not found: ${id}`);
for (const r of replacements) if (!existingIds.has(r.id)) throw new Error(`replace id not found: ${r.id}`);

const commonText = fs.readFileSync('corpus/chars/common2000.txt', 'utf8');
const charsetLevel2 = fs.readFileSync('content/charset.level2.txt', 'utf8');
const missingTarget = [...new Set([...replacements, ...additions.map((a) => ({ text: a[1] }))].flatMap((x) => [...x.text]))]
  .filter((ch) => !commonText.includes(ch));
const missingMeaning = [...new Set([...replacements, ...additions.map((a) => ({ meaning: a[4] }))].flatMap((x) => [...x.meaning]))]
  .filter((ch) => !charsetLevel2.includes(ch));
if (missingTarget.length) throw new Error(`target chars outside common2000: ${missingTarget.join('')}`);
if (missingMeaning.length) throw new Error(`meaning chars outside charset.level2: ${missingMeaning.join('')}`);

const replacementObjects = replacements.map((r) => ({
  ...r,
  chars: chars(r.text),
  pinyin: py(r.text),
  imageAlt: r.alt,
}));
const additionObjects = additions.map(([id, text, scene, level, meaning, sentence, alt, icon, props, accent]) => ({
  id, text, scene, level, meaning, sentence, image: `cards500-${id.slice(2)}.svg`,
  chars: chars(text), pinyin: py(text), imageAlt: alt,
  visual: { icon, props, accent },
}));
for (const a of additionObjects) {
  if (existingTexts.has(a.text)) throw new Error(`duplicate text: ${a.text}`);
  if (existingIds.has(a.id)) throw new Error(`duplicate id: ${a.id}`);
}
for (const r of replacementObjects) {
  if (r.text !== existing.find((c) => c.id === r.id).text && existingTexts.has(r.text)) {
    throw new Error(`replacement text already exists: ${r.text}`);
  }
}
const out = {
  generatedAt: '2026-11-01',
  rev: 'rebalance-2026-11',
  removeIds,
  replacements: replacementObjects,
  additions: additionObjects,
  stats: {
    removed: removeIds.length,
    replaced: replacementObjects.length,
    added: additionObjects.length,
  },
};
fs.writeFileSync('work/char-audit/rebalance-data.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.stats, null, 2));
console.log('new target chars:', [...new Set(additionObjects.flatMap((a) => a.chars).concat(replacementObjects.flatMap((r) => r.chars)))].length);
