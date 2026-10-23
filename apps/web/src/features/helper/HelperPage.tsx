import { useEffect, useMemo, useState } from 'react';
import {
  assessRisk,
  cleanForSpeech,
  medicalCaution,
  splitForSpeech,
} from '@ziban/core';
import { useProgress } from '../../app/ProgressProvider';
import { useSpeech } from '../../app/SpeechProvider';
import { navigate } from '../../app/router';
import { BigButton } from '../../components/BigButton';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { localExplainer } from '../../capabilities/explainer';
import { getDesktopBridge } from '../../capabilities/desktop';
import { articles } from '../../data/articles';

/**
 * “帮我看屏幕”的 v0.1 文本路径。
 *
 * 这里刻意不接 OCR / 网页抓取：
 * - 文字来源只有两个：用户主动粘贴的文本、打包在 src/data/articles.ts 的示例文章；
 * - 解释只走 capabilities/explainer（当前是离线词表），没有把握就返回 null，
 *   UI 必须显示“只会念，还讲不好”，不能调用任何在线模型补内容；
 * - 风险提示是启发式，不是医疗/法律/金融建议；文案不能变成操作指令。
 *
 * 将来接 Electron OCR / 本地模型时，保持同样的输入输出，不要让这个页面直接依赖平台 API。
 */
export function HelperPage() {
  const desktop = getDesktopBridge();
  const { progress } = useProgress();
  const {
    speak,
    speakSequence,
    stop,
    activeSegment,
    speaking,
  } = useSpeech();
  const [rawText, setRawText] = useState('');
  const [explainOpen, setExplainOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rate = progress.settings.rate;
  const cleaned = useMemo(() => cleanForSpeech(rawText), [rawText]);
  const chunks = useMemo(() => splitForSpeech(cleaned, 42), [cleaned]);
  const explanations = useMemo(
    () => chunks.map((chunk, index) => ({ chunk, index, ...localExplainer.explain(chunk) })),
    [chunks],
  );
  const risk = useMemo(() => assessRisk(cleaned) ?? medicalCaution(cleaned), [cleaned]);
  const hasExplanation = explanations.some((item) => item.plain);

  useEffect(() => () => stop(), [stop]);

  const updateText = (value: string) => {
    setRawText(value);
    setExplainOpen(false);
    setReading(false);
    setNotice(null);
    if (speaking) stop();
  };

  const readAll = () => {
    if (chunks.length === 0) {
      speak({ text: '先把要念的字粘贴进来。', segmentId: 'helper-empty', rate });
      return;
    }
    setExplainOpen(false);
    setReading(true);
    speakSequence(
      chunks.map((chunk, index) => ({
        text: chunk,
        segmentId: `paste-${index}`,
        rate,
      })),
      { onFinish: () => setReading(false) },
    );
  };

  const stopReading = () => {
    stop();
    setReading(false);
  };

  const readChunk = (index: number) => {
    const chunk = chunks[index];
    if (!chunk) return;
    setReading(false);
    speak({ text: chunk, segmentId: `paste-${index}`, rate });
  };

  const explainAll = () => {
    if (chunks.length === 0) {
      speak({ text: '先把要念的字粘贴进来。', segmentId: 'helper-empty', rate });
      return;
    }
    setReading(false);
    stop();
    setExplainOpen(true);
    const speakable = explanations.filter((item) => item.plain).slice(0, 3);
    if (speakable.length > 0) {
      speakSequence(
        speakable.map((item) => ({
          text: item.plain ?? '',
          segmentId: `plain-${item.index}`,
          rate,
        })),
      );
    } else {
      speak({
        text: '这几句话我只能念，还讲不好。',
        segmentId: 'helper-no-plain',
        rate,
      });
    }
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setNotice('剪贴板里没有字。按 Ctrl+V 也可以粘贴。');
        return;
      }
      updateText(text);
      setNotice('字已经放进来了。点“念给我听”。');
    } catch {
      setNotice('浏览器没让读剪贴板。可以点一下上面的框，再按 Ctrl+V。');
    }
  };

  const help = () =>
    speak({
      text: '这是帮你看屏幕。让家里人把字粘贴到框里，再点念给我听。也可以点下面的一篇文章。',
      segmentId: 'helper-help',
      rate: 0.8,
    });

  return (
    <div className="page helper-page">
      <PageHeader
        title="帮我看屏幕"
        backTo="#/"
        backLabel="回首页"
        right={
          <button type="button" className="round-button" onClick={help} aria-label="听说明">
            <Icon name="speaker" size={30} />
          </button>
        }
      />

      <main className="page__main">
        <div className="helper-intro">
          <div>
            <h1>屏幕上的字，我念给你听</h1>
            <p>看不懂的通知、短信、网页，都可以放进来。讲得不对，你就不听我的。</p>
          </div>
          <span className="helper-intro__art" aria-hidden="true">
            <Icon name="screen" size={76} />
          </span>
        </div>

        <div className="helper-grid">
          <section className="panel text-panel" aria-labelledby="text-panel-title">
            <div className="panel__head">
              <h3 id="text-panel-title">把要念的字放进来</h3>
              <div className="panel__tools">
                <button type="button" className="text-tool" onClick={paste}>
                  <Icon name="paste" size={24} />
                  粘贴
                </button>
                <button
                  type="button"
                  className="text-tool"
                  onClick={() => {
                    updateText('');
                    setNotice(null);
                  }}
                  disabled={!rawText}
                >
                  <Icon name="trash" size={24} />
                  清空
                </button>
              </div>
            </div>

            <label className="sr-only" htmlFor="screen-text">
              把屏幕上的文字粘贴到这里
            </label>
            <textarea
              id="screen-text"
              className="screen-text"
              value={rawText}
              onChange={(event) => updateText(event.target.value)}
              placeholder="可以让家里人帮你，把屏幕上的字粘贴到这里。"
              rows={5}
              spellCheck={false}
            />

            {notice ? (
              <p className="helper-notice" role="status">
                <Icon name="info" size={20} />
                {notice}
              </p>
            ) : null}

            <div className="helper-actions">
              {reading ? (
                <BigButton variant="danger" icon="stop" onClick={stopReading}>
                  停下来
                </BigButton>
              ) : (
                <BigButton variant="primary" icon="speaker" onClick={readAll} disabled={!chunks.length}>
                  念给我听
                </BigButton>
              )}
              <BigButton variant="secondary" icon="bulb" onClick={explainAll} disabled={!chunks.length}>
                讲给我听
              </BigButton>
            </div>

            {risk ? (
              <div className={`risk-card risk-card--${risk.level}`} role="note">
                <span className="risk-card__icon">
                  <Icon name="shield" size={30} />
                </span>
                <div className="risk-card__body">
                  <strong>{risk.title}</strong>
                  <p>{risk.advice}</p>
                </div>
                <button
                  type="button"
                  className="round-button round-button--small"
                  onClick={() =>
                    speak({ text: `${risk.title}。${risk.advice}`, segmentId: 'risk', rate })
                  }
                  aria-label="听提醒"
                >
                  <Icon name="speaker" size={24} />
                </button>
              </div>
            ) : null}

            {chunks.length > 0 ? (
              <div className="read-preview" aria-label="要念的内容">
                <div className="read-preview__head">
                  <span>屏幕上的字</span>
                  <span className="read-preview__hint">点一句，只听这一句</span>
                </div>
                {chunks.map((chunk, index) => (
                  <button
                    key={`${chunk}-${index}`}
                    type="button"
                    className={`read-line ${
                      activeSegment === `paste-${index}` ? 'is-active' : ''
                    }`}
                    onClick={() => readChunk(index)}
                  >
                    <span className="read-line__index">{index + 1}</span>
                    <span className="read-line__text">{chunk}</span>
                    <Icon name="speaker" size={24} />
                  </button>
                ))}
              </div>
            ) : null}

            {explainOpen ? (
              <div className="explain-list" aria-live="polite">
                <div className="explain-list__head">
                  <h3>这几句话在说什么</h3>
                  <button
                    type="button"
                    className="text-tool"
                    onClick={() => setExplainOpen(false)}
                    aria-label="收起来"
                  >
                    <Icon name="close" size={24} />
                    收起
                  </button>
                </div>

                {hasExplanation ? (
                  explanations.map((item) => (
                    <div className="explain-item" key={`${item.index}-${item.chunk}`}>
                      <p className="explain-item__source">{item.chunk}</p>
                      {item.plain ? (
                        <>
                          <p className="explain-item__plain">{item.plain}</p>
                          <button
                            type="button"
                            className="explain-item__sound"
                            onClick={() =>
                              speak({
                                text: item.plain ?? '',
                                segmentId: `explain-${item.index}`,
                                rate,
                              })
                            }
                            aria-label="听这句解释"
                          >
                            <Icon name="speaker" size={24} />
                            听解释
                          </button>
                        </>
                      ) : (
                        <p className="explain-item__unknown">这句我只会念，还讲不好。</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="explain-empty">
                    <Icon name="bulb" size={40} />
                    <p>
                      这里没有我熟悉的词。我只能念给你听，不敢乱讲。要让电脑讲得更多，还要等电脑版。
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </section>

          <aside className="helper-side">
            <section className="panel article-panel" aria-labelledby="article-title">
              <div className="panel__head">
                <h3 id="article-title">读一篇文章</h3>
                <span className="panel__hint">点一篇，我念给你听</span>
              </div>
              <div className="article-list">
                {articles.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    className="article-item"
                    onClick={() => {
                      stop();
                      navigate(`#/reader/${encodeURIComponent(article.id)}`);
                    }}
                  >
                    <span className="article-item__image">
                      <img src={article.image} alt="" loading="lazy" />
                    </span>
                    <span className="article-item__text">
                      <span className="article-item__title">{article.title}</span>
                      <span className="article-item__sub">{article.subtitle}</span>
                    </span>
                    <Icon name="chevronRight" size={28} />
                  </button>
                ))}
              </div>
            </section>

            <section className="panel helper-note">
              <span className="helper-note__icon">
                <Icon name="info" size={30} />
              </span>
              <div>
                <h3>{desktop ? '电脑版可以直接看屏幕' : '实验版怎么用'}</h3>
                <p>
                  {desktop
                    ? '把鼠标停在不认识的字上，停一下，小窗就会出来。这里仍然可以粘贴一段文字，让我整段念。'
                    : '网页版看不到别的软件里的字。请家里人把字粘贴到上面；电脑版不用框选，鼠标停在哪就念哪。'}
                </p>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
