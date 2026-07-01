import { classify } from '../intelligence/planner/DayTypeClassifier';
import { CalendarBlock } from '../types/calendarBlock';
import { createDefaultUserModel, toPlannerContext } from '../types/userModel';
import { parseDateKey } from '../utils/time';
import { makeTask } from './fixtures';

const DATE = '2026-06-28';

function urgentDeadline(): string {
  return new Date(parseDateKey(DATE).getTime() + 12 * 60 * 60 * 1000).toISOString();
}

describe('DayTypeClassifier.classify', () => {
  it('assigns PUSH when urgent tasks meet capacity signals', () => {
    const userModel = createDefaultUserModel();
    userModel.lastDailySnapshot = {
      date: '2026-06-27',
      completionRate: 0.8,
      skipRate: 0,
      rescheduleRate: 0,
      overrunRate: 0,
      slotCompletion: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
      estimationRatio: { default: 1 },
      focusDurationP75: 45,
      mood: 4,
      energy: 4,
      wins: [],
      blockers: [],
      aiConfidence: 0.7,
    };

    const result = classify(
      toPlannerContext(userModel),
      [makeTask({ priority: 1, deadline: urgentDeadline() })],
      [],
      DATE
    );
    expect(result.dayType).toBe('PUSH');
    expect(result.reasonTags).toContain('push_urgent_capacity');
  });

  it('does not assign PUSH when energy is low', () => {
    const userModel = createDefaultUserModel();
    userModel.lastDailySnapshot = {
      date: '2026-06-27',
      completionRate: 0.9,
      skipRate: 0,
      rescheduleRate: 0,
      overrunRate: 0,
      slotCompletion: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
      estimationRatio: { default: 1 },
      focusDurationP75: 45,
      mood: 2,
      energy: 2,
      wins: [],
      blockers: [],
      aiConfidence: 0.7,
    };

    const result = classify(
      toPlannerContext(userModel),
      [makeTask({ priority: 1, deadline: urgentDeadline() })],
      [],
      DATE
    );
    expect(result.dayType).not.toBe('PUSH');
  });

  it('assigns REST when fixed blocks exceed six hours', () => {
    const blocks: CalendarBlock[] = [
      {
        id: 'fixed-1',
        title: '授業',
        date: DATE,
        startMinutes: 9 * 60,
        endMinutes: 16 * 60,
        type: 'fixed',
        locked: true,
        source: 'user',
        recurring: false,
      },
    ];

    const result = classify(toPlannerContext(createDefaultUserModel()), [], blocks, DATE);
    expect(result.dayType).toBe('REST');
  });
});
