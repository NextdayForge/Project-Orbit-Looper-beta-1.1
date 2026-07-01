import { CalendarBlock } from '../../types/calendarBlock';
import { Task } from '../../types/task';
import { PlannerContext } from '../../types/userModel';
import { parseDateKey } from '../../utils/time';
import { DayType, DayTypeResult } from './types';

const DAY_TYPE_ORDER: DayType[] = ['REST', 'LIGHT', 'NORMAL', 'PUSH'];

const FIXED_REST_MINUTES = 6 * 60;
const FIXED_LIGHT_MINUTES = 4 * 60;
const LOW_COMPLETION_THRESHOLD = 0.4;
const HIGH_PROCRASTINATION_THRESHOLD = 0.7;
const LOW_ENERGY_THRESHOLD = 2;
const HIGH_PRIORITY_MAX = 2;
const URGENT_DEADLINE_MS = 24 * 60 * 60 * 1000;

function rank(dayType: DayType): number {
  return DAY_TYPE_ORDER.indexOf(dayType);
}

function downgrade(dayType: DayType): DayType {
  const index = rank(dayType);
  return index > 0 ? DAY_TYPE_ORDER[index - 1] : dayType;
}

function upgrade(dayType: DayType): DayType {
  const index = rank(dayType);
  return index < DAY_TYPE_ORDER.length - 1 ? DAY_TYPE_ORDER[index + 1] : dayType;
}

function sumFixedBlockMinutes(blocks: CalendarBlock[], date: string): number {
  return blocks
    .filter((block) => block.date === date && block.type === 'fixed')
    .reduce((sum, block) => sum + (block.endMinutes - block.startMinutes), 0);
}

function classifyFromFixedBlocks(fixedMinutes: number): { dayType: DayType; reasonTag: string | null } {
  if (fixedMinutes >= FIXED_REST_MINUTES) {
    return { dayType: 'REST', reasonTag: 'fixed_blocks_6h_plus' };
  }
  if (fixedMinutes >= FIXED_LIGHT_MINUTES) {
    return { dayType: 'LIGHT', reasonTag: 'fixed_blocks_4h_to_6h' };
  }
  return { dayType: 'NORMAL', reasonTag: null };
}

function hasUrgentHighPriorityTask(tasks: Task[], date: string): boolean {
  const dayStart = parseDateKey(date);
  const windowEndMs = dayStart.getTime() + URGENT_DEADLINE_MS;

  return tasks.some((task) => {
    if (!task.deadline) return false;
    if (task.status === 'done' || task.status === 'cancelled') return false;
    if (task.priority > HIGH_PRIORITY_MAX) return false;

    const deadlineMs = new Date(task.deadline).getTime();
    if (!Number.isFinite(deadlineMs)) return false;

    return deadlineMs >= dayStart.getTime() && deadlineMs < windowEndMs;
  });
}

function applyDeadlineFloor(dayType: DayType): DayType {
  let next = dayType;
  while (rank(next) < rank('NORMAL')) {
    next = upgrade(next);
  }
  return next;
}

const HIGH_COMPLETION_THRESHOLD = 0.65;

function shouldPushDay(
  dayType: DayType,
  fixedMinutes: number,
  context: PlannerContext,
  snapshot: PlannerContext['lastDailySnapshot'],
  tasks: Task[],
  date: string
): boolean {
  if (dayType === 'REST') {
    return false;
  }
  if (fixedMinutes >= FIXED_LIGHT_MINUTES) {
    return false;
  }
  if (!hasUrgentHighPriorityTask(tasks, date)) {
    return false;
  }
  if (context.procrastinationIndex > HIGH_PROCRASTINATION_THRESHOLD) {
    return false;
  }
  if (snapshot && snapshot.energy <= LOW_ENERGY_THRESHOLD) {
    return false;
  }
  if (snapshot && snapshot.completionRate < HIGH_COMPLETION_THRESHOLD) {
    return false;
  }
  return true;
}

/**
 * Classifies day intensity from PlannerContext, tasks, and calendar blocks.
 * Must not read Session history, Reflection text, or UserModel directly.
 */
export function classify(
  context: PlannerContext,
  tasks: Task[],
  blocks: CalendarBlock[],
  date: string
): DayTypeResult {
  const reasonTags: string[] = [];
  const fixedMinutes = sumFixedBlockMinutes(blocks, date);
  const base = classifyFromFixedBlocks(fixedMinutes);

  let dayType = base.dayType;
  if (base.reasonTag) {
    reasonTags.push(base.reasonTag);
  }

  const snapshot = context.lastDailySnapshot;

  if (snapshot && snapshot.completionRate < LOW_COMPLETION_THRESHOLD) {
    dayType = downgrade(dayType);
    reasonTags.push('low_completion_rate');
  }

  if (context.procrastinationIndex > HIGH_PROCRASTINATION_THRESHOLD) {
    dayType = downgrade(dayType);
    reasonTags.push('high_procrastination');
  }

  if (snapshot && snapshot.energy <= LOW_ENERGY_THRESHOLD) {
    dayType = 'REST';
    reasonTags.push('low_energy');
  }

  if (hasUrgentHighPriorityTask(tasks, date)) {
    const beforeDeadlineFloor = dayType;
    dayType = applyDeadlineFloor(dayType);
    if (dayType !== beforeDeadlineFloor) {
      reasonTags.push('urgent_deadline_floor');
    }
  }

  if (shouldPushDay(dayType, fixedMinutes, context, snapshot, tasks, date)) {
    dayType = 'PUSH';
    reasonTags.push('push_urgent_capacity');
  }

  if (context.aiConfidence < 0.3) {
    reasonTags.push('low_ai_confidence');
  } else if (context.aiConfidence > 0.8) {
    reasonTags.push('high_ai_confidence');
  }

  return { dayType, reasonTags };
}
