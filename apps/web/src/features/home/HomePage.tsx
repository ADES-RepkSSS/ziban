import { useEffect, useMemo } from 'react';
import {
  activeSession,
  findFinishedSessionToday,
  learnedCards,
  pickSessionCards,
  SCENE_META,
  startAnotherSession,
  type Card,
} from '@ziban/core';
import { useProgress } from '../../app/ProgressProvider';
import { useSpeech } from '../../app/SpeechProvider';
import { navigate } from '../../app/router';
import { Icon } from '../../components/Icon';
import { cards, getCard, imageUrl } from '../../content/deck';

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
      : '点一下，开始';

  const spokenIntro =
    '这是字伴。点上面的大卡片，开始认字。点下面的字库，可以看图找字。点帮我看屏幕，我会念屏幕上的字。';

  const help = () => speak({ text: spokenIntro, segmentId: 'home-help', rate: 0.8 });

  const speakPreview = () => {
    if (!preview) return;
    speak({
      text: `${preview.text}。${preview.meaning}`,
      segmentId: 'home-preview',
      rate: progress.settings.rate,
    });
  };

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

        <div className="home-hero">
          <button
            type="button"
            className="home-hero__main"
            onClick={startLearning}
            aria-label={`${title}。${subtitle}`}
          >
            <span className="home-hero__copy">
              <span className="home-hero__eyebrow">
                <Icon name="sparkle" size={24} />
                每天三个字
              </span>
              <span className="home-hero__title">{title}</span>
              <span className="home-hero__subtitle">{subtitle}</span>
              <span className="home-hero__cta">
                <Icon name="play" size={30} />
                开始
              </span>
            </span>

            <span className="home-hero__preview">
              {preview ? (
                <>
                  <span className="home-hero__image">
                    <img src={imageUrl(preview)} alt={preview.image.alt ?? ''} />
                  </span>
                  <span className="home-hero__word">{preview.text}</span>
                  <span className="home-hero__scene">{SCENE_META[preview.scene].short}</span>
                </>
              ) : (
                <span className="home-hero__empty">字库还没有内容</span>
              )}
            </span>
          </button>

          {preview ? (
            <button
              type="button"
              className="home-hero__sound"
              aria-label="先听一听这个字"
              onClick={speakPreview}
            >
              <Icon name="speaker" size={26} />
            </button>
          ) : null}
        </div>

        <div className="home-tiles">
          <button
            type="button"
            className="home-tile home-tile--library"
            onClick={() => navigate('#/library')}
          >
            <span className="home-tile__icon">
              <Icon name="grid" size={56} />
            </span>
            <span className="home-tile__text">
              <span className="home-tile__title">看图找字</span>
              <span className="home-tile__sub">忘了的字，点图就能听</span>
            </span>
            <Icon name="chevronRight" size={30} />
          </button>

          <button
            type="button"
            className="home-tile home-tile--helper"
            onClick={() => navigate('#/helper')}
          >
            <span className="home-tile__icon">
              <Icon name="screen" size={56} />
            </span>
            <span className="home-tile__text">
              <span className="home-tile__title">帮我看屏幕</span>
              <span className="home-tile__sub">念一段字，讲一讲</span>
            </span>
            <Icon name="chevronRight" size={30} />
          </button>
        </div>

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
        <button type="button" className="footer-link" onClick={() => navigate('#/settings')}>
          <Icon name="settings" size={20} />
          设置
        </button>
      </footer>
    </div>
  );
}
