/** Shared planner time bounds — single source of truth (Phase 2). */
export const DEFAULT_DAY_START_MINUTES = 7 * 60;
export const DEFAULT_DAY_END_MINUTES = 22 * 60;
export const PLACEMENT_SNAP_MINUTES = 5;
export const MINUTES_PER_DAY = 24 * 60;

/** Absolute minute bounds for raw JSON parsing (0:00–24:00). */
export const VALID_MINUTE_MIN = 0;
export const VALID_MINUTE_MAX = MINUTES_PER_DAY;

export function clampDayStartMinutes(minutes: number): number {
  return Math.max(VALID_MINUTE_MIN, Math.min(minutes, DEFAULT_DAY_END_MINUTES - PLACEMENT_SNAP_MINUTES));
}

export function clampDayEndMinutes(minutes: number): number {
  return Math.max(DEFAULT_DAY_START_MINUTES + PLACEMENT_SNAP_MINUTES, Math.min(minutes, VALID_MINUTE_MAX));
}
