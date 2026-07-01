import { APP_PRO_PLAN } from './brand';
import { BETA_FORCE_PRO_PLAN } from './cloudAiProxy';
import { AppSettings, LooperPlan } from '../types/schedule';

/** True for `expo start` / dev clients — not for store release builds. */
export function isLooperDevClient(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function resolveLooperPlan(
  settings?: Partial<AppSettings> & { orbitPlan?: LooperPlan }
): LooperPlan {
  const plan = settings?.looperPlan ?? settings?.orbitPlan;
  return plan === 'pro' ? 'pro' : 'free';
}

/**
 * Whether the user is entitled to Looper-hosted cloud AI (Gemini via Looper backend).
 * Subscription verification will plug in here later.
 */
export function canUseCloudAi(
  settings?: Partial<AppSettings> & { orbitPlan?: LooperPlan }
): boolean {
  if (BETA_FORCE_PRO_PLAN) {
    return true;
  }
  return resolveLooperPlan(settings) === 'pro';
}

export function looperPlanLabel(plan: LooperPlan): string {
  return plan === 'pro' ? APP_PRO_PLAN : '無料プラン';
}
