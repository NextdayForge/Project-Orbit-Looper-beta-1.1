import { extract } from '../intelligence/learning/DailyFeatureExtractor';
import { updateEnergyCurve } from '../intelligence/learning/energyCurveLearning';
import { update } from '../intelligence/learning/UserModelUpdater';
import { DailyFeatures } from '../intelligence/learning/types';
import { scaleMinutesForEstimation } from '../intelligence/planner/estimationScale';
import { Reflection } from '../types/reflection';
import {
  BUFFER_NEED_RATIO_MAX,
  BUFFER_NEED_RATIO_MIN,
  DEFAULT_ENERGY_CURVE,
  createDefaultUserModel,
} from '../types/userModel';
import { makeSession, makeTask } from './fixtures';

const DATE = '2026-06-28';

function makeFeatures(overrides: Partial<DailyFeatures> = {}): DailyFeatures {
  return {
    date: DATE,
    completionRate: 0.8,
    skipRate: 0,
    rescheduleRate: 0,
    averageEstimationRatio: 1,
    estimationSampleCount: 1,
    estimationRatioByCategory: { general: 1 },
    averageFocusScore: 0.7,
    procrastinationScore: 0.2,
    focusDurationMinutes: [45],
    energy: 3,
    mood: 3,
    wins: [],
    blockers: [],
    slotEnergySignals: DEFAULT_ENERGY_CURVE.map(() => ({ sum: 0, count: 0 })),
    ...overrides,
  };
}

describe('DailyFeatureExtractor.extract', () => {
  it('computes completion and procrastination rates from session outcomes', () => {
    const sessions = [
      makeSession({
        date: DATE,
        outcome: {
          estimatedMinutes: 45,
          actualMinutes: 50,
          completed: true,
          estimationRatio: 1.1,
          startedLate: true,
          interrupted: false,
          focusScore: 0.8,
        },
      }),
      makeSession({
        date: DATE,
        outcome: {
          estimatedMinutes: 45,
          actualMinutes: 45,
          completed: false,
          estimationRatio: 1.0,
          startedLate: false,
          interrupted: true,
          focusScore: 0.5,
        },
      }),
    ];

    const features = extract(DATE, sessions, null, []);
    expect(features.completionRate).toBe(0.5);
    expect(features.procrastinationScore).toBe(0.5);
    expect(features.averageEstimationRatio).toBeCloseTo(1.05);
    expect(features.estimationSampleCount).toBe(2);
  });

  it('ignores poisoned estimation ratios from instant checkbox completion', () => {
    const sessions = [
      makeSession({
        date: DATE,
        outcome: {
          estimatedMinutes: 45,
          actualMinutes: 0,
          completed: true,
          estimationRatio: 0,
          startedLate: false,
          interrupted: false,
          focusScore: 0.4,
        },
      }),
    ];

    const features = extract(DATE, sessions, null, []);
    expect(features.estimationSampleCount).toBe(0);
    expect(features.averageEstimationRatio).toBe(0);
  });

  it('aggregates estimation ratios by task category', () => {
    const task = makeTask({ id: 'task-a', category: 'study' });
    const sessions = [
      makeSession({
        taskId: 'task-a',
        date: DATE,
        outcome: {
          estimatedMinutes: 30,
          actualMinutes: 45,
          completed: true,
          estimationRatio: 1.5,
          startedLate: false,
          interrupted: false,
          focusScore: 0.8,
        },
      }),
    ];

    const features = extract(DATE, sessions, null, [task]);
    expect(features.estimationRatioByCategory.study).toBeCloseTo(1.5);
  });

  it('reads mood/energy from reflection when present', () => {
    const reflection: Reflection = {
      id: 'r1',
      date: DATE,
      sessionId: null,
      mood: 4,
      energy: 5,
      wins: ['集中できた'],
      blockers: ['通知'],
      createdAt: '2026-06-28T00:00:00.000Z',
    };
    const features = extract(DATE, [], reflection, []);
    expect(features.mood).toBe(4);
    expect(features.energy).toBe(5);
    expect(features.wins).toEqual(['集中できた']);
    expect(features.blockers).toEqual(['通知']);
  });

  it('computes skip and reschedule rates', () => {
    const sessions = [
      makeSession({ date: DATE, status: 'skipped' }),
      makeSession({ date: DATE, status: 'planned' }),
      makeSession({ date: DATE, status: 'rescheduled' }),
    ];
    const features = extract(DATE, sessions, null, []);
    expect(features.skipRate).toBeCloseTo(1 / 3);
    expect(features.rescheduleRate).toBeCloseTo(1 / 3);
  });

  it('collects completed focus durations', () => {
    const sessions = [
      makeSession({
        date: DATE,
        outcome: {
          estimatedMinutes: 45,
          actualMinutes: 38,
          completed: true,
          estimationRatio: 0.84,
          startedLate: false,
          interrupted: false,
          focusScore: 0.8,
        },
      }),
      makeSession({
        date: DATE,
        outcome: {
          estimatedMinutes: 45,
          actualMinutes: 52,
          completed: true,
          estimationRatio: 1.15,
          startedLate: false,
          interrupted: false,
          focusScore: 0.7,
        },
      }),
    ];
    const features = extract(DATE, sessions, null, []);
    expect(features.focusDurationMinutes).toEqual([38, 52]);
  });

  it('returns zeroed rates when there are no outcomes', () => {
    const features = extract(DATE, [], null, []);
    expect(features.completionRate).toBe(0);
    expect(features.procrastinationScore).toBe(0);
    expect(features.estimationSampleCount).toBe(0);
  });
});

describe('UserModelUpdater.update', () => {
  it('moves the estimation factor toward the observed ratio via EMA', () => {
    const model = createDefaultUserModel();
    const next = update(model, makeFeatures({ averageEstimationRatio: 1.5 }));
    expect(next.estimationFactor.default).toBeCloseTo(1.1);
    expect(next.version).toBe(model.version + 1);
  });

  it('does not move estimation factor when there are no valid samples', () => {
    const model = createDefaultUserModel();
    const next = update(
      model,
      makeFeatures({
        estimationSampleCount: 0,
        averageEstimationRatio: 0,
        estimationRatioByCategory: {},
      })
    );
    expect(next.estimationFactor.default).toBe(1);
  });

  it('updates energy curve from slot signals', () => {
    const model = createDefaultUserModel();
    const slotEnergySignals = DEFAULT_ENERGY_CURVE.map((_, index) =>
      index === 1 ? { sum: 2.85, count: 3 } : { sum: 0, count: 0 }
    );

    const next = update(
      model,
      makeFeatures({
        slotEnergySignals,
        energy: null,
      })
    );

    expect(next.energyCurve[1]).toBeGreaterThan(DEFAULT_ENERGY_CURVE[1]);
    expect(next.lastDailySnapshot?.slotCompletion[1]).toBeGreaterThan(0);
  });

  it('raises bufferNeed when work overruns, clamped to the max', () => {
    const model = createDefaultUserModel();
    model.bufferNeed = BUFFER_NEED_RATIO_MAX;
    const next = update(model, makeFeatures({ averageEstimationRatio: 1.3 }));
    expect(next.bufferNeed).toBeLessThanOrEqual(BUFFER_NEED_RATIO_MAX);
  });

  it('keeps procrastination index within [0, 1]', () => {
    const model = createDefaultUserModel();
    const next = update(model, makeFeatures({ procrastinationScore: 1 }));
    expect(next.procrastinationIndex).toBeGreaterThanOrEqual(0);
    expect(next.procrastinationIndex).toBeLessThanOrEqual(1);
  });

  it('learns focusLength from completed session durations', () => {
    const model = createDefaultUserModel();
    const next = update(
      model,
      makeFeatures({
        focusDurationMinutes: [30, 40, 50, 60],
      })
    );
    expect(next.focusLength).not.toBe(45);
    expect(next.lastDailySnapshot?.focusDurationP75).toBe(60);
    expect(next.lastDailySnapshot?.skipRate).toBe(0);
  });

  it('stores reflection wins and blockers in the daily snapshot', () => {
    const model = createDefaultUserModel();
    const next = update(
      model,
      makeFeatures({
        wins: ['早く始められた'],
        blockers: ['SNS'],
      })
    );
    expect(next.lastDailySnapshot?.wins).toEqual(['早く始められた']);
    expect(next.lastDailySnapshot?.blockers).toEqual(['SNS']);
  });
});

describe('estimationScale', () => {
  it('scales minutes using category-specific factors', () => {
    const scaled = scaleMinutesForEstimation(30, 'study', {
      default: 1,
      study: 1.4,
    });
    expect(scaled).toBe(42);
  });
});

describe('updateEnergyCurve', () => {
  it('nudges only populated slots', () => {
    const next = updateEnergyCurve(
      [...DEFAULT_ENERGY_CURVE],
      [{ sum: 0, count: 0 }, { sum: 1.8, count: 2 }, { sum: 0, count: 0 }, { sum: 0, count: 0 }, { sum: 0, count: 0 }, { sum: 0, count: 0 }],
      null
    );
    expect(next[1]).toBeGreaterThan(DEFAULT_ENERGY_CURVE[1]);
    expect(next[0]).toBeCloseTo(DEFAULT_ENERGY_CURVE[0], 1);
  });
});
