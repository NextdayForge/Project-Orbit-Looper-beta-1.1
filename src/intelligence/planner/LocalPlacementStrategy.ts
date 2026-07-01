import { CalendarBlock } from '../../types/calendarBlock';
import { Session, isActivePlacementSession } from '../../types/session';
import { Task } from '../../types/task';
import { generateId, snapToMinutes, toDateKey } from '../../utils/time';
import { averageEnergyForRange } from './energyScore';
import { scaleMinutesForEstimation } from './estimationScale';
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  PLACEMENT_SNAP_MINUTES,
} from './plannerConstants';
import { resolveEffectiveCursorStart } from './plannerCursor';
import { PlacementInput, PlacementResult, PlacementSlotCandidate } from './types';
import { PlacementStrategy } from './PlacementStrategy';

const SNAP_STEP = PLACEMENT_SNAP_MINUTES;

interface TimeRange {
  start: number;
  end: number;
}

function snapCeilToMinutes(minutes: number, step = SNAP_STEP): number {
  return Math.ceil(minutes / step) * step;
}

function advanceCursor(previousCursor: number, nextCursor: number): number {
  return Math.max(snapCeilToMinutes(nextCursor, SNAP_STEP), previousCursor + SNAP_STEP);
}

function mergeBusyBlocks(blocks: TimeRange[]): TimeRange[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [];

  for (const block of sorted) {
    const last = merged[merged.length - 1];
    if (!last || block.start > last.end) {
      merged.push({ ...block });
    } else {
      last.end = Math.max(last.end, block.end);
    }
  }

  return merged;
}

function sortTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((task) => task.estimatedMinutes > 0)
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
      return deadlineA - deadlineB;
    });
}

function fixedBlocksForDate(blocks: CalendarBlock[], date: string): CalendarBlock[] {
  return blocks.filter((block) => block.date === date && block.type === 'fixed');
}

function findGapStart(
  cursor: number,
  spanMinutes: number,
  busy: TimeRange[],
  dayEnd: number
): number | null {
  let start = cursor;
  const merged = mergeBusyBlocks(busy);

  for (let attempt = 0; attempt < 200; attempt++) {
    const end = start + spanMinutes;
    if (end > dayEnd) {
      return null;
    }

    const overlap = merged.find((block) => start < block.end && end > block.start);
    if (!overlap) {
      return start;
    }

    const nextStart = snapCeilToMinutes(overlap.end, SNAP_STEP);
    start = nextStart <= start ? start + SNAP_STEP : nextStart;
  }

  return null;
}

function listGapCandidates(
  minStart: number,
  spanMinutes: number,
  busy: TimeRange[],
  dayEnd: number
): number[] {
  const candidates: number[] = [];
  let cursor = minStart;

  for (let attempt = 0; attempt < 200; attempt++) {
    const gapStart = findGapStart(cursor, spanMinutes, busy, dayEnd);
    if (gapStart === null) {
      break;
    }

    candidates.push(gapStart);
    cursor = gapStart + spanMinutes + SNAP_STEP;
    if (cursor >= dayEnd) {
      break;
    }
  }

  return candidates;
}

function findBestGapStart(
  minStart: number,
  spanMinutes: number,
  busy: TimeRange[],
  dayEnd: number,
  energyCurve: number[],
  dayStartMinutes: number
): { start: number | null; score: number; candidateSlots: PlacementSlotCandidate[] } {
  const candidates = listGapCandidates(minStart, spanMinutes, busy, dayEnd);
  if (candidates.length === 0) {
    return { start: null, score: 0, candidateSlots: [] };
  }

  const candidateSlots = candidates.map((candidate) => ({
    startMinutes: candidate,
    endMinutes: candidate + spanMinutes,
    score: averageEnergyForRange(
      candidate,
      spanMinutes,
      energyCurve,
      dayStartMinutes,
      dayEnd
    ),
  }));

  let best = candidateSlots[0];
  for (let index = 1; index < candidateSlots.length; index += 1) {
    if (candidateSlots[index].score > best.score) {
      best = candidateSlots[index];
    }
  }

  return {
    start: best.startMinutes,
    score: best.score,
    candidateSlots: candidateSlots.slice(0, 5),
  };
}

function pickNextTask(tasks: Task[], remainingMinutes: Map<string, number>): Task | null {
  for (const task of tasks) {
    if ((remainingMinutes.get(task.id) ?? 0) > 0) {
      return task;
    }
  }
  return null;
}

function createSession(
  task: Task,
  date: string,
  startMinutes: number,
  durationMinutes: number,
  reasonTags: string[]
): Session {
  return {
    id: generateId(),
    taskId: task.id,
    date,
    startMinutes,
    endMinutes: startMinutes + durationMinutes,
    estimatedMinutes: durationMinutes,
    pauseCount: 0,
    status: 'planned',
    outcome: null,
    aiGenerated: false,
    completed: false,
    reasonTags: [...reasonTags],
  };
}

function createBreakBlock(date: string, startMinutes: number, breakMinutes: number): CalendarBlock {
  return {
    id: generateId(),
    title: '休憩',
    date,
    startMinutes,
    endMinutes: startMinutes + breakMinutes,
    type: 'break',
    locked: false,
    source: 'system',
    recurring: false,
  };
}

function createBufferBlock(date: string, startMinutes: number, bufferMinutes: number): CalendarBlock {
  return {
    id: generateId(),
    title: 'バッファ（切り替え）',
    date,
    startMinutes,
    endMinutes: startMinutes + bufferMinutes,
    type: 'buffer',
    locked: false,
    source: 'system',
    recurring: false,
  };
}

function perSessionAuxMinutes(totalMinutes: number, taskCount: number, maxMinutes: number): number {
  if (totalMinutes <= 0 || taskCount <= 0) {
    return 0;
  }
  return Math.min(maxMinutes, Math.max(5, Math.round(totalMinutes / taskCount)));
}

function resolveGapStart(
  minStart: number,
  spanMinutes: number,
  busy: TimeRange[],
  dayEnd: number,
  energyCurve: number[],
  dayStartMinutes: number,
  preferEarliest: boolean
): {
  start: number | null;
  energyOptimized: boolean;
  score: number;
  candidateSlots: PlacementSlotCandidate[];
} {
  if (preferEarliest) {
    const start = findGapStart(minStart, spanMinutes, busy, dayEnd);
    return {
      start,
      energyOptimized: false,
      score: start == null ? 0 : 1,
      candidateSlots:
        start == null
          ? []
          : [{ startMinutes: start, endMinutes: start + spanMinutes, score: 1 }],
    };
  }

  const best = findBestGapStart(
    minStart,
    spanMinutes,
    busy,
    dayEnd,
    energyCurve,
    dayStartMinutes
  );

  return {
    start: best.start,
    energyOptimized: true,
    score: best.score,
    candidateSlots: best.candidateSlots,
  };
}

function fitsAtMinute(
  start: number,
  spanMinutes: number,
  busy: TimeRange[],
  dayEnd: number
): boolean {
  if (start + spanMinutes > dayEnd) {
    return false;
  }

  const merged = mergeBusyBlocks(busy);
  return !merged.some((block) => start < block.end && start + spanMinutes > block.start);
}

function collectOccupiedRanges(
  fixedBlocks: CalendarBlock[],
  anchoredSessions: Session[]
): TimeRange[] {
  return [
    ...fixedBlocks.map((block) => ({
      start: block.startMinutes,
      end: block.endMinutes,
    })),
    ...anchoredSessions.map((session) => ({
      start: session.startMinutes,
      end: session.endMinutes,
    })),
  ];
}

/**
 * MVP local placement between fixed calendar blocks and anchored sessions.
 */
export class LocalPlacementStrategy implements PlacementStrategy {
  place(input: PlacementInput): PlacementResult {
    const { context, capacity, tasks, blocks, date, cursorStartMinutes } = input;
    const dayStartMinutes = input.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES;
    const dayEndMinutes = input.dayEndMinutes ?? DEFAULT_DAY_END_MINUTES;
    const anchoredSessions = (input.anchoredSessions ?? []).filter(isActivePlacementSession);
    const reasonTags = new Set<string>();
    const focusLength = context.focusLength > 0 ? context.focusLength : 45;

    const sortedTasks = sortTasks(tasks);
    const remainingMinutes = new Map(
      sortedTasks.map((task) => [
        task.id,
        scaleMinutesForEstimation(task.estimatedMinutes, task.category, context.estimationFactor),
      ])
    );

    const fixedBlocks = fixedBlocksForDate(blocks, date);
    const occupied = collectOccupiedRanges(fixedBlocks, anchoredSessions);
    const isToday = date === toDateKey(new Date());
    const effectiveCursorStart =
      cursorStartMinutes ??
      (isToday ? snapToMinutes(new Date().getHours() * 60 + new Date().getMinutes(), SNAP_STEP) : undefined);
    const preferEarliestGap = false;
    const sessionLimit = Math.max(capacity.targetSessionCount, sortedTasks.length);
    const auxTaskCount = Math.max(sortedTasks.length, sessionLimit, 1);

    const cursor = resolveEffectiveCursorStart({
      date,
      dayStartMinutes,
      cursorStartMinutes: effectiveCursorStart,
      anchoredSessions,
    });

    const sessions: Session[] = [];
    const placementDecisions: PlacementResult['placementDecisions'] = [];
    const placedBlocks: CalendarBlock[] = [];
    let placementCursor = cursor;
    let sessionCount = 0;

    while (sessionCount < sessionLimit) {
      const task = pickNextTask(sortedTasks, remainingMinutes);
      if (!task) {
        break;
      }

      const remaining = remainingMinutes.get(task.id) ?? 0;
      const sessionMinutes = task.splittable ? Math.min(focusLength, remaining) : remaining;
      const bufferMinutes = perSessionAuxMinutes(capacity.bufferMinutes, auxTaskCount, 15);
      const breakMinutes = perSessionAuxMinutes(capacity.breakMinutes, auxTaskCount, 15);
      const previousCursor = placementCursor;

      const gapResult = resolveGapStart(
        placementCursor,
        sessionMinutes,
        occupied,
        dayEndMinutes,
        context.energyCurve,
        dayStartMinutes,
        preferEarliestGap
      );
      let gapStart = gapResult.start;

      if (
        effectiveCursorStart !== undefined &&
        sessionCount === 0 &&
        gapStart !== null &&
        gapStart < placementCursor &&
        fitsAtMinute(placementCursor, sessionMinutes, occupied, dayEndMinutes)
      ) {
        gapStart = placementCursor;
      }

      if (gapStart === null) {
        remainingMinutes.set(task.id, 0);
        continue;
      }

      const blockEnd = gapStart + sessionMinutes + bufferMinutes + breakMinutes;
      if (blockEnd > dayEndMinutes) {
        remainingMinutes.set(task.id, 0);
        continue;
      }

      const sessionStart = gapStart;
      const sessionEnd = sessionStart + sessionMinutes;
      const sessionReasonTags: string[] = ['focus_length'];

      if (task.priority <= 2) {
        sessionReasonTags.push('task_priority');
        reasonTags.add('task_priority');
      }
      if (task.deadline) {
        sessionReasonTags.push('deadline');
        reasonTags.add('deadline');
      }

      if (
        gapResult.energyOptimized &&
        averageEnergyForRange(
          sessionStart,
          sessionMinutes,
          context.energyCurve,
          dayStartMinutes,
          dayEndMinutes
        ) >= 0.7
      ) {
        sessionReasonTags.push('energy_peak');
        reasonTags.add('energy_peak');
      }

      sessions.push(createSession(task, date, sessionStart, sessionMinutes, sessionReasonTags));
      placementDecisions.push({
        taskId: task.id,
        sessionId: sessions[sessions.length - 1].id,
        score: gapResult.score,
        reasonTags: sessionReasonTags,
        candidateSlots: gapResult.candidateSlots,
        chosenSlot: { startMinutes: sessionStart, endMinutes: sessionEnd },
      });
      reasonTags.add('focus_length');

      let nextCursor = sessionEnd;

      if (bufferMinutes > 0) {
        placedBlocks.push(createBufferBlock(date, sessionEnd, bufferMinutes));
        reasonTags.add('buffer_inserted');
        nextCursor = sessionEnd + bufferMinutes;
      }

      if (breakMinutes > 0) {
        placedBlocks.push(createBreakBlock(date, nextCursor, breakMinutes));
        nextCursor += breakMinutes;
      }

      occupied.push({ start: gapStart, end: nextCursor });
      placementCursor = advanceCursor(previousCursor, nextCursor);
      remainingMinutes.set(task.id, task.splittable ? remaining - sessionMinutes : 0);
      sessionCount += 1;
    }

    return {
      sessions,
      blocks: [...fixedBlocks, ...placedBlocks],
      reasonTags: [...reasonTags],
      placementDecisions,
    };
  }
}
