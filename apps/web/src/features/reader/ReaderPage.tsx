import { useEffect, useMemo, useRef, useState } from 'react';
import { useProgress } from '../../app/ProgressProvider';
import { useSpeech } from '../../app/SpeechProvider';
import { navigate } from '../../app/router';
import { BigButton } from '../../components/BigButton';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { articleById, type Article } from '../../data/articles';

/**
 * 自带文章的阅读器。
 *
 * 重要边界：
 * - `src/data/articles.ts` 里的 summary / plain 都是人工写的，不是模型生成；
 * - 逐句朗读用 segmentId `read-*`，单句解释用 `plain-*`，两者互斥，
 *   避免“点讲一句”时整篇朗读还在继续；
 * - 当前只支持本地文章 id，不支持任意 URL；跨域正文抽取是后续 PageReader 的事。
 */
export function ReaderPage({ id }: { id: string }) {
  const article = articleById.get(id);
  if (!article) {
    return (
      <div className="page">
        <PageHeader title="读文章" backTo="#/helper" backLabel="回上一步" />
        <main className="empty-state">
          <Icon name="question" size={64} />
          <p>没找到这篇文章。</p>
          <BigButton variant="primary" icon="screen" onClick={() => navigate('#/helper')}>
            回帮我看屏幕
          </BigButton>
        </main>
      </div>
    );
  }
  return <ArticleReader article={article} />;
}

function ArticleReader({ article }: { article: Article }) {
  const { progress } = useProgress();
  const { speak, speakSequence, stop, activeSegment, speaking } = useSpeech();
  const [selected, setSelected] = useState<number | null>(null);
  const [reading, setReading] = useState(false);
  const sentenceRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rate = progress.settings.rate;

  const activeIndex = useMemo(() => {
    if (!activeSegment) return null;
    if (activeSegment.startsWith('read-')) {
      const index = Number(activeSegment.slice(5));
      return Number.isFinite(index) ? index : null;
    }
    return null;
  }, [activeSegment]);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (!reading || activeIndex === null) return;
    const node = sentenceRefs.current[activeIndex];
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIndex, reading]);

  const readAll = () => {
    setSelected(null);
    setReading(true);
    speakSequence(
      article.sentences.map((sentence, index) => ({
        text: sentence.text,
        segmentId: `read-${index}`,
        rate,
      })),
      { onFinish: () => setReading(false) },
    );
  };

  const stopAll = () => {
    stop();
    setReading(false);
  };

  const readSentence = (index: number) => {
    const sentence = article.sentences[index];
    if (!sentence) return;
    setReading(false);
    speak({ text: sentence.text, segmentId: `read-${index}`, rate });
  };

  const toggleExplain = (index: number) => {
    const sentence = article.sentences[index];
    if (!sentence) return;
    if (selected === index) {
      setSelected(null);
      if (activeSegment === `plain-${index}`) stop();
      return;
    }
    setSelected(index);
    if (speaking) stop();
    speak({ text: sentence.plain, segmentId: `plain-${index}`, rate });
  };

  const readSummary = () => {
    setReading(false);
    speakSequence(
      article.summary.map((text, index) => ({
        text,
        segmentId: `summary-${index}`,
        rate,
      })),
    );
  };

  return (
    <div className="page reader-page">
      <PageHeader title="读文章" backTo="#/helper" backLabel="回上一步" />

      <main className="page__main reader">
        <header className="reader-head">
          <div className="reader-head__image">
            <img src={article.image} alt={article.imageAlt} />
          </div>
          <div className="reader-head__copy">
            <span className="reader-head__badge">
              <Icon name="book" size={20} />
              实验示例
            </span>
            <h1>{article.title}</h1>
            <p>{article.subtitle}</p>
            <div className="reader-head__actions">
              {reading ? (
                <BigButton variant="danger" icon="stop" onClick={stopAll}>
                  停下来
                </BigButton>
              ) : (
                <BigButton variant="primary" icon="speaker" onClick={readAll}>
                  从头念
                </BigButton>
              )}
              <BigButton variant="secondary" icon="bulb" onClick={readSummary}>
                三句话讲明白
              </BigButton>
            </div>
          </div>
        </header>

        {article.risk ? (
          <div className={`risk-card risk-card--${article.risk.level}`} role="note">
            <span className="risk-card__icon">
              <Icon name="shield" size={34} />
            </span>
            <div className="risk-card__body">
              <strong>{article.risk.title}</strong>
              <p>{article.risk.advice}</p>
            </div>
            <button
              type="button"
              className="round-button round-button--small"
              onClick={() =>
                speak({
                  text: `${article.risk?.title}。${article.risk?.advice}`,
                  segmentId: 'article-risk',
                  rate,
                })
              }
              aria-label="听提醒"
            >
              <Icon name="speaker" size={26} />
            </button>
          </div>
        ) : null}

        <section className="reader-sentences" aria-label="文章内容">
          {article.sentences.map((sentence, index) => {
            const isActive = activeIndex === index;
            const isOpen = selected === index;
            return (
              <div
                key={`${sentence.text}-${index}`}
                ref={(node) => {
                  sentenceRefs.current[index] = node;
                }}
                className={`sentence ${isActive ? 'is-active' : ''} ${isOpen ? 'is-open' : ''}`}
              >
                <div className="sentence__row">
                  <button
                    type="button"
                    className="sentence__read"
                    onClick={() => readSentence(index)}
                    aria-label={`念第 ${index + 1} 句`}
                  >
                    <span className="sentence__index">{index + 1}</span>
                    <span className="sentence__text">{sentence.text}</span>
                    <Icon name="speaker" size={26} />
                  </button>
                  <button
                    type="button"
                    className="sentence__explain"
                    onClick={() => toggleExplain(index)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? '收起解释' : '讲这句话'}
                  >
                    <Icon name="bulb" size={26} />
                    <span>{isOpen ? '收起' : '讲'}</span>
                  </button>
                </div>

                {isOpen ? (
                  <div className="sentence__plain">
                    <Icon name="bulb" size={26} />
                    <p>{sentence.plain}</p>
                    <button
                      type="button"
                      className="sentence__plain-sound"
                      onClick={() =>
                        speak({ text: sentence.plain, segmentId: `plain-${index}`, rate })
                      }
                      aria-label="再听一遍解释"
                    >
                      <Icon name="speaker" size={22} />
                      听
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>

        <section className="summary-card" aria-labelledby="summary-title">
          <div className="summary-card__head">
            <span className="summary-card__icon">
              <Icon name="bulb" size={34} />
            </span>
            <div>
              <h2 id="summary-title">三句话讲明白</h2>
              <p>这段话大概在说什么</p>
            </div>
            <button
              type="button"
              className="round-button round-button--small"
              onClick={readSummary}
              aria-label="听这三句话"
            >
              <Icon name="speaker" size={26} />
            </button>
          </div>
          <ol className="summary-list">
            {article.summary.map((line, index) => (
              <li key={`${line}-${index}`}>
                <button
                  type="button"
                  onClick={() => speak({ text: line, segmentId: `summary-${index}`, rate })}
                >
                  <span className="summary-list__num">{index + 1}</span>
                  <span>{line}</span>
                  <Icon name="speaker" size={22} />
                </button>
              </li>
            ))}
          </ol>
        </section>

        {article.note ? (
          <p className="reader-note">
            <Icon name="info" size={20} />
            <span>{article.note}</span>
          </p>
        ) : null}
      </main>
    </div>
  );
}
