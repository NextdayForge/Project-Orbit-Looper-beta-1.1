import { CalendarBlock } from '../../types/calendarBlock';
import { EventColor } from '../../types/schedule';
import { Session, isScheduleVisibleSession } from '../../types/session';
import { DEFAULT_TASK_CATEGORY, Task, TaskCategory } from '../../types/task';
import { withoutRoutineVirtualBlocks } from '../../intelligence/planner/routineExpansion';
import { CalendarDisplayEvent } from './CalendarDisplayEvent';
import { CATEGORY_COLOR } from './CalendarEditorAdapter';

const BLOCK_COLOR: Record<CalendarBlock['type'], EventColor> = {
  fixed: 'blue',
  buffer: 'teal',
  break: 'teal',
  power_nap: 'purple',
};

function taskByIdMap(tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map((task) => [task.id, task]));
}

function sessionToDisplayEvent(session: Session, tasks: Map<string, Task>): CalendarDisplayEvent {
  const task = session.taskId ? tasks.get(session.taskId) : undefined;
  const isRescheduled = session.status === 'rescheduled';

  return {
    id: `session-${session.id}`,
    date: session.date,
    title: task?.title ?? 'Session',
    startMinutes: session.startMinutes,
    endMinutes: session.endMinutes,
    color: task ? CATEGORY_COLOR[task.category] : 'blue',
    note: task?.category ?? DEFAULT_TASK_CATEGORY,
    priority: task?.priority,
    completed: session.completed || session.status === 'completed',
    locked: isRescheduled,
    isAuxiliary: isRescheduled || session.status === 'skipped',
    source: 'session',
    sourceId: session.id,
    entityType: 'session',
    entityId: session.id,
    editable: !isRescheduled && session.status !== 'completed',
    deletable: !isRescheduled && session.status !== 'completed',
    isNew: false,
  };
}

function calendarBlockToDisplayEvent(
  block: CalendarBlock,
  options?: { readonly?: boolean }
): CalendarDisplayEvent {
  const isAuxiliary = block.type === 'buffer' || block.type === 'break';
  const readonly = options?.readonly ?? false;

  return {
    id: `block-${block.id}`,
    date: block.date,
    title: block.title,
    startMinutes: block.startMinutes,
    endMinutes: block.endMinutes,
    color: BLOCK_COLOR[block.type],
    note: block.type,
    locked: block.locked || readonly,
    isAuxiliary,
    source: 'calendar_block',
    sourceId: block.id,
    entityType: 'calendar_block',
    entityId: block.id,
    editable: !readonly,
    deletable: !readonly && block.type !== 'fixed',
    isNew: false,
    completed: false,
  };
}

export function buildDomainDisplayEvents(input: {
  tasks: Task[];
  sessions: Session[];
  calendarBlocks: CalendarBlock[];
  /** Read-only blocks (e.g. expanded routines): shown but not editable/deletable. */
  readonlyBlocks?: CalendarBlock[];
}): CalendarDisplayEvent[] {
  const tasks = taskByIdMap(input.tasks);
  const sessionEvents = input.sessions
    .filter((session) => isScheduleVisibleSession(session))
    .map((session) => sessionToDisplayEvent(session, tasks));
  const blockEvents = withoutRoutineVirtualBlocks(input.calendarBlocks).map((block) =>
    calendarBlockToDisplayEvent(block)
  );
  const readonlyEvents = (input.readonlyBlocks ?? []).map((block) =>
    calendarBlockToDisplayEvent(block, { readonly: true })
  );

  const seenIds = new Set<string>();
  return [...sessionEvents, ...blockEvents, ...readonlyEvents]
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes)
    .filter((event) => {
      if (seenIds.has(event.id)) {
        return false;
      }
      seenIds.add(event.id);
      return true;
    });
}

export function filterDisplayEventsByDate(
  events: CalendarDisplayEvent[],
  dateKey: string
): CalendarDisplayEvent[] {
  return events.filter((event) => event.date === dateKey);
}

export function buildDisplayEventCountByDate(events: CalendarDisplayEvent[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const event of events) {
    if (event.isAuxiliary) {
      continue;
    }
    counts.set(event.date, (counts.get(event.date) ?? 0) + 1);
  }

  return counts;
}

export interface CalendarViewModel {
  allEvents: CalendarDisplayEvent[];
  eventsForDate: (dateKey: string) => CalendarDisplayEvent[];
}

export function buildCalendarViewModel(input: {
  tasks: Task[];
  sessions: Session[];
  calendarBlocks: CalendarBlock[];
  readonlyBlocks?: CalendarBlock[];
}): CalendarViewModel {
  const allEvents = buildDomainDisplayEvents(input);

  return {
    allEvents,
    eventsForDate: (dateKey: string) => filterDisplayEventsByDate(allEvents, dateKey),
  };
}
