/**
 * RoutineTemplate — a weekly-recurring fixed commitment (commute, lecture,
 * lunch, etc.). Not stored per date; expanded into ephemeral fixed
 * CalendarBlocks at plan/display time so the planner avoids them.
 */
export interface RoutineTemplate {
  id: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  /** Days the routine applies to. 0=Sun … 6=Sat. Empty = every day. */
  weekdays: number[];
  /** Specific date keys (YYYY-MM-DD) to skip (holidays, cancelled lectures, etc.). */
  skipDates: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/** True when the routine is active on the given weekday (0=Sun…6=Sat). */
export function routineAppliesToWeekday(routine: RoutineTemplate, weekday: number): boolean {
  if (!routine.enabled) {
    return false;
  }
  return routine.weekdays.length === 0 || routine.weekdays.includes(weekday);
}
