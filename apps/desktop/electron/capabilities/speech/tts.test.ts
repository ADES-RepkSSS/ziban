import { describe, expect, it } from 'vitest';
import { qwenSpeechEndpoint, speechEndpoint, validateSpeechEndpoint } from './tts';

describe('cloud TTS endpoint', () => {
  it('补全 /v1/audio/speech，不重复拼接', () => {
    expect(speechEndpoint('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/audio/speech',
    );
    expect(speechEndpoint('https://api.openai.com/v1/audio/speech')).toBe(
      'https://api.openai.com/v1/audio/speech',
    );
    expect(speechEndpoint('http://127.0.0.1:8000/v1/')).toBe(
      'http://127.0.0.1:8000/v1/audio/speech',
    );
    expect(qwenSpeechEndpoint('https://dashscope.aliyuncs.com/api/v1')).toBe(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    );
    expect(
      qwenSpeechEndpoint(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      ),
    ).toBe('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
  });

  it('拒绝 file:// 和普通 http 公网地址', () => {
    expect(validateSpeechEndpoint('file:///etc/passwd')).not.toBeNull();
    expect(validateSpeechEndpoint('http://api.example.com/v1')).not.toBeNull();
    expect(validateSpeechEndpoint('https://user:pass@api.example.com/v1')).not.toBeNull();
    expect(validateSpeechEndpoint('https://api.example.com/v1?x=1')).not.toBeNull();
    expect(validateSpeechEndpoint('http://127.0.0.1:8000/v1')).toBeNull();
  });

  it('空网址给出可读提示', () => {
    expect(validateSpeechEndpoint('')).toContain('网址');
  });
});
