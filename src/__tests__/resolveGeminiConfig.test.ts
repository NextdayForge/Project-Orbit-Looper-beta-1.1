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

  function setWebRuntime(on: boolean): void {
    if (on) {
      (global as { document?: unknown }).document = {};
    } else {
      delete (global as { document?: unknown }).document;
    }
  }

  afterEach(() => {
    setWebRuntime(false);
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

  it('web: uses the user-provided settings key', () => {
    setWebRuntime(true);
    (global as { __DEV__?: boolean }).__DEV__ = false;
    const settings = { geminiApiKey: 'AIzaUserOwnKey123456' } as Partial<AppSettings>;
    expect(resolveGeminiApiKey(settings)).toBe('AIzaUserOwnKey123456');
    expect(isGeminiConfigured(settings)).toBe(true);
  });

  it('web: never uses the shared proxy, and is unconfigured without a user key', () => {
    setWebRuntime(true);
    process.env.EXPO_PUBLIC_LOOPER_AI_PROXY_URL = 'https://proxy.example.com';
    process.env.EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN = 'beta-token';
    delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    (global as { __DEV__?: boolean }).__DEV__ = false;
    // proxy is configured, but on web it must be ignored → still not available
    expect(resolveGeminiApiKey({ looperPlan: 'free' })).toBeUndefined();
    expect(isGeminiConfigured({ looperPlan: 'free' })).toBe(false);
  });

  it('web: ignores placeholder user keys', () => {
    setWebRuntime(true);
    (global as { __DEV__?: boolean }).__DEV__ = false;
    expect(
      isGeminiConfigured({ geminiApiKey: 'your_api_key_here' } as Partial<AppSettings>)
    ).toBe(false);
  });
});
