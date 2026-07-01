import { CalendarBlock } from './calendarBlock';
import { CapacityPlan } from './capacityPlan';
import { Session } from './session';

export type DayType = 'REST' | 'LIGHT' | 'NORMAL' | 'PUSH';

/** Non-persistent value object (Architecture v1.1). */
export interface DayPlan {
  date: string;
  dayType: DayType;
  capacity: CapacityPlan;
  sessions: Session[];
  calendarBlocks: CalendarBlock[];
  reasonTags: string[];
  generatedAt: string;
}

/** Result of midday adjustment before applyDayPlan. */
export interface MiddayAdjustmentResult {
  plan: DayPlan;
  /** Task IDs whose future sessions were replaced; empty means status-only updates. */
  replanTaskIds: string[];
}