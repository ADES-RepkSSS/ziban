import { useEffect, useMemo } from 'react';
import { SCENE_META, startAnotherSession, type Card, type DailySession } from '@ziban/core';
import { useProgress } from '../../app/ProgressProvider';
import { useSpeech } from '../../app/SpeechProvider';
import { navigate } from '../../app/router';
import { BigButton } from '../../components/BigButton';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { cards, getCard, imageUrl } from '../../content/deck';

export function SessionComplete({ session }: { session: DailySession }) {
  const { progress, update } = useProgress();
  const { speak, stop } = useSpeech();
  const sessionCards = useMemo(
    () => session.cardIds.map((id) => getCard(id)).filter((card): card is Card => Boolean(card)),
    [session.cardIds],
  );

  useEffect(() => {
    const words = sessionCards.map((card) => card.text).join('、');
    speak({
      text: `今天认完了，真棒。你认识了${words}。`,
      segmentId: 'complete',
      rate: Math.max(0.65, progress.settings.rate),
    });
    return () => stop();
  }, [session.id, sessionCards, speak, stop, progress.settings.rate]);

  const speakWord = (card: Card) => {
    speak({
      text: `${card.text}。${card.meaning}`,
      segmentId: `review-${card.id}`,
      rate: progress.settings.rate,
    });
  };

  const learnMore = () => {
    stop();
    update((previous) => startAnotherSession(cards, previous).progress);
    navigate('#/learn');
  };

  return (
    <div className="complete-page">
      <PageHeader backTo="#/" backLabel="回首页" />
      <div className="celebrate" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, index) => (
          <span key={index} className={`celebrate__bit celebrate__bit--${index % 4}`} />
        ))}
      </div>

      <main className="complete">
        <div className="complete__mark" aria-hidden="true">
          <Icon name="check" size={84} />
        </div>
        <h1>今天认完了</h1>
        <p className="complete__sub">真棒。想再认几个，或者歇一会儿，都行。</p>

        <div className="complete__cards">
          {sessionCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className="complete-card"
              onClick={() => speakWord(card)}
              aria-label={`再听一遍：${card.text}`}
            >
              <span className="complete-card__image">
                <img src={imageUrl(card)} alt="" loading="lazy" />
              </span>
              <span className="complete-card__word">{card.text}</span>
              <span className="complete-card__scene">{SCENE_META[card.scene].short}</span>
              <span className="complete-card__sound" aria-hidden="true">
                <Icon name="speaker" size={22} />
              </span>
            </button>
          ))}
        </div>

        <div className="complete__actions">
          <BigButton variant="primary" size="huge" icon="sparkle" onClick={learnMore}>
            再认三个
          </BigButton>
          <BigButton variant="secondary" icon="home" onClick={() => navigate('#/')}>
            回首页
          </BigButton>
          <BigButton variant="secondary" icon="screen" onClick={() => navigate('#/helper')}>
            帮我看屏幕
          </BigButton>
        </div>

        <p className="complete__note">
          <Icon name="check" size={20} />
          <span>今天这三个字，明天我会再拿出来给你看。</span>
        </p>
      </main>
    </div>
  );
}
