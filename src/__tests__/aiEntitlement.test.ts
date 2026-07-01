import {
  canUseCloudAi,
  isLooperDevClient,
  looperPlanLabel,
  resolveLooperPlan,
} from '../config/aiEntitlement';

describe('aiEntitlement', () => {
  it('defaults to free plan when beta force flag off', () => {
    // BETA_FORCE_PRO_PLAN is true in repo — document expected beta behavior separately.
    expect(resolveLooperPlan({})).toBe('free');
  });

  it('grants cloud entitlement for all users during beta', () => {
    expect(canUseCloudAi({})).toBe(true);
    expect(canUseCloudAi({ looperPlan: 'free' })).toBe(true);
  });

  it('grants cloud entitlement on pro plan', () => {
    expect(resolveLooperPlan({ looperPlan: 'pro' })).toBe('pro');
    expect(resolveLooperPlan({ orbitPlan: 'pro' })).toBe('pro');
    expect(canUseCloudAi({ looperPlan: 'pro' })).toBe(true);
    expect(looperPlanLabel('pro')).toBe('Orbit Looper Pro');
  });

  it('reports dev client only when __DEV__ is true', () => {
    const originalDev = (global as { __DEV__?: boolean }).__DEV__;
    (global as { __DEV__?: boolean }).__DEV__ = true;
    expect(isLooperDevClient()).toBe(true);
    (global as { __DEV__?: boolean }).__DEV__ = false;
    expect(isLooperDevClient()).toBe(false);
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
  });
});
