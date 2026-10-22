import type { Card } from '@ziban/core';
import { SCENE_META } from '@ziban/core';
import { CardImage } from '../../components/CardImage';
import { Icon } from '../../components/Icon';
import { WordText } from '../../components/WordText';
import { useProgress } from '../../app/ProgressProvider';
import type { useCardSpeech } from './useCardSpeech';

interface CardStageProps {
  card: Card;
  speech: ReturnType<typeof useCardSpeech>;
}

export function CardStage({ card, speech }: CardStageProps) {
  const { progress } = useProgress();
  const scene = SCENE_META[card.scene];

  return (
    <div
      className={`card-stage ${
        progress.settings.textScale === 'large' ? 'text-scale--large' : ''
      }`}
    >
      <div className="card-stage__media">
        <CardImage card={card} onActivate={speech.playImage} size="study" eager />
      </div>

      <div className="card-stage__content">
        <div className="scene-badge">
          <Icon name={`scene-${card.scene}`} size={22} />
          <span>{scene.name}</span>
          <span className="scene-badge__dots" aria-hidden="true">
            ·
          </span>
          <span className="scene-badge__hint">点字，听这个字</span>
        </div>

        <WordText
          card={card}
          activeSegment={speech.activeSegment}
          charIndex={speech.charIndex}
          showPinyin={progress.settings.showPinyin}
          onCharClick={speech.playChar}
        />

        <button
          type="button"
          className={`speech-block speech-block--meaning ${
            speech.activeSegment === 'meaning' ? 'is-speaking' : ''
          }`}
          onClick={speech.playMeaning}
          aria-label={`听意思：${card.meaning}`}
        >
          <span className="speech-block__icon">
            <Icon name="speaker" size={28} />
          </span>
          <span className="speech-block__text">{card.meaning}</span>
        </button>

        {card.sentence ? (
          <button
            type="button"
            className={`speech-block speech-block--sentence ${
              speech.activeSegment === 'sentence' ? 'is-speaking' : ''
            }`}
            onClick={speech.playSentence}
            aria-label={`听例句：${card.sentence}`}
          >
            <span className="speech-block__icon">
              <Icon name="book" size={24} />
            </span>
            <span className="speech-block__text">{card.sentence}</span>
            <span className="speech-block__hint">听它怎么用</span>
          </button>
        ) : null}

        {speech.error ? (
          <p className="inline-alert" role="status">
            <Icon name="info" size={22} />
            {speech.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
