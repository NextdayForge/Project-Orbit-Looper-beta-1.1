export interface CapacityPlan {
  availableMinutes: number;
  targetFocusMinutes: number;
  targetSessionCount: number;
  bufferMinutes: number;
  breakMinutes: number;
  reasonTags: string[];
}

export interface CapacityPlanOptions {
  availableMinutesOverride?: number;
  /** User's settings.wakeMinutes / settings.sleepMinutes, used to derive the overnight sleep duration
   *  when availableMinutesOverride is not given. Falls back to DEFAULT_SETTINGS (8h) if omitted. */
  wakeMinutes?: number;
  sleepMinutes?: number;
}
