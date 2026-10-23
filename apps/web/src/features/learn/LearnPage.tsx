import { useEffect, useMemo } from 'react';
import {
  completeCard,
  ensureSession,
  localDateKey,
  type Card,
  type DailySession,
} from '@ziban/core';
import { useProgress } from '../../app/ProgressProvider';
import { useSpeech } from '../../app/SpeechProvider';
import { navigate } from '../../app/router';
import { BigButton } from '../../components/BigButton';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { ProgressDots } from '../../components/ProgressDots';
import { cards, getCard } from '../../content/deck';
import { CardStage } from './CardStage';
import { useCardSpeech } from './useCardSpeech';
import { SessionComplete } from './SessionComplete';

export function LearnPage() {
  const { progress, update } = useProgress();
  const { stop } = useSpeech();
  const today = localDateKey();
  const session = progress.session && progress.session.date === today ? progress.session : null;

  // 只在“今天还没有会话”时创建；已完成会话也保留，让 /learn 继续显示“今天认完了”。
  // 不要在 render 里创建——StrictMode 会双调用，可能写入两个会话/两次抽卡。
  useEffect(() => {
    if (progress.session && progress.session.date === today) return;
    update((previous) => ensureSession(cards, previous).progress);
  }, [progress.session, today, update]);

  if (!session) {
    return (
      <div className="learn-loading">
        <PageHeader backTo="#/" backLabel="回首页" />
        <div className="learn-loading__body">
          <span className="loading-orbit" aria-hidden="true">
            <Icon name="sparkle" size={54} />
          </span>
          <p>正在拿出今天的三个字……</p>
        </div>
      </div>
    );
  }

  if (session.completedIds.length >= session.cardIds.length) {
    return <SessionComplete session={session} />;
  }

  const currentId = session.cardIds.find((id) => !session.completedIds.includes(id));
  const card = getCard(currentId);
  const currentIndex = currentId ? session.cardIds.indexOf(currentId) : 0;

  if (!card) {
    return (
      <div className="learn-loading">
        <PageHeader backTo="#/" backLabel="回首页" />
        <div className="learn-loading__body">
          <p>这张卡暂时找不到了。</p>
          <BigButton variant="primary" icon="home" onClick={() => navigate('#/')}>
            回首页
          </BigButton>
        </div>
      </div>
    );
  }

  return (
    <StudyScreen
      key={card.id}
      card={card}
      session={session}
      currentIndex={currentIndex}
      onNext={() => {
        // 先停掉当前卡的朗读，再记完成；否则旧卡的声音会拖到下一张卡。
        stop();
        update((previous) => completeCard(previous, card.id));
      }}
    />
  );
}

interface StudyScreenProps {
  card: Card;
  session: DailySession;
  currentIndex: number;
  onNext: () => void;
}

function StudyScreen({ card, session, currentIndex, onNext }: StudyScreenProps) {
  const { progress, update } = useProgress();
  const speech = useCardSpeech(card, true);
  const remaining = session.cardIds.length - session.completedIds.length - 1;
  const isLast = currentIndex >= session.cardIds.length - 1;
  const slow = progress.settings.rate <= 0.7;

  const toggleSpeed = () => {
    update((previous) => ({
      ...previous,
      settings: { ...previous.settings, rate: previous.settings.rate <= 0.7 ? 0.85 : 0.65 },
    }));
    window.setTimeout(() => speech.playCard(), 250);
  };

  const imageLabel = useMemo(
    () => (card.image.alt ? `看图：${card.image.alt}` : '看图'),
    [card.image.alt],
  );

  return (
    <div className="study">
      <div className="study__top">
        <button
          type="button"
          className="header-button header-button--compact"
          onClick={() => navigate('#/')}
          aria-label="回首页"
        >
          <Icon name="home" size={30} />
          <span>回首页</span>
        </button>

        <ProgressDots
          total={session.cardIds.length}
          completed={session.completedIds.length}
          current={currentIndex}
        />

        <button
          type="button"
          className={`speed-button ${slow ? 'is-slow' : ''}`}
          onClick={toggleSpeed}
          aria-label={slow ? '现在念得慢，点一下恢复正常速度' : '点一下，念得慢一点'}
        >
          <Icon name="turtle" size={28} />
          <span>{slow ? '快一点' : '慢一点'}</span>
        </button>
      </div>

      <main className="study__main">
        <CardStage card={card} speech={speech} />
      </main>

      <div className="study__actions">
        <BigButton
          variant="secondary"
          icon="replay"
          onClick={speech.playCard}
          className="study__replay"
        >
          再念一遍
        </BigButton>
        <BigButton
          variant="primary"
          icon={isLast ? 'check' : 'next'}
          iconPosition={isLast ? 'left' : 'right'}
          size="huge"
          onClick={onNext}
          className="study__next"
        >
          {isLast ? '认完了' : '下一个'}
        </BigButton>
      </div>

      <p className="study__hint">
        <Icon name="ear" size={20} />
        <span>
          {imageLabel}；点字能单独听，点句子听它怎么用。
          {isLast ? ' 就剩这一个了。' : ` 还剩 ${remaining} 个。`}
        </span>
      </p>
    </div>
  );
}
