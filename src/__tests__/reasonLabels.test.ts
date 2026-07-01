import {
  buildDayStrategy,
  reasonTagsToSentences,
} from '../presentation/explain/reasonLabels';
import { DayPlan } from '../types/dayPlan';

const DATE = '2026-06-28';

function makePlan(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    date: DATE,
    dayType: 'PUSH',
    capacity: {
      availableMinutes: 600,
      targetFocusMinutes: 300,
      targetSessionCount: 4,
      bufferMinutes: 10,
      breakMinutes: 30,
      reasonTags: ['capacity_push'],
    },
    sessions: [],
    calendarBlocks: [],
    reasonTags: ['capacity_push', 'deadline', 'energy_peak'],
    generatedAt: '2026-06-28T09:00:00.000Z',
    ...overrides,
  };
}

describe('reasonTagsToSentences', () => {
  it('maps known tags to Japanese sentences', () => {
    const sentences = reasonTagsToSentences(['deadline', 'energy_peak']);
    expect(sentences).toEqual([
      '締切を考慮して順番を決めました',
      '集中しやすい時間帯に重要な作業を置きました',
    ]);
  });

  it('dedupes identical labels and drops unknown tags', () => {
    const sentences = reasonTagsToSentences([
      'deadline',
      'deadline',
      'unknown_tag',
      'task_priority',
    ]);
    expect(sentences).toEqual([
      '締切を考慮して順番を決めました',
      '優先度の高いタスクを先に置きました',
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(reasonTagsToSentences([])).toEqual([]);
  });
});

describe('buildDayStrategy', () => {
  it('returns default copy when plan is null', () => {
    expect(buildDayStrategy(null, [])).toBe(
      'タスクがあれば、AIが今日の最適な流れを組み立てます。'
    );
  });

  it('combines DayType tagline with the first reason sentence', () => {
    const plan = makePlan({ dayType: 'PUSH' });
    const reasons = reasonTagsToSentences(plan.reasonTags);
    const strategy = buildDayStrategy(plan, reasons);

    expect(strategy).toContain('集中して攻める一日');
    expect(strategy).toContain(reasons[0]);
  });

  it('falls back to DayType tagline when no reasons are provided', () => {
    const plan = makePlan({ dayType: 'REST', reasonTags: [] });
    expect(buildDayStrategy(plan, [])).toBe(
      '回復を優先する一日 回復を優先する一日'
    );
  });
});
