import { AppSettings } from '../../types/schedule';
import { canUseCloudAi, isLooperDevClient } from '../../config/aiEntitlement';
import { isLooperAiProxyConfigured } from '../../config/cloudAiProxy';
import { APP_AI_LABEL, APP_PRO_PLAN } from '../../config/brand';
import { isGeminiConfigured } from '../../infrastructure/gemini/resolveGeminiConfig';

export type AiEngine = 'gemini' | 'local';

export interface AiCapabilityStatus {
  /** Session placement — intentionally local (UserModel-driven). Architecture v1 Sprint 5. */
  placement: AiEngine;
  /** DayType / Capacity / Learning — always local. */
  planningCore: AiEngine;
  /** Natural-language day plan explanation and consultation. */
  coach: AiEngine;
  /** Free-text reflection → mood/energy/wins/blockers. */
  reflectionExtract: AiEngine;
  /** Task title → estimated duration and category (language only). */
  taskDurationEstimate: AiEngine;
  /** User has Orbit Pro (or future paid tier) entitlement for cloud AI. */
  cloudAiEntitled: boolean;
  /** Cloud Gemini is available right now (entitlement + key/token). */
  cloudAiAvailable: boolean;
  /** @deprecated Use cloudAiAvailable */
  geminiConfigured: boolean;
}

/**
 * Single source of truth for where Orbit uses Gemini vs local intelligence.
 *
 * Architecture v1: Gemini is for language understanding (brief, reflection, coach).
 * Scheduling intelligence runs locally against UserModel so learning stays on-device.
 */
export function getAiCapabilityStatus(settings?: Partial<AppSettings>): AiCapabilityStatus {
  const cloudAiEntitled = canUseCloudAi(settings);
  const cloudAiAvailable = isGeminiConfigured(settings);
  const llmEngine: AiEngine = cloudAiAvailable ? 'gemini' : 'local';

  return {
    placement: 'local',
    planningCore: 'local',
    coach: llmEngine,
    reflectionExtract: llmEngine,
    taskDurationEstimate: llmEngine,
    cloudAiEntitled,
    cloudAiAvailable,
    geminiConfigured: cloudAiAvailable,
  };
}

export function aiEngineLabel(engine: AiEngine): string {
  return engine === 'gemini' ? 'Gemini' : 'ローカル';
}

export function getCloudAiUnavailableTitle(): string {
  return `${APP_AI_LABEL} は利用できません`;
}

/** User-facing hint when cloud Gemini is not reachable (entitlement alone is not enough). */
export function getCloudAiUnavailableMessage(settings?: Partial<AppSettings>): string {
  if (isGeminiConfigured(settings)) {
    return '';
  }

  if (isLooperDevClient()) {
    return 'Cloud AI プロキシ（EXPO_PUBLIC_LOOPER_AI_PROXY_URL + BETA_TOKEN）または EXPO_PUBLIC_GEMINI_API_KEY が未設定です。設定画面で接続状態を確認してください。';
  }

  if (canUseCloudAi(settings) && !isLooperAiProxyConfigured()) {
    return 'Cloud AI プロキシに接続できません。ベータ設定またはネットワークを確認してください。';
  }

  return `${APP_AI_LABEL} は ${APP_PRO_PLAN} で利用できます。`;
}
