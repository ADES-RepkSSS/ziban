import { useEffect, useState } from 'react';
import { markOnboarded, type Card } from '@ziban/core';
import { useProgress } from '../../app/ProgressProvider';
import { useSpeech } from '../../app/SpeechProvider';
import { navigate } from '../../app/router';
import { BigButton } from '../../components/BigButton';
import { Icon } from '../../components/Icon';
import { cards, imageUrl } from '../../content/deck';

const STEPS = [
  {
    title: '字，会说话',
    body: '看到一个不认识的字，点一下，它就念给你听。',
    narration: '我是字伴。看到一个不认识的字，点一下，我就念给你听。',
  },
  {
    title: '每天认三个字',
    body: '有图，有声音。不考试，也不催你。',
    narration: '每天认三个字。有图，有声音，不考试，也不催你。',
  },
  {
    title: '卡住了，就点这里',
    body: '屏幕上的字看不懂，我念给你听，也讲给你听。',
    narration: '用电脑卡住了，就点帮我看屏幕。我念给你听，也讲给你听。',
  },
];

const demoCards = ['c_yao', 'c_quqian', 'c_weixin']
  .map((id) => cards.find((card) => card.id === id))
  .filter((card): card is Card => Boolean(card));

export function WelcomePage() {
  const { progress, update } = useProgress();
  const { speak, stop, supported } = useSpeech();
  const [step, setStep] = useState(0);
  const current = STEPS[step] ?? STEPS[0]!;

  useEffect(() => {
    speak({ text: current.narration, segmentId: 'welcome', rate: 0.8 });
    return () => stop();
  }, [current.narration, speak, stop]);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    update((previous) => markOnboarded(previous));
    stop();
    navigate('#/learn');
  };

  const replay = () => speak({ text: current.narration, segmentId: 'welcome', rate: 0.75 });

  const speakDemo = () => {
    speak({ text: '药。生病时吃的东西。', segmentId: 'welcome-demo', rate: 0.8 });
  };

  return (
    <div className="welcome">
      <header className="welcome__top">
        <span className="brand-mark" aria-label="字伴">
          <span className="brand-mark__seal" aria-hidden="true">
            字
          </span>
          <span className="brand-mark__name">字伴</span>
        </span>
        <span className="welcome__step">
          {STEPS.map((item, index) => (
            <span
              key={item.title}
              className={`welcome__dot ${index === step ? 'is-current' : ''} ${
                index < step ? 'is-done' : ''
              }`}
            />
          ))}
        </span>
      </header>

      <main className="welcome__main">
        <div className="welcome__art">
          {step === 0 ? (
            <div className="mini-card mini-card--tilt">
              <span className="mini-card__image">
                <img src="./images/medicine-box.svg" alt="一盒药和两粒白色的药片" />
              </span>
              <span className="mini-card__word">药</span>
              <button
                type="button"
                className="mini-card__sound"
                onClick={speakDemo}
                aria-label="听一听药怎么念"
              >
                <Icon name="speaker" size={30} />
              </button>
              <span className="sound-ring sound-ring--one" aria-hidden="true" />
              <span className="sound-ring sound-ring--two" aria-hidden="true" />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="welcome__stack">
              {demoCards.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  className={`mini-card mini-card--small mini-card--stack-${index}`}
                  onClick={() =>
                    speak({
                      text: `${card.text}。${card.meaning}`,
                      segmentId: `welcome-${card.id}`,
                      rate: 0.8,
                    })
                  }
                  aria-label={`听 ${card.text}`}
                >
                  <span className="mini-card__image">
                    <img src={imageUrl(card)} alt={card.image.alt ?? ''} />
                  </span>
                  <span className="mini-card__word">{card.text}</span>
                </button>
              ))}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="screen-demo">
              <div className="screen-demo__bar" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="screen-demo__lines" aria-hidden="true">
                <span className="screen-demo__line screen-demo__line--long" />
                <span className="screen-demo__line" />
                <span className="screen-demo__line screen-demo__line--short" />
              </div>
              <button
                type="button"
                className="screen-demo__read"
                onClick={() =>
                  speak({
                    text: '请到二号窗口办理。',
                    segmentId: 'welcome-screen',
                    rate: 0.8,
                  })
                }
              >
                <Icon name="speaker" size={34} />
                念给我听
              </button>
            </div>
          ) : null}
        </div>

        <div className="welcome__copy">
          <span className="welcome__eyebrow">
            <Icon name="sparkle" size={22} />
            {progress.onboarded ? '再看一遍' : '第一次见'}
          </span>
          <h1>{current.title}</h1>
          <p>{current.body}</p>
          {!supported ? (
            <p className="inline-alert" role="status">
              <Icon name="info" size={22} />
              这个浏览器不能发声，但字和图片都还能看。
            </p>
          ) : null}
        </div>
      </main>

      <footer className="welcome__actions">
        <BigButton variant="secondary" icon="speaker" onClick={replay}>
          再听一遍
        </BigButton>
        <BigButton variant="primary" size="huge" icon={step === 2 ? 'check' : 'next'} onClick={next}>
          {step === 2 ? '开始认字' : '下一步'}
        </BigButton>
      </footer>

      <p className="welcome__footnote">
        没有广告，不收费。学过的字只存在这台电脑里。
      </p>
    </div>
  );
}
