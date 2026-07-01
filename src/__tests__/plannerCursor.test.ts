import {
  isPlanningToday,
  resolveAfterAnchors,
  resolveEffectiveCursorStart,
  resolvePlacementCursorStart,
  resolveTodayCursorMinutes,
} from '../intelligence/planner/plannerCursor';
import { DEFAULT_DAY_START_MINUTES } from '../intelligence/planner/plannerConstants';
import { makeSession } from './fixtures';

const DAY_START = DEFAULT_DAY_START_MINUTES; // 420 (07:00)
const TODAY = '2026-06-28';
const NOW = new Date('2026-06-28T10:12:00'); // local 10:12 → 612 → snapped 610

describe('resolveAfterAnchors', () => {
  it('returns 0 when there are no anchors (does not pin to dayStart)', () => {
    expect(resolveAfterAnchors([], DAY_START)).toBe(0);
  });

  it('returns the latest anchor end, floored at dayStart', () => {
    const anchors = [
      makeSession({ startMinutes: 8 * 60, endMinutes: 9 * 60 }),
      makeSession({ startMinutes: 13 * 60, endMinutes: 14 * 60 }),
    ];
    expect(resolveAfterAnchors(anchors, DAY_START)).toBe(14 * 60);
  });
});

describe('resolveTodayCursorMinutes', () => {
  it('snaps the current time to the placement grid', () => {
    expect(resolveTodayCursorMinutes(NOW)).toBe(610);
  });
});

describe('isPlanningToday', () => {
  it('is true only for the current date key', () => {
    expect(isPlanningToday(TODAY, NOW)).toBe(true);
    expect(isPlanningToday('2026-06-29', NOW)).toBe(false);
  });
});

describe('resolveEffectiveCursorStart', () => {
  it('today + explicit cursor before dayStart keeps the explicit value (shift-from-now)', () => {
    const cursor = resolveEffectiveCursorStart({
      date: TODAY,
      dayStartMinutes: DAY_START,
      cursorStartMinutes: 120, // 02:00
      anchoredSessions: [],
      now: NOW,
    });
    expect(cursor).toBe(120);
  });

  it('today + explicit cursor is floored by the latest anchor', () => {
    const cursor = resolveEffectiveCursorStart({
      date: TODAY,
      dayStartMinutes: DAY_START,
      cursorStartMinutes: 9 * 60,
      anchoredSessions: [makeSession({ startMinutes: 9 * 60, endMinutes: 11 * 60 })],
      now: NOW,
    });
    expect(cursor).toBe(11 * 60);
  });

  it('future date + explicit cursor below dayStart is floored at dayStart', () => {
    const cursor = resolveEffectiveCursorStart({
      date: '2026-06-29',
      dayStartMinutes: DAY_START,
      cursorStartMinutes: 120,
      anchoredSessions: [],
      now: NOW,
    });
    expect(cursor).toBe(DAY_START);
  });

  it('today without explicit cursor starts at max(now, dayStart)', () => {
    const cursor = resolveEffectiveCursorStart({
      date: TODAY,
      dayStartMinutes: DAY_START,
      anchoredSessions: [],
      now: NOW,
    });
    expect(cursor).toBe(610);
  });

  it('future date without explicit cursor starts at dayStart', () => {
    const cursor = resolveEffectiveCursorStart({
      date: '2026-06-29',
      dayStartMinutes: DAY_START,
      anchoredSessions: [],
      now: NOW,
    });
    expect(cursor).toBe(DAY_START);
  });
});

describe('resolvePlacementCursorStart', () => {
  it('returns undefined for a future date', () => {
    expect(resolvePlacementCursorStart('2026-06-29', DAY_START, NOW)).toBeUndefined();
  });

  it('returns max(now, dayStart) for today', () => {
    expect(resolvePlacementCursorStart(TODAY, DAY_START, NOW)).toBe(610);
  });
});
