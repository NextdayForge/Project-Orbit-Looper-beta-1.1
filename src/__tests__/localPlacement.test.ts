import { LocalPlacementStrategy } from '../intelligence/planner/LocalPlacementStrategy';
import { DEFAULT_DAY_START_MINUTES } from '../intelligence/planner/plannerConstants';
import { makeCapacity, makeContext, makeFixedBlock, makeTask } from './fixtures';

const FUTURE = '2026-12-31';
const strategy = new LocalPlacementStrategy();

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

describe('LocalPlacementStrategy', () => {
  it('places the first session exactly at the provided cursor (not dayStart)', () => {
    const result = strategy.place({
      context: makeContext(),
      capacity: makeCapacity(),
      tasks: [makeTask({ estimatedMinutes: 45 })],
      blocks: [],
      date: FUTURE,
      cursorStartMinutes: 600, // 10:00
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].startMinutes).toBe(600);
    expect(result.sessions[0].endMinutes).toBe(645);
  });

  it('places multiple sessions sequentially', () => {
    const result = strategy.place({
      context: makeContext({ focusLength: 45 }),
      capacity: makeCapacity({ bufferMinutes: 0, breakMinutes: 0 }),
      tasks: [
        makeTask({ estimatedMinutes: 45, priority: 1 }),
        makeTask({ estimatedMinutes: 45, priority: 2 }),
      ],
      blocks: [],
      date: FUTURE,
      cursorStartMinutes: 600,
    });

    const starts = result.sessions.map((s) => s.startMinutes).sort((a, b) => a - b);
    expect(starts).toEqual([600, 645]);
  });

  it('never overlaps a fixed calendar block', () => {
    const fixed = makeFixedBlock({ date: FUTURE, startMinutes: 600, endMinutes: 660 });
    const result = strategy.place({
      context: makeContext({ focusLength: 45 }),
      capacity: makeCapacity({ bufferMinutes: 0, breakMinutes: 0, targetSessionCount: 3 }),
      tasks: [
        makeTask({ estimatedMinutes: 45 }),
        makeTask({ estimatedMinutes: 45 }),
        makeTask({ estimatedMinutes: 45 }),
      ],
      blocks: [fixed],
      date: FUTURE,
      cursorStartMinutes: DEFAULT_DAY_START_MINUTES,
    });

    for (const session of result.sessions) {
      expect(
        rangesOverlap(session.startMinutes, session.endMinutes, fixed.startMinutes, fixed.endMinutes)
      ).toBe(false);
    }
  });

  it('never places before dayStart for a future date (energy-based placement)', () => {
    const result = strategy.place({
      context: makeContext(),
      capacity: makeCapacity(),
      tasks: [makeTask({ estimatedMinutes: 45 })],
      blocks: [],
      date: FUTURE,
    });

    // No cursor on a future day → energy-curve placement, but never earlier than dayStart.
    expect(result.sessions[0].startMinutes).toBeGreaterThanOrEqual(DEFAULT_DAY_START_MINUTES);
  });

  it('treats anchored sessions as occupied time', () => {
    const result = strategy.place({
      context: makeContext({ focusLength: 60 }),
      capacity: makeCapacity({ bufferMinutes: 0, breakMinutes: 0 }),
      tasks: [makeTask({ estimatedMinutes: 60 })],
      blocks: [],
      date: FUTURE,
      cursorStartMinutes: DEFAULT_DAY_START_MINUTES,
      anchoredSessions: [
        {
          id: 'anchor',
          taskId: 'other',
          date: FUTURE,
          startMinutes: DEFAULT_DAY_START_MINUTES,
          endMinutes: DEFAULT_DAY_START_MINUTES + 60,
          estimatedMinutes: 60,
          pauseCount: 0,
          status: 'planned',
          outcome: null,
          aiGenerated: false,
          completed: false,
          reasonTags: [],
        },
      ],
    });

    const placed = result.sessions[0];
    expect(placed.startMinutes).toBeGreaterThanOrEqual(DEFAULT_DAY_START_MINUTES + 60);
  });

  it('does not split non-splittable long tasks into multiple sessions', () => {
    const result = strategy.place({
      context: makeContext({ focusLength: 45 }),
      capacity: makeCapacity({ bufferMinutes: 0, breakMinutes: 0, targetSessionCount: 4 }),
      tasks: [makeTask({ estimatedMinutes: 90, splittable: false })],
      blocks: [],
      date: FUTURE,
      cursorStartMinutes: 600,
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].endMinutes - result.sessions[0].startMinutes).toBe(90);
  });

  it('splits splittable long tasks by focus length', () => {
    const result = strategy.place({
      context: makeContext({ focusLength: 45 }),
      capacity: makeCapacity({ bufferMinutes: 0, breakMinutes: 0, targetSessionCount: 4 }),
      tasks: [makeTask({ estimatedMinutes: 90, splittable: true })],
      blocks: [],
      date: FUTURE,
      cursorStartMinutes: 600,
    });

    expect(result.sessions.length).toBeGreaterThanOrEqual(2);
    expect(new Set(result.sessions.map((session) => session.taskId)).size).toBe(1);
  });
});
