import { canUseCloudAi, isLooperDevClient } from '../../config/aiEntitlement';
import { resolveLooperAiProxyConfig } from '../../config/cloudAiProxy';
import { settingsRepository } from '../../repositories';
import { AppSettings } from '../../types/schedule';
import { GeminiClient } from './GeminiClient';

const PLACEHOLDER_GEMINI_API_KEYS = new Set([
  'your_api_key_here',
  'your-api-key-here',
  'changeme',
]);

function normalizeGeminiApiKey(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (PLACEHOLDER_GEMINI_API_KEYS.has(trimmed.toLowerCase())) {
    return undefined;
  }
  return trimmed;
}

/**
 * Direct Gemini API key — dev clients only (expo start + .env).
 * Production / beta APK must use the Looper AI proxy instead.
 */
export function resolveGeminiApiKey(settings?: Partial<AppSettings>): string | undefined {
  if (canUseCloudAi(settings) && resolveLooperAiProxyConfig()) {
    return undefined;
  }
  if (isLooperDevClient()) {
    return normalizeGeminiApiKey(process.env.EXPO_PUBLIC_GEMINI_API_KEY);
  }
  return undefined;
}

/** True when cloud Gemini can run right now (proxy or dev key). */
export function isGeminiConfigured(settings?: Partial<AppSettings>): boolean {
  if (canUseCloudAi(settings) && resolveLooperAiProxyConfig()) {
    return true;
  }
  return Boolean(resolveGeminiApiKey(settings));
}

export function createGeminiClient(settings?: Partial<AppSettings>): GeminiClient {
  const proxy = canUseCloudAi(settings) ? resolveLooperAiProxyConfig() : undefined;
  if (proxy) {
    return new GeminiClient({
      proxyUrl: proxy.url,
      proxyToken: proxy.token,
    });
  }
  return new GeminiClient({
    apiKey: resolveGeminiApiKey(settings),
  });
}

export async function loadGeminiClient(): Promise<GeminiClient> {
  const settings = await settingsRepository.get();
  return createGeminiClient(settings);
}

export function maskGeminiApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}
