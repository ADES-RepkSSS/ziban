import { buildDeck, loadCards, writeOutputs } from './lib/content.mjs';

try {
  const { cards, warnings, files } = loadCards();
  const { usedImages, imageCount, bytes } = writeOutputs(cards);
  const scenes = new Map();
  for (const card of cards) scenes.set(card.scene, (scenes.get(card.scene) ?? 0) + 1);
  const deck = buildDeck(cards);

  console.log(`✓ 内容校验通过：${files.join('、')}`);
  console.log(
    `  卡片 ${deck.cards.length} 张，卡片引用图片 ${usedImages.size} 个，共复制 ${imageCount} 个（${(
      bytes / 1024
    ).toFixed(1)} KB）`,
  );
  console.log(`  场景：${[...scenes].map(([scene, count]) => `${scene} ${count}`).join(' · ')}`);
  console.log(`  警告 ${warnings.length} 条`);
  console.log(`  已写入 apps/web/src/content/cards.generated.json 与 public/images/`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
