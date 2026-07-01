import { Session } from '../../types/session';
import { snapToMinutes, toDateKey } from '../../utils/time';
import {
  DEFAULT_DAY_START_MINUTES,
  PLACEMENT_SNAP_MINUTES,
} from './plannerConstants';

export function resolveAfterAnchors(anchoredSessions: Session[], dayStartMinutes: number): number {
  if (anchoredSessions.length === 0) {
    return 0;
  }

  return Math.max(
    dayStartMinutes,
    ...anchoredSessions.map((session) => session.endMinutes)
  );
}

export function isPlanningToday(date: string, now = new Date()): boolean {
  return date === toDateKey(now);
}

export function resolveTodayCursorMinutes(now = new Date()): number {
  return snapToMinutes(
    now.getHours() * 60 + now.getMinutes(),
    PLACEMENT_SNAP_MINUTES
  );
}

/**
 * Unified cursor rule:
 * - explicit cursorStartMinutes → max(cursor, afterAnchors)
 * - today without explicit cursor → max(now + buffer, afterAnchors, dayStart)
 * - future day → max(dayStart, afterAnchors)
 */
export function resolveEffectiveCursorStart(params: {
  date: string;
  dayStartMinutes?: number;
  cursorStartMinutes?: number;
  anchoredSessions?: Session[];
  bufferMinutes?: number;
  now?: Date;
}): number {
  const dayStart = params.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES;
  const afterAnchors = resolveAfterAnchors(params.anchoredSessions ?? [], dayStart);
  const now = params.now ?? new Date();

  if (params.cursorStartMinutes !== undefined) {
    const floor = params.date === toDateKey(now)
      ? Math.max(afterAnchors, 0)
      : Math.max(dayStart, afterAnchors);
    return snapToMinutes(
      Math.max(params.cursorStartMinutes, floor),
      PLACEMENT_SNAP_MINUTES
    );
  }

  if (params.date === toDateKey(now)) {
    const buffer = params.bufferMinutes ?? 0;
    const nowMinutes = snapToMinutes(
      now.getHours() * 60 + now.getMinutes() + buffer,
      PLACEMENT_SNAP_MINUTES
    );
    return Math.max(nowMinutes, afterAnchors, dayStart);
  }

  return Math.max(dayStart, afterAnchors);
}

/** Returns cursor for today only; undefined for future dates (LocalPlacementStrategy resolves). */
export function resolvePlacementCursorStart(
  date: string,
  dayStartMinutes?: number,
  now?: Date
): number | undefined {
  const ref = now ?? new Date();
  if (!isPlanningToday(date, ref)) {
    return undefined;
  }

  const dayStart = dayStartMinutes ?? DEFAULT_DAY_START_MINUTES;
  return Math.max(resolveTodayCursorMinutes(ref), dayStart);
}
