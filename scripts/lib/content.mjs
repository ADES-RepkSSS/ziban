import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { z } from 'zod';

/**
 * 内容构建管线（唯一入口）：
 *
 *   content/cards/level*.yaml
 *     → Zod 结构校验
 *     → 业务门禁（text/chars、拼音数量、释义用字表、图片存在、id 唯一）
 *     → 复制 content/images 到 apps/web/public/images
 *     → 生成 apps/web/src/content/cards.generated.json
 *
 * 生成字段 `imageUrl` / `order` 只存在于 JSON，**不要写回 YAML**；
 * 也不要手改 cards.generated.json——下次构建会覆盖。
 * 加卡/改图的完整流程见 content/README.md。
 */
const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
export const CARDS_DIR = path.join(ROOT, 'content', 'cards');
export const IMAGES_DIR = path.join(ROOT, 'content', 'images');
export const CHARSET_FILE = path.join(ROOT, 'content', 'charset.level1.txt');
export const WEB_DIR = path.join(ROOT, 'apps', 'web');
export const PUBLIC_IMAGES_DIR = path.join(WEB_DIR, 'public', 'images');
export const GENERATED_FILE = path.join(WEB_DIR, 'src', 'content', 'cards.generated.json');
export const SCHEMA_FILE = path.join(ROOT, 'schema', 'card.schema.json');

const sourceSchema = z
  .object({
    dict: z.enum(['zhwiktionary', 'cc-cedict', 'self']),
    entry: z.string().min(1),
    rev: z.string().optional(),
  })
  .strict();

const cardSchema = z
  .object({
    id: z.string().regex(/^[a-z]{1,3}_[a-z0-9_]+$/, 'id 需形如 c_yao / w_yaopin_001'),
    text: z.string().min(1).max(6),
    chars: z.array(z.string().length(1)).min(1),
    pinyin: z.array(z.string().min(1)),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    scene: z.enum(['health', 'money', 'travel', 'home', 'contact', 'gov', 'shopping', 'safety']),
    meaning: z.string().min(1).max(20),
    meaning_source: sourceSchema,
    sentence: z.string().max(30).optional(),
    sentence_source: z
      .object({
        corpus: z.enum(['health_faq', 'gov_site', 'oss_docs', 'volunteer_cc0', 'self']),
        doc: z.string().optional(),
      })
      .strict()
      .optional(),
    image: z
      .object({
        file: z
          .string()
          .min(1)
          .regex(
            /^[A-Za-z0-9][A-Za-z0-9._-]*\.(svg|png|jpe?g|webp)$/i,
            'image.file 只能是 content/images 下的文件名（不允许路径分隔符）',
          ),
        lib: z.enum(['self', 'arasaac', 'openmoji', 'mulberry', 'openverse']),
        license: z.string().min(1),
        alt: z.string().optional(),
        candidates: z.array(z.string()).optional(),
      })
      .strict(),
    confusables: z.array(z.string().min(1)).min(1).optional(),
    status: z.enum(['draft', 'machine_ok', 'human_ok', 'published', 'retired']),
    review: z
      .object({
        redteam: z
          .object({
            pass: z.boolean().optional(),
            rounds: z.number().int().optional(),
            last: z.string().optional(),
          })
          .strict()
          .optional(),
        human: z
          .object({
            by: z.string(),
            at: z.string().optional(),
            note: z.string().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    gen: z
      .object({
        model: z.string().min(1),
        prompt_ver: z.string().min(1),
        hash: z.string().min(1),
      })
      .strict(),
  })
  .strict();

function formatIssues(issues) {
  return issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}

export function loadCards({ quiet = false } = {}) {
  const files = fs
    .readdirSync(CARDS_DIR)
    .filter((file) => /^level\d+\.yaml$/.test(file))
    .sort();

  if (files.length === 0) {
    throw new Error(`没有找到卡片文件：${CARDS_DIR}/level*.yaml`);
  }

  const cards = [];
  const errors = [];
  const warnings = [];

  for (const file of files) {
    const fullPath = path.join(CARDS_DIR, file);
    let parsed;
    try {
      parsed = YAML.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (error) {
      errors.push(`${file}: YAML 解析失败：${error.message}`);
      continue;
    }

    if (!Array.isArray(parsed)) {
      errors.push(`${file}: 顶层必须是卡片数组`);
      continue;
    }

    parsed.forEach((raw, index) => {
      const result = cardSchema.safeParse(raw);
      if (!result.success) {
        errors.push(`${file} 第 ${index + 1} 张：${formatIssues(result.error.issues).join('；')}`);
        return;
      }
      cards.push({ ...result.data, __file: file, __order: cards.length });
    });
  }

  const ids = new Set();
  const texts = new Set();
  for (const card of cards) {
    if (ids.has(card.id)) errors.push(`重复 id：${card.id}`);
    ids.add(card.id);

    if (texts.has(card.text)) warnings.push(`重复词条：${card.text}（${card.id}）`);
    texts.add(card.text);

    if (card.text !== card.chars.join('')) {
      errors.push(`${card.id}: text「${card.text}」与 chars「${card.chars.join('')}」不一致`);
    }
    if (card.pinyin.length !== card.chars.length) {
      errors.push(`${card.id}: pinyin 数量 ${card.pinyin.length} 与字数 ${card.chars.length} 不一致`);
    }
    if (/[A-Za-z0-9()[\]{}<>《》【】]/.test(card.meaning)) {
      errors.push(`${card.id}: 释义含英文、数字或括号：「${card.meaning}」`);
    }
    if (/[。！？!?]/.test(card.meaning)) {
      warnings.push(`${card.id}: 释义末尾有句号，朗读时可去掉`);
    }
    if (!fs.existsSync(path.join(IMAGES_DIR, card.image.file))) {
      errors.push(`${card.id}: 图片不存在 content/images/${card.image.file}`);
    }
    if (card.status === 'draft') {
      // 原型内容允许 draft，但发布前必须走审校。这里只提示，不阻塞本地实验。
    }
    if (!card.image.alt) {
      warnings.push(`${card.id}: 缺少 image.alt，读图功能无法使用`);
    }
    if (card.sentence && !card.sentence_source) {
      warnings.push(`${card.id}: 有例句但没有 sentence_source`);
    }
  }

  const charset = loadCharset();
  if (charset.size > 0) {
    for (const card of cards) {
      const unknown = [...new Set([...card.meaning].filter((char) => /[\u4e00-\u9fff]/.test(char) && !charset.has(char)))];
      if (unknown.length > 0) {
        errors.push(
          `${card.id}: 释义用了字表外的字「${unknown.join('')}」：「${card.meaning}」`,
        );
      }
    }
  }

  if (!quiet) {
    for (const warning of warnings) console.warn(`[warn] ${warning}`);
  }

  if (errors.length > 0) {
    const message = errors.map((error) => `[error] ${error}`).join('\n');
    throw new Error(message);
  }

  return { cards, warnings, files };
}

export function loadCharset() {
  if (!fs.existsSync(CHARSET_FILE)) return new Set();
  return new Set(
    fs
      .readFileSync(CHARSET_FILE, 'utf8')
      .replace(/#.*$/gm, '')
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((chunk) => [...chunk]),
  );
}

export function buildDeck(cards) {
  return {
    version: 1,
    builtAt: new Date().toISOString(),
    cards: cards.map(({ __file, __order, ...card }, index) => ({
      ...card,
      order: index,
      imageUrl: `./images/${card.image.file}`,
    })),
  };
}

export function writeOutputs(cards) {
  fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(GENERATED_FILE), { recursive: true });

  // 只保留当前内容引用的图片副本，避免 public 里堆积旧素材。
  fs.rmSync(PUBLIC_IMAGES_DIR, { recursive: true, force: true });
  fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });

  // 卡片图 + 文章图都属于内容素材，一起复制；图片很少，全量复制最简单。
  const allImages = fs
    .readdirSync(IMAGES_DIR)
    .filter((file) => fs.statSync(path.join(IMAGES_DIR, file)).isFile());
  for (const file of allImages) {
    fs.copyFileSync(path.join(IMAGES_DIR, file), path.join(PUBLIC_IMAGES_DIR, file));
  }

  const usedImages = new Set(cards.map((card) => card.image.file));

  const deck = buildDeck(cards);
  fs.writeFileSync(GENERATED_FILE, `${JSON.stringify(deck, null, 2)}\n`, 'utf8');

  const bytes = allImages.reduce(
    (sum, file) => sum + fs.statSync(path.join(PUBLIC_IMAGES_DIR, file)).size,
    0,
  );

  return { deck, usedImages, imageCount: allImages.length, bytes };
}
