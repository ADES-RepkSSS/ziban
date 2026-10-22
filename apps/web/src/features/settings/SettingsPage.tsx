import { useEffect, useMemo, useState } from 'react';
import { useProgress } from '../../app/ProgressProvider';
import { useSpeech } from '../../app/SpeechProvider';
import { navigate } from '../../app/router';
import { BigButton } from '../../components/BigButton';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { CAPABILITIES, type CapabilityState } from '../../capabilities';

const RATE_OPTIONS = [
  { value: 0.65, label: '很慢', hint: '一个字一个字地念' },
  { value: 0.85, label: '慢一点', hint: '平常说话的速度' },
  { value: 1.0, label: '正常', hint: '和电视里差不多' },
];

const STATE_LABEL: Record<CapabilityState, string> = {
  ready: '能用',
  'text-only': '实验',
  planned: '还没做',
};

/** 系统语音的名字是英文，老人看不懂；能认出来的就换成“慧慧（女声）”这种。 */
function friendlyVoiceName(name: string): string {
  const known: Array<[RegExp, string]> = [
    [/huihui|慧慧/i, '慧慧（女声）'],
    [/kangkang|康康/i, '康康（男声）'],
    [/yaoyao|瑶瑶/i, '瑶瑶（女声）'],
    [/xiaoxiao|晓晓/i, '晓晓（女声）'],
    [/xiaoyi|晓伊/i, '晓伊（女声）'],
    [/yunxi|云希/i, '云希（男声）'],
    [/yunjian|云健/i, '云健（男声）'],
    [/tingting|婷婷/i, '婷婷（女声）'],
    [/meijia|美佳/i, '美佳（女声）'],
    [/google.*普通话|google.*mandarin/i, '谷歌普通话'],
  ];
  for (const [pattern, label] of known) {
    if (pattern.test(name)) return label;
  }
  return name.replace(/^Microsoft\s+/i, '').replace(/\s*-\s*Chinese.*$/i, '');
}

export function SettingsPage() {
  const { progress, update, reset, storageOk } = useProgress();
  const {
    voices,
    voiceName,
    setVoiceName,
    testVoice,
    speak,
    stop,
    supported,
    error,
    refreshVoices,
  } = useSpeech();
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (!confirming) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirming(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirming]);

  const rate = progress.settings.rate;
  const chineseVoices = useMemo(
    () =>
      voices
        .filter((voice) => voice.lang.toLowerCase().startsWith('zh'))
        .sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name)),
    [voices],
  );

  const changeRate = (value: number) => {
    update((previous) => ({
      ...previous,
      settings: { ...previous.settings, rate: value },
    }));
    speak({ text: '这个速度，你听得清吗？', rate: value, segmentId: 'rate-test' });
  };

  const chooseVoice = (name: string | null) => {
    setVoiceName(name);
    testVoice(name);
    setNotice(name ? `正在试：${name}` : '正在试自动挑选的声音');
  };

  const togglePinyin = () => {
    const next = !progress.settings.showPinyin;
    update((previous) => ({
      ...previous,
      settings: { ...previous.settings, showPinyin: next },
    }));
    speak({ text: next ? '拼音打开了。给家里人看。' : '拼音关上了。', segmentId: 'pinyin-toggle', rate });
  };

  const toggleTextScale = () => {
    const next = progress.settings.textScale === 'large' ? 'normal' : 'large';
    update((previous) => ({
      ...previous,
      settings: { ...previous.settings, textScale: next },
    }));
    speak({ text: next === 'large' ? '字变大了。' : '字变回原来的大小。', segmentId: 'scale-toggle', rate });
  };

  const help = () =>
    speak({
      text: '这里是设置。可以让家里人帮你调声音和速度。调好了，就回首页。',
      segmentId: 'settings-help',
      rate: 0.8,
    });

  return (
    <div className="page settings-page">
      <PageHeader
        title="设置"
        backTo="#/"
        backLabel="回首页"
        right={
          <button type="button" className="round-button" onClick={help} aria-label="听说明">
            <Icon name="speaker" size={30} />
          </button>
        }
      />

      <main className="page__main settings">
        <h1 className="sr-only">设置</h1>
        <p className="settings__intro">
          <Icon name="info" size={22} />
          <span>这里可以让家里人帮你调。不用一次调好，用着不舒服再回来。</span>
        </p>

        {!storageOk ? (
          <p className="inline-alert" role="status">
            <Icon name="info" size={22} />
            这台电脑不让记事。学过的字，下次可能不记得。
          </p>
        ) : null}

        <section className="settings-group" aria-labelledby="rate-title">
          <div className="settings-group__head">
            <h2 id="rate-title">念得快一点，还是慢一点？</h2>
            <p>点一下就能听。</p>
          </div>
          <div className="option-grid" role="radiogroup" aria-labelledby="rate-title">
            {RATE_OPTIONS.map((option) => {
              const checked = Math.abs(rate - option.value) < 0.03;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={`option-card ${checked ? 'is-checked' : ''}`}
                  onClick={() => changeRate(option.value)}
                >
                  <span className="option-card__label">{option.label}</span>
                  <span className="option-card__hint">{option.hint}</span>
                  <span className="option-card__check" aria-hidden="true">
                    {checked ? <Icon name="check" size={24} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="settings-group" aria-labelledby="voice-title">
          <div className="settings-group__head">
            <h2 id="voice-title">用哪个声音？</h2>
            <p>点一下，就能听到这个声音。优先用本机的声音，不联网。</p>
          </div>

          {!supported ? (
            <div className="settings-note settings-note--warn">
              这个浏览器不能发声。可以换用 Edge 或 Chrome，再回来试试。
            </div>
          ) : null}

          {error ? <p className="inline-alert">{error}</p> : null}

          <div className="voice-list" role="radiogroup" aria-labelledby="voice-title">
            <button
              type="button"
              role="radio"
              aria-checked={voiceName === null}
              className={`voice-row ${voiceName === null ? 'is-checked' : ''}`}
              onClick={() => chooseVoice(null)}
            >
              <span className="voice-row__icon">
                <Icon name="sparkle" size={26} />
              </span>
              <span className="voice-row__text">
                <span className="voice-row__name">自动挑选</span>
                <span className="voice-row__meta">推荐。会用这台电脑最合适的中文声音。</span>
              </span>
              {voiceName === null ? <Icon name="check" size={26} /> : null}
            </button>

            {chineseVoices.map((voice) => (
              <button
                key={voice.name}
                type="button"
                role="radio"
                aria-checked={voiceName === voice.name}
                className={`voice-row ${voiceName === voice.name ? 'is-checked' : ''}`}
                onClick={() => chooseVoice(voice.name)}
              >
                <span className="voice-row__icon">
                  <Icon name="speaker" size={26} />
                </span>
                <span className="voice-row__text">
                  <span className="voice-row__name">{friendlyVoiceName(voice.name)}</span>
                  <span className="voice-row__meta">
                    {voice.name} · {voice.lang} · {voice.localService ? '离线' : '在线'}
                  </span>
                </span>
                {voiceName === voice.name ? <Icon name="check" size={26} /> : null}
              </button>
            ))}
          </div>

          {chineseVoices.length === 0 ? (
            <div className="settings-note">
              还没找到中文声音。点下面“再找一找”；如果还是没有，需要在系统设置里安装中文语音。
            </div>
          ) : null}

          <button
            type="button"
            className="text-tool settings__refresh"
            onClick={() => {
              refreshVoices();
              setNotice('又找了一遍。找到声音会列在上面。');
            }}
          >
            <Icon name="replay" size={24} />
            再找一找
          </button>
          {notice ? (
            <p className="helper-notice" role="status">
              <Icon name="info" size={20} />
              {notice}
            </p>
          ) : null}
        </section>

        <section className="settings-group" aria-labelledby="display-title">
          <div className="settings-group__head">
            <h2 id="display-title">看得清吗？</h2>
            <p>都是给家里人看的辅助选项，平时不用管。</p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={progress.settings.showPinyin}
            className="switch-row"
            onClick={togglePinyin}
          >
            <span className="switch-row__icon">
              <Icon name="textLines" size={28} />
            </span>
            <span className="switch-row__text">
              <span className="switch-row__name">显示拼音</span>
              <span className="switch-row__meta">默认关着。不教拼音，只给家人做参考。</span>
            </span>
            <span className={`switch ${progress.settings.showPinyin ? 'is-on' : ''}`} aria-hidden="true">
              <span />
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={progress.settings.textScale === 'large'}
            className="switch-row"
            onClick={toggleTextScale}
          >
            <span className="switch-row__icon">
              <Icon name="image" size={28} />
            </span>
            <span className="switch-row__text">
              <span className="switch-row__name">字再大一点</span>
              <span className="switch-row__meta">把卡片上的字放大一些。</span>
            </span>
            <span
              className={`switch ${progress.settings.textScale === 'large' ? 'is-on' : ''}`}
              aria-hidden="true"
            >
              <span />
            </span>
          </button>
        </section>

        <section className="settings-group" aria-labelledby="data-title">
          <div className="settings-group__head">
            <h2 id="data-title">学习记录</h2>
            <p>
              已经认了 {Object.keys(progress.cards).length} 个字，完成{' '}
              {progress.stats.sessionsFinished} 次。
            </p>
          </div>
          <div className="settings-row">
            <div>
              <strong>只存在这台电脑里</strong>
              <p>不上传、不联网。清除以后，学过的字会从头开始。</p>
            </div>
            <BigButton variant="danger" icon="trash" onClick={() => setConfirming(true)}>
              清除记录
            </BigButton>
          </div>
        </section>

        <section className="settings-group" aria-labelledby="caps-title">
          <div className="settings-group__head">
            <h2 id="caps-title">这台电脑能做到什么</h2>
            <p>实验版的功能边界，写清楚，不让你猜。</p>
          </div>
          <div className="capability-list">
            {CAPABILITIES.map((capability) => (
              <div key={capability.id} className="capability-row">
                <span className={`capability-badge capability-badge--${capability.state}`}>
                  {STATE_LABEL[capability.state]}
                </span>
                <div className="capability-row__text">
                  <strong>{capability.name}</strong>
                  <p>{capability.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="about">
          <h2>关于字伴</h2>
          <p>
            字伴 v0.1 实验版。为不识字的老人做，公益、开源、没有广告、没有内购、没有账号。
          </p>
          <p>
            代码 Apache-2.0；词表与释义 CC BY-SA 4.0；配图为项目手绘 SVG，CC BY-SA 4.0。
            拼音只作内部数据，不用于教学。
          </p>
          <p className="about__draft">
            内容状态：draft。50 张卡片是原型内容，还没有经过正式审校，请勿直接对外发布。
          </p>
        </section>
      </main>

      {confirming ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirming(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="modal__icon" aria-hidden="true">
              <Icon name="trash" size={46} />
            </span>
            <h2 id="confirm-title">要把学习记录清掉吗？</h2>
            <p>清掉以后，学过的字会从头开始。这个动作不能反悔。</p>
            <div className="modal__actions">
              <BigButton variant="secondary" autoFocus onClick={() => setConfirming(false)}>
                再想想
              </BigButton>
              <BigButton
                variant="danger"
                icon="trash"
                onClick={() => {
                  reset();
                  setConfirming(false);
                  navigate('#/welcome');
                }}
              >
                清掉
              </BigButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
