/**
 * Looper-hosted Gemini proxy (Cloudflare Workers).
 * Set via EAS env / .env for beta APK builds — never commit real tokens.
 */

/** Temporary beta: all users get Pro cloud-AI entitlement. Set false before public launch. */
export const BETA_FORCE_PRO_PLAN = true;

export interface LooperAiProxyConfig {
  url: string;
  token: string;
}

export function getLooperAiProxyUrl(): string {
  return process.env.EXPO_PUBLIC_LOOPER_AI_PROXY_URL?.trim() ?? '';
}

export function getLooperAiBetaToken(): string {
  return process.env.EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN?.trim() ?? '';
}

export function isLooperAiProxyConfigured(): boolean {
  return Boolean(getLooperAiProxyUrl() && getLooperAiBetaToken());
}

export function resolveLooperAiProxyConfig(): LooperAiProxyConfig | undefined {
  const url = getLooperAiProxyUrl();
  const token = getLooperAiBetaToken();
  if (!url || !token) {
    return undefined;
  }
  return {
    url: url.replace(/\/$/, ''),
    token,
  };
}
