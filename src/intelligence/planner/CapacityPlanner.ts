import { CalendarBlock } from '../../types/calendarBlock';
import { CapacityPlan, CapacityPlanOptions } from '../../types/capacityPlan';
import { Task } from '../../types/task';
import { PlannerContext } from '../../types/userModel';
import { DayType } from './types';

const MINUTES_PER_DAY = 24 * 60;
const SLEEP_MINUTES = 8 * 60;
const MIN_BUFFER_MINUTES = 30;
const MAX_BUFFER_MINUTES = 180;
const BREAK_RATIO = 0.2;

const FOCUS_RATIO: Record<DayType, number> = {
  REST: 0.2,
  LIGHT: 0.35,
  NORMAL: 0.5,
  PUSH: 0.65,
};

const CAPACITY_REASON_TAG: Record<DayType, string> = {
  REST: 'capacity_rest',
  LIGHT: 'capacity_light',
  NORMAL: 'capacity_normal',
  PUSH: 'capacity_push',
};

function sumFixedBlockMinutes(blocks: CalendarBlock[]): number {
  return blocks
    .filter((block) => block.type === 'fixed')
    .reduce((sum, block) => sum + (block.endMinutes - block.startMinutes), 0);
}

function resolveBufferMinutes(availableMinutes: number, bufferNeed: number): {
  bufferMinutes: number;
  adjusted: boolean;
} {
  const raw = availableMinutes * bufferNeed;
  if (raw < MIN_BUFFER_MINUTES) {
    return { bufferMinutes: MIN_BUFFER_MINUTES, adjusted: true };
  }
  if (raw > MAX_BUFFER_MINUTES) {
    return { bufferMinutes: MAX_BUFFER_MINUTES, adjusted: true };
  }
  return { bufferMinutes: raw, adjusted: false };
}

function buildCapacityPlan(
  context: PlannerContext,
  dayType: DayType,
  availableMinutes: number
): CapacityPlan {
  const reasonTags: string[] = [CAPACITY_REASON_TAG[dayType]];
  const targetFocusMinutes = Math.round(availableMinutes * FOCUS_RATIO[dayType]);
  const { bufferMinutes, adjusted } = resolveBufferMinutes(availableMinutes, context.bufferNeed);

  if (adjusted) {
    reasonTags.push('buffer_adjusted');
  }

  const breakMinutes = Math.round(targetFocusMinutes * BREAK_RATIO);
  const focusLength = context.focusLength > 0 ? context.focusLength : 45;
  const targetSessionCount = Math.ceil(targetFocusMinutes / focusLength);

  return {
    availableMinutes,
    targetFocusMinutes,
    targetSessionCount,
    bufferMinutes,
    breakMinutes,
    reasonTags,
  };
}

/**
 * Computes daily capacity targets from PlannerContext, day type, and calendar blocks.
 * Does not read Session history, Reflection text, or UserModel directly.
 */
export function planCapacity(
  context: PlannerContext,
  dayType: DayType,
  _tasks: Task[],
  blocks: CalendarBlock[],
  options?: CapacityPlanOptions
): CapacityPlan {
  if (options?.availableMinutesOverride !== undefined) {
    return buildCapacityPlan(context, dayType, Math.max(0, options.availableMinutesOverride));
  }

  const fixedMinutes = sumFixedBlockMinutes(blocks);
  const availableMinutes = Math.max(0, MINUTES_PER_DAY - fixedMinutes - SLEEP_MINUTES);
  return buildCapacityPlan(context, dayType, availableMinutes);
}
