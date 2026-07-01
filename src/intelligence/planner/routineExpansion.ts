import { CalendarBlock } from '../../types/calendarBlock';
import { RoutineTemplate, routineAppliesToWeekday } from '../../types/routine';
import { parseDateKey } from '../../utils/time';

const ROUTINE_VIRTUAL_BLOCK_PREFIX = 'routine:';

export function isRoutineVirtualBlock(block: Pick<CalendarBlock, 'id'>): boolean {
  return block.id.startsWith(ROUTINE_VIRTUAL_BLOCK_PREFIX);
}

export function withoutRoutineVirtualBlocks(blocks: CalendarBlock[]): CalendarBlock[] {
  return blocks.filter((block) => !isRoutineVirtualBlock(block));
}

/**
 * Expands weekly routine templates into ephemeral fixed CalendarBlocks for a
 * single date. These blocks are NOT persisted — they are produced on demand so
 * the planner avoids them and the calendar can display them read-only.
 */
export function expandRoutinesForDate(routines: RoutineTemplate[], dateKey: string): CalendarBlock[] {
  const weekday = parseDateKey(dateKey).getDay();
  return routines
    .filter(
      (routine) =>
        routineAppliesToWeekday(routine, weekday) &&
        !(routine.skipDates ?? []).includes(dateKey)
    )
    .map((routine) => ({
      id: `routine:${routine.id}:${dateKey}`,
      title: routine.title,
      date: dateKey,
      startMinutes: routine.startMinutes,
      endMinutes: routine.endMinutes,
      type: 'fixed' as const,
      locked: true,
      source: 'system' as const,
      recurring: true,
    }));
}

export function expandRoutinesForDates(
  routines: RoutineTemplate[],
  dateKeys: Iterable<string>
): CalendarBlock[] {
  const result: CalendarBlock[] = [];
  for (const dateKey of dateKeys) {
    result.push(...expandRoutinesForDate(routines, dateKey));
  }
  return result;
}
