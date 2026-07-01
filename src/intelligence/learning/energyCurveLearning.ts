import { DEFAULT_ENERGY_CURVE } from '../../types/userModel';
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
} from '../planner/plannerConstants';

export const ENERGY_SLOT_COUNT = DEFAULT_ENERGY_CURVE.length;

export function slotIndexForMinute(
  startMinutes: number,
  slotCount = ENERGY_SLOT_COUNT,
  dayStartMinutes = DEFAULT_DAY_START_MINUTES,
  dayEndMinutes = DEFAULT_DAY_END_MINUTES
): number {
  const span = dayEndMinutes - dayStartMinutes;
  if (span <= 0 || slotCount <= 0) {
    return 0;
  }

  const offset = Math.max(0, startMinutes - dayStartMinutes);
  return Math.min(slotCount - 1, Math.floor((offset / span) * slotCount));
}

export type SlotEnergyAccumulator = { sum: number; count: number };

export function createEmptySlotAccumulators(
  slotCount = ENERGY_SLOT_COUNT
): SlotEnergyAccumulator[] {
  return Array.from({ length: slotCount }, () => ({ sum: 0, count: 0 }));
}

/** Maps session execution quality to a 0–1 energy signal for that time slot. */
export function sessionEnergySignal(completed: boolean, focusScore: number): number {
  const focus = Math.max(0, Math.min(1, focusScore));
  return completed ? focus * 0.7 + 0.3 : focus * 0.45;
}

export function updateEnergyCurve(
  currentCurve: number[],
  slotAccumulators: SlotEnergyAccumulator[],
  reflectionEnergy: number | null,
  learningRate = 0.2
): number[] {
  const slotCount = Math.max(currentCurve.length, slotAccumulators.length, ENERGY_SLOT_COUNT);
  const next = Array.from({ length: slotCount }, (_, index) =>
    clamp(currentCurve[index] ?? DEFAULT_ENERGY_CURVE[index] ?? 0.5, 0.1, 1)
  );

  for (let index = 0; index < slotAccumulators.length; index += 1) {
    const bucket = slotAccumulators[index];
    if (!bucket || bucket.count <= 0) {
      continue;
    }
    const observed = bucket.sum / bucket.count;
    next[index] = clamp(ema(next[index], observed, learningRate), 0.1, 1);
  }

  if (reflectionEnergy != null) {
    const normalized = clamp(reflectionEnergy / 5, 0, 1);
    for (let index = 0; index < next.length; index += 1) {
      next[index] = clamp(ema(next[index], normalized, learningRate * 0.35), 0.1, 1);
    }
  }

  return next;
}

function ema(current: number, next: number, rate: number): number {
  return current * (1 - rate) + next * rate;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function energyCurveDiffersFromDefault(curve: number[]): boolean {
  return curve.some(
    (value, index) => Math.abs(value - (DEFAULT_ENERGY_CURVE[index] ?? 0.5)) > 0.02
  );
}
