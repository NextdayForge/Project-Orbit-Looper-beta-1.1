import {
  isGeminiConfigured,
  maskGeminiApiKey,
  resolveGeminiApiKey,
} from '../infrastructure/gemini/resolveGeminiConfig';
import { AppSettings } from '../types/schedule';

describe('resolveGeminiConfig', () => {
  const originalGeminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const originalProxyUrl = process.env.EXPO_PUBLIC_LOOPER_AI_PROXY_URL;
  const originalProxyToken = process.env.EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN;
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;

  afterEach(() => {
    if (originalGeminiKey === undefined) {
      delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    } else {
      process.env.EXPO_PUBLIC_GEMINI_API_KEY = originalGeminiKey;
    }
    if (originalProxyUrl === undefined) {
      delete process.env.EXPO_PUBLIC_LOOPER_AI_PROXY_URL;
    } else {
      process.env.EXPO_PUBLIC_LOOPER_AI_PROXY_URL = originalProxyUrl;
    }
    if (originalProxyToken === undefined) {
      delete process.env.EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN;
    } else {
      process.env.EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN = originalProxyToken;
    }
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it('ignores legacy settings api keys in dev', () => {
    process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'env-key';
    (global as { __DEV__?: boolean }).__DEV__ = true;
    expect(
      resolveGeminiApiKey({ geminiApiKey: 'settings-key' } as Partial<AppSettings> & {
        geminiApiKey: string;
      })
    ).toBe('env-key');
  });

  it('uses env key only in dev clients without proxy', () => {
    delete process.env.EXPO_PUBLIC_LOOPER_AI_PROXY_URL;
    delete process.env.EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN;
    process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'env-key';
    (global as { __DEV__?: boolean }).__DEV__ = true;
    expect(resolveGeminiApiKey({})).toBe('env-key');
    (global as { __DEV__?: boolean }).__DEV__ = false;
    expect(resolveGeminiApiKey({})).toBeUndefined();
  });

  it('ignores placeholder dev api keys', () => {
    delete process.env.EXPO_PUBLIC_LOOPER_AI_PROXY_URL;
    delete process.env.EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN;
    process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'your_api_key_here';
    (global as { __DEV__?: boolean }).__DEV__ = true;
    expect(resolveGeminiApiKey({})).toBeUndefined();
    expect(isGeminiConfigured({})).toBe(false);
  });

  it('is unavailable without proxy or dev key during beta', () => {
    delete process.env.EXPO_PUBLIC_LOOPER_AI_PROXY_URL;
    delete process.env.EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN;
    delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    (global as { __DEV__?: boolean }).__DEV__ = true;
    expect(isGeminiConfigured({ looperPlan: 'free' })).toBe(false);
  });

  it('uses proxy when configured (beta all-pro)', () => {
    process.env.EXPO_PUBLIC_LOOPER_AI_PROXY_URL = 'https://proxy.example.com';
    process.env.EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN = 'beta-token';
    (global as { __DEV__?: boolean }).__DEV__ = false;
    expect(resolveGeminiApiKey({ looperPlan: 'free' })).toBeUndefined();
    expect(isGeminiConfigured({ looperPlan: 'free' })).toBe(true);
  });

  it('masks api keys for display', () => {
    expect(maskGeminiApiKey('AIzaSyABCDEF123456789')).toMatch(/^AIza••••/);
  });
});
