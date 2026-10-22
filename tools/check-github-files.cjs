#!/usr/bin/env node
/**
 * GitHub 发布前的小检查（CI 也会跑）：
 * 1. 解析 .github 下所有 YAML，防止 issue template / workflow 语法坏掉；
 * 2. 检查根目录与 docs 里的本地 Markdown 链接/图片是否存在。
 *
 * 不检查外链（网络不稳定、也不该在 CI 里逐个抓）。
 */
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

let failed = false;

// ── YAML ────────────────────────────────────────────────
for (const file of walk(path.join(ROOT, '.github')).filter((file) => /\.ya?ml$/i.test(file))) {
  try {
    YAML.parse(fs.readFileSync(file, 'utf8'));
    console.log(`✓ yaml ${rel(file)}`);
  } catch (error) {
    failed = true;
    console.error(`✗ yaml ${rel(file)}: ${error.message}`);
  }
}

// ── Markdown 本地链接/图片 ───────────────────────────────
const markdownFiles = [
  'README.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'PRIVACY.md',
  'GOVERNANCE.md',
  'CHANGELOG.md',
  'AGENTS.md',
  'content/README.md',
  'content/LICENSE.md',
  'docs/assets/README.md',
  ...fs
    .readdirSync(path.join(ROOT, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `docs/${name}`),
];

for (const relFile of markdownFiles) {
  const file = path.join(ROOT, relFile);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');

  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const link = match[1];
    if (/^(https?:|mailto:|#)/i.test(link)) continue;
    const target = decodeURI(link.split('#')[0]);
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) {
      failed = true;
      console.error(`✗ link ${relFile} -> ${link}`);
    }
  }
}

if (failed) {
  console.error('\nGitHub 文件检查失败。');
  process.exit(1);
}
console.log(`\n✓ GitHub 文件检查通过（${markdownFiles.length} 个 Markdown 文件）`);
