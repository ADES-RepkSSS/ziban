import { loadCards } from './lib/content.mjs';

try {
  const { cards, warnings } = loadCards();
  console.log(`✓ ${cards.length} 张卡片全部通过 schema 与内容门禁`);
  for (const warning of warnings) console.log(`  · ${warning}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
