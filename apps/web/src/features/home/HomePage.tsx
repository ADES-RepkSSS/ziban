import { useEffect, useMemo } from 'react';
import {
  activeSession,
  findFinishedSessionToday,
  learnedCards,
  pickSessionCards,
  startAnotherSession,
  type Card,
} from '@ziban/core';
import { useProgress } from '../../app/ProgressProvider';
import { useSpeech } from '../../app/SpeechProvider';
import { navigate } from '../../app/router';
import { Icon } from '../../components/Icon';
import { cards, getCard, imageUrl } from '../../content/deck';
import { ScreenLookupCard } from '../screen/ScreenLookupCard';
import { UpdateBanner } from '../update/UpdateBanner';

/**
 * 首页是“工具入口”，不是课程首页。
 *
 * 老人第一次打开时最先想解决的是“屏幕上这行字是什么”，所以把“看屏幕”
 * 放在第一张大卡；下面是三项常用工具，每项配一张特征图，方便不识字的人
 * 按图找入口，而不是读标题。
 *
 * 每一天三个字仍然保留，但降为第二入口：它是可选的练习，不是使用前提。
 */
export function HomePage() {
  const { progress, update, storageOk } = useProgress();
  const { speak, stop } = useSpeech();

  useEffect(() => () => stop(), [stop]);

  const active = activeSession(progress);
  const finished = findFinishedSessionToday(progress);
  const canLearnAgain = Boolean(finished && !active);
  const fallback = useMemo(() => pickSessionCards(cards, progress), [progress]);
  const previewId = active
    ? active.cardIds.find((id) => !active.completedIds.includes(id))
    : fallback[0]?.id ?? finished?.cardIds[0];
  const preview = getCard(previewId);

  const learned = learnedCards(progress)
    .map((id) => getCard(id))
    .filter((card): card is Card => Boolean(card))
    .slice(0, 8);

  const title = active ? '接着认字' : canLearnAgain ? '再认三个' : '今天认三个字';
  const subtitle = active
    ? `还剩 ${active.cardIds.length - active.completedIds.length} 个没看完`
    : canLearnAgain
      ? '今天已经认完了，还能再认三个'
      : '一天三个，有图有声音';

  const spokenIntro =
    '这是字伴。最上面是看屏幕：鼠标停在哪，我就念哪。下面是每天认三个字、看图找字、帮我看屏幕。点一下就能用。';

  const help = () => speak({ text: spokenIntro, segmentId: 'home-help', rate: 0.8 });

  const startLearning = () => {
    stop();
    if (canLearnAgain) {
      update((previous) => startAnotherSession(cards, previous).progress);
    }
    navigate('#/learn');
  };

  return (
    <div className="home">
      <header className="home-header">
        <div className="home-header__brand">
          <span className="brand-mark__seal" aria-hidden="true">
            字
          </span>
          <div>
            <div className="home-header__name">字伴</div>
            <div className="home-header__tagline">按一下，字就会说话</div>
          </div>
        </div>
        <div className="home-header__actions">
          <button type="button" className="round-button" onClick={help} aria-label="听一听怎么用">
            <Icon name="speaker" size={32} />
          </button>
          <button
            type="button"
            className="round-button"
            onClick={() => navigate('#/settings')}
            aria-label="设置"
          >
            <Icon name="settings" size={32} />
          </button>
        </div>
      </header>

      <main className="home-main">
        <div className="home-greeting">
          <h1>今天想做什么？</h1>
          <button type="button" className="inline-listen" onClick={help}>
            <Icon name="ear" size={22} />
            听一听
          </button>
        </div>

        {!storageOk ? (
          <p className="inline-alert" role="status">
            <Icon name="info" size={22} />
            这台电脑不让记事。学过的字，下次可能不记得。
          </p>
        ) : null}

        <UpdateBanner />

        {/* 第一入口：看屏幕。图 + 大字 + 一个大按钮，不识字也能按图找。 */}
        <ScreenLookupCard />

        <section className="home-tools" aria-labelledby="home-tools-title">
          <div className="home-tools__head">
            <h2 id="home-tools-title">还可以做什么</h2>
            <span className="home-tools__hint">点图就能用</span>
          </div>

          <div className="home-tools__grid">
            <button
              type="button"
              className="home-tool home-tool--learn"
              onClick={startLearning}
              aria-label={`${title}。${subtitle}`}
            >
              <span className="home-tool__art">
                <img
                  src={preview ? imageUrl(preview) : './features/learn.svg'}
                  alt=""
                  loading="lazy"
                />
                {preview ? <span className="home-tool__badge">{preview.text}</span> : null}
              </span>
              <span className="home-tool__body">
                <span className="home-tool__eyebrow">
                  <Icon name="sparkle" size={20} />
                  每天三个字
                </span>
                <span className="home-tool__title">{title}</span>
                <span className="home-tool__sub">{subtitle}</span>
                <span className="home-tool__cta">
                  <Icon name="play" size={24} />
                  开始
                </span>
              </span>
            </button>

            <button
              type="button"
              className="home-tool home-tool--library"
              onClick={() => navigate('#/library')}
            >
              <span className="home-tool__art">
                <img src="./features/library.svg" alt="" loading="lazy" />
              </span>
              <span className="home-tool__body">
                <span className="home-tool__title">看图找字</span>
                <span className="home-tool__sub">忘了的字，点图就能听</span>
              </span>
              <Icon name="chevronRight" size={28} />
            </button>

            <button
              type="button"
              className="home-tool home-tool--paste"
              onClick={() => navigate('#/helper')}
            >
              <span className="home-tool__art">
                <img src="./features/paste.svg" alt="" loading="lazy" />
              </span>
              <span className="home-tool__body">
                <span className="home-tool__title">帮我看屏幕</span>
                <span className="home-tool__sub">短信、通知、网页，粘贴进来念</span>
              </span>
              <Icon name="chevronRight" size={28} />
            </button>
          </div>
        </section>

        {learned.length > 0 ? (
          <section className="learned" aria-labelledby="learned-title">
            <div className="learned__head">
              <h2 id="learned-title">你已经认了 {learnedCards(progress).length} 个字</h2>
              <span className="learned__hint">点一下，再听一遍</span>
            </div>
            <div className="learned__strip">
              {learned.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className="learned-chip"
                  onClick={() => navigate(`#/card/${encodeURIComponent(card.id)}`)}
                  aria-label={`看 ${card.text}`}
                >
                  <img src={imageUrl(card)} alt="" loading="lazy" />
                  <span>{card.text}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="home-footer">
        <span className="home-footer__note">
          <Icon name="heart" size={20} />
          没有广告，不收费，学过的字只存在这台电脑里。
        </span>
        <div className="home-footer__links">
          <button type="button" className="footer-link" onClick={() => navigate('#/welcome')}>
            <Icon name="info" size={20} />
            怎么用
          </button>
          <button type="button" className="footer-link" onClick={() => navigate('#/settings')}>
            <Icon name="settings" size={20} />
            设置
          </button>
        </div>
      </footer>
    </div>
  );
}
