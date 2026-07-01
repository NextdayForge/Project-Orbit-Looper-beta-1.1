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
}
