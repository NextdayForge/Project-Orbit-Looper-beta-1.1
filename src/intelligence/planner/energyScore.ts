import { DEFAULT_DAY_END_MINUTES, DEFAULT_DAY_START_MINUTES } from './plannerConstants';

export function averageEnergyForRange(
  startMinutes: number,
  durationMinutes: number,
  energyCurve: number[],
  dayStartMinutes = DEFAULT_DAY_START_MINUTES,
  dayEndMinutes = DEFAULT_DAY_END_MINUTES
): number {
  if (energyCurve.length === 0 || durationMinutes <= 0) {
    return 0.5;
  }

  const span = dayEndMinutes - dayStartMinutes;
  if (span <= 0) {
    return 0.5;
  }

  let sum = 0;
  let count = 0;

  for (let minute = startMinutes; minute < startMinutes + durationMinutes; minute += 5) {
    const offset = Math.max(0, minute - dayStartMinutes);
    const index = Math.min(
      energyCurve.length - 1,
      Math.floor((offset / span) * energyCurve.length)
    );
    sum += energyCurve[index] ?? 0.5;
    count += 1;
  }

  return count > 0 ? sum / count : 0.5;
}
