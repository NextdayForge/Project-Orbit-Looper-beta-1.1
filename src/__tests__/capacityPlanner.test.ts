import { planCapacity } from '../intelligence/planner/CapacityPlanner';
import { CalendarBlock } from '../types/calendarBlock';
import { makeContext } from './fixtures';

const CONTEXT = makeContext();

function makeFixedBlock(overrides: Partial<CalendarBlock> = {}): CalendarBlock {
  return {
    id: 'block-1',
    title: '固定予定',
    date: '2026-09-08',
    startMinutes: 9 * 60,
    endMinutes: 10 * 60,
    type: 'fixed',
    locked: true,
    source: 'user',
    recurring: false,
    ...overrides,
  };
}

describe('planCapacity — sleep duration from settings', () => {
  it('falls back to the historical 8h sleep window when wake/sleep are not provided', () => {
    const capacity = planCapacity(CONTEXT, 'NORMAL', [], []);
    // 24h - 0 fixed - 8h sleep = 16h = 960min
    expect(capacity.availableMinutes).toBe(960);
  });

  it('derives a shorter available window when the user sleeps less (later wake, earlier bedtime given a longer night)', () => {
    // wake 08:00, sleep(bedtime) 23:00 → 9h overnight sleep, not the hardcoded 8h.
    const capacity = planCapacity(CONTEXT, 'NORMAL', [], [], {
      wakeMinutes: 8 * 60,
      sleepMinutes: 23 * 60,
    });
    // 24h - 0 fixed - 9h sleep = 15h = 900min
    expect(capacity.availableMinutes).toBe(900);
  });

  it('derives a longer available window when the user sleeps less (shorter night)', () => {
    // wake 06:00, sleep(bedtime) 23:00 → 7h overnight sleep.
    const capacity = planCapacity(CONTEXT, 'NORMAL', [], [], {
      wakeMinutes: 6 * 60,
      sleepMinutes: 23 * 60,
    });
    // 24h - 0 fixed - 7h sleep = 17h = 1020min
    expect(capacity.availableMinutes).toBe(1020);
  });

  it('still subtracts fixed CalendarBlocks on top of the settings-derived sleep window', () => {
    const capacity = planCapacity(
      CONTEXT,
      'NORMAL',
      [],
      [makeFixedBlock({ startMinutes: 12 * 60, endMinutes: 13 * 60 })],
      { wakeMinutes: 7 * 60, sleepMinutes: 23 * 60 }
    );
    // 24h - 1h fixed - 8h sleep = 15h = 900min
    expect(capacity.availableMinutes).toBe(900);
  });

  it('availableMinutesOverride still bypasses settings-derived sleep entirely', () => {
    const capacity = planCapacity(CONTEXT, 'NORMAL', [], [], {
      availableMinutesOverride: 123,
      wakeMinutes: 8 * 60,
      sleepMinutes: 23 * 60,
    });
    expect(capacity.availableMinutes).toBe(123);
  });
});
