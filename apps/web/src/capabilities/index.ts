/**
 * 附加功能的“兼容性清单”。
 *
 * 这一版真正能用的是：粘贴文字朗读 + 自带文章逐句朗读/解释。
 * 屏幕框选、任意网页正文、发音评估都需要桌面壳或本地模型；
 * 接口和 UI 入口先留好，不让它们破坏基础功能的体验。
 */

export * from './contracts';
export { localExplainer } from './explainer';

export type CapabilityState = 'ready' | 'text-only' | 'desktop-only' | 'planned';

export interface CapabilityStatus {
  id: string;
  name: string;
  state: CapabilityState;
  detail: string;
}

export const CAPABILITIES: CapabilityStatus[] = [
  {
    id: 'speech',
    name: '字卡朗读',
    state: 'ready',
    detail: '默认使用这台电脑自带的中文语音，逐字高亮跟读；也可在设置里选云端 TTS（自己填 API Key，会联网）。',
  },
  {
    id: 'read-text',
    name: '朗读屏幕文字',
    state: 'text-only',
    detail: '实验版请先把文字粘贴进来；桌面版会接系统 OCR。',
  },
  {
    id: 'web-reader',
    name: '朗读网页',
    state: 'text-only',
    detail: '实验版提供自带示例文章和粘贴正文，任意网址需要桌面版或浏览器扩展。',
  },
  {
    id: 'explain',
    name: '讲一讲',
    state: 'text-only',
    detail: '离线词表能解释常用办事词；更自由的讲解要接本地小模型。',
  },
  {
    id: 'screen-ocr',
    name: '光标取词（看屏幕）',
    state: 'desktop-only',
    detail:
      '电脑版：不用框选，鼠标停在哪就查哪；只截光标周围一小块，不录整屏。网页版请先用粘贴文字。',
  },
  {
    id: 'asr',
    name: '跟读纠正',
    state: 'planned',
    detail: 'v0.1 不做自动评分，避免方言被误判；先保留回声跟读的位置。',
  },
];
