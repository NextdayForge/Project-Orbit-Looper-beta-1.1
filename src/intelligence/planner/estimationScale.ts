import { TaskCategory } from '../../types/task';

export function resolveEstimationFactor(
  factors: Record<string, number>,
  category: string
): number {
  const value = factors[category] ?? factors.general ?? factors.default ?? 1.0;
  return Number.isFinite(value) && value > 0 ? value : 1.0;
}

export function scaleMinutesForEstimation(
  baseMinutes: number,
  category: TaskCategory | string,
  factors: Record<string, number>
): number {
  if (baseMinutes <= 0) {
    return 0;
  }
  return Math.max(5, Math.round(baseMinutes * resolveEstimationFactor(factors, category)));
}
