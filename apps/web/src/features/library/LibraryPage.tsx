import { useEffect, useMemo, useState } from 'react';
import { SCENE_META, SCENE_ORDER, type SceneId } from '@ziban/core';
import { useProgress } from '../../app/ProgressProvider';
import { useSpeech } from '../../app/SpeechProvider';
import { navigate } from '../../app/router';
import { BigButton } from '../../components/BigButton';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { cards, imageUrl } from '../../content/deck';

type Filter = SceneId | 'all';

export function LibraryPage() {
  const { progress } = useProgress();
  const { speak, stop } = useSpeech();
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => () => stop(), [stop]);

  const visible = useMemo(
    () => (filter === 'all' ? cards : cards.filter((card) => card.scene === filter)),
    [filter],
  );

  const learnedCount = Object.keys(progress.cards).length;

  const explain = () =>
    speak({
      text: '这是字库。上面可以选场景。点一张卡片，就能听这个字。',
      segmentId: 'library-help',
      rate: 0.8,
    });

  return (
    <div className="page library-page">
      <PageHeader
        title="字库"
        backTo="#/"
        backLabel="回首页"
        right={
          <button type="button" className="round-button" onClick={explain} aria-label="听说明">
            <Icon name="speaker" size={30} />
          </button>
        }
      />

      <main className="page__main">
        <div className="library-intro">
          <div>
            <h1>看图找字</h1>
            <p>认不清的字，可以按场景一张张找。已经认了 {learnedCount} 个字。</p>
          </div>
          <span className="library-intro__art" aria-hidden="true">
            <Icon name="grid" size={72} />
          </span>
        </div>

        <div className="scene-chips" aria-label="选择场景">
          <button
            type="button"
            aria-pressed={filter === 'all'}
            className={`scene-chip ${filter === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <Icon name="grid" size={26} />
            <span>全部</span>
          </button>
          {SCENE_ORDER.map((sceneId) => {
            const scene = SCENE_META[sceneId];
            return (
              <button
                key={sceneId}
                type="button"
                aria-pressed={filter === sceneId}
                className={`scene-chip ${filter === sceneId ? 'is-active' : ''}`}
                onClick={() => setFilter(sceneId)}
              >
                <Icon name={`scene-${sceneId}`} size={26} />
                <span>{scene.short}</span>
              </button>
            );
          })}
        </div>

        <p className="library-count" aria-live="polite">
          {filter === 'all' ? '全部' : SCENE_META[filter].name} · {visible.length} 张
        </p>

        <div className="card-grid">
          {visible.map((card) => {
            const learned = Boolean(progress.cards[card.id]);
            return (
              <button
                key={card.id}
                type="button"
                className="card-tile"
                onClick={() => {
                  stop();
                  navigate(`#/card/${encodeURIComponent(card.id)}`);
                }}
                aria-label={`${card.text}，${card.meaning}`}
              >
                <span className="card-tile__image">
                  <img src={imageUrl(card)} alt={card.image.alt ?? ''} loading="lazy" />
                  {learned ? (
                    <span className="card-tile__learned" title="已经认过">
                      <Icon name="check" size={18} />
                    </span>
                  ) : null}
                </span>
                <span className="card-tile__word">{card.text}</span>
                {progress.settings.showPinyin ? (
                  <span className="card-tile__pinyin">{card.pinyin.join(' ')}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <div className="empty-state">
            <Icon name="grid" size={54} />
            <p>这个场景还没有卡片。</p>
            <BigButton variant="secondary" onClick={() => setFilter('all')}>
              看全部
            </BigButton>
          </div>
        ) : null}
      </main>
    </div>
  );
}
