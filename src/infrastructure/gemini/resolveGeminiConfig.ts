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
 * The public web build is distributed to anyone with the URL, so it must NOT
 * carry the shared Looper proxy token (it would be extractable from the bundle
 * and billed to us). On web, each user brings their own Gemini API key, stored
 * on-device in settings. Native (APK) is distributed to a controlled audience
 * and keeps using the Looper proxy (our key, hidden inside the Cloudflare Worker).
 *
 * `document` exists in the browser (react-native-web) but not in the native
 * runtime or the Node test environment — a dependency-free web check that avoids
 * importing `react-native` into this jest-tested module.
 */
function isWebRuntime(): boolean {
  return typeof document !== 'undefined';
}

/** User-supplied key from settings — used on web only. */
function resolveUserGeminiApiKey(settings?: Partial<AppSettings>): string | undefined {
  return normalizeGeminiApiKey(settings?.geminiApiKey);
}

/**
 * Direct Gemini API key.
 * - Web: the user's own key from settings (or the dev `.env` key in dev clients).
 * - Native: dev clients only; production/beta APK uses the Looper proxy instead.
 */
export function resolveGeminiApiKey(settings?: Partial<AppSettings>): string | undefined {
  if (isWebRuntime()) {
    const userKey = resolveUserGeminiApiKey(settings);
    if (userKey) {
      return userKey;
    }
    if (isLooperDevClient()) {
      return normalizeGeminiApiKey(process.env.EXPO_PUBLIC_GEMINI_API_KEY);
    }
    return undefined;
  }
  if (canUseCloudAi(settings) && resolveLooperAiProxyConfig()) {
    return undefined;
  }
  if (isLooperDevClient()) {
    return normalizeGeminiApiKey(process.env.EXPO_PUBLIC_GEMINI_API_KEY);
  }
  return undefined;
}

/** True when cloud Gemini can run right now (native proxy, or a direct key). */
export function isGeminiConfigured(settings?: Partial<AppSettings>): boolean {
  if (!isWebRuntime() && canUseCloudAi(settings) && resolveLooperAiProxyConfig()) {
    return true;
  }
  return Boolean(resolveGeminiApiKey(settings));
}

export function createGeminiClient(settings?: Partial<AppSettings>): GeminiClient {
  // Native + entitled → Looper proxy (our key). Web never uses the proxy.
  if (!isWebRuntime()) {
    const proxy = canUseCloudAi(settings) ? resolveLooperAiProxyConfig() : undefined;
    if (proxy) {
      return new GeminiClient({
        proxyUrl: proxy.url,
        proxyToken: proxy.token,
      });
    }
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
