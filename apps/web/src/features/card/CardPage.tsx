import { useEffect } from 'react';
import { useSpeech } from '../../app/SpeechProvider';
import { navigate } from '../../app/router';
import { BigButton } from '../../components/BigButton';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { getCard } from '../../content/deck';
import { CardStage } from '../learn/CardStage';
import { useCardSpeech } from '../learn/useCardSpeech';

export function CardPage({ id }: { id: string }) {
  const card = getCard(id);
  const { stop } = useSpeech();

  useEffect(() => () => stop(), [stop]);

  if (!card) {
    return (
      <div className="page">
        <PageHeader title="看字" backTo="#/library" backLabel="回字库" />
        <main className="empty-state">
          <Icon name="question" size={64} />
          <p>没找到这张卡。</p>
          <BigButton variant="primary" icon="grid" onClick={() => navigate('#/library')}>
            回字库
          </BigButton>
        </main>
      </div>
    );
  }

  return <CardDetail card={card} />;
}

function CardDetail({ card }: { card: NonNullable<ReturnType<typeof getCard>> }) {
  const speech = useCardSpeech(card, true);

  return (
    <div className="page card-page">
      <PageHeader title="看字" backTo="#/library" backLabel="回字库" />
      <main className="card-page__main">
        <CardStage card={card} speech={speech} />
      </main>
      <div className="card-page__actions">
        <BigButton variant="secondary" icon="replay" onClick={speech.playCard}>
          再念一遍
        </BigButton>
        <BigButton variant="primary" icon="grid" onClick={() => navigate('#/library')}>
          回字库
        </BigButton>
      </div>
    </div>
  );
}
