import { CalendarBlock } from '../../types/calendarBlock';
import { CapacityPlan } from '../../types/capacityPlan';
import { DayType } from '../../types/dayPlan';
import { Session } from '../../types/session';
import { Task } from '../../types/task';
import { PlannerContext } from '../../types/userModel';

export type { DayType };
export type { CapacityPlan };

export interface DayTypeResult {
  dayType: DayType;
  reasonTags: string[];
}

export type AiPlacementFallbackReason =
  | 'api_key_not_configured'
  | 'api_failure'
  | 'validation_failure'
  | 'low_ai_confidence'
  | null;

export interface AiPlacementAudit {
  modelName: string;
  usedGemini: boolean;
  fellBackToLocal: boolean;
  fallbackReason: AiPlacementFallbackReason;
  retryCount: number;
  promptHash: string;
  responseHash: string | null;
  dayType: DayType;
  capacity: Pick<
    CapacityPlan,
    'availableMinutes' | 'targetFocusMinutes' | 'targetSessionCount' | 'bufferMinutes' | 'breakMinutes'
  >;
  sessionCount: number;
  reasonTags: string[];
  generatedAt: string;
}

export interface PlacementSlotCandidate {
  startMinutes: number;
  endMinutes: number;
  score: number;
}

export interface PlacementDecisionRecord {
  taskId: string;
  sessionId: string;
  score: number;
  reasonTags: string[];
  candidateSlots: PlacementSlotCandidate[];
  chosenSlot: { startMinutes: number; endMinutes: number };
}

export interface PlacementResult {
  sessions: Session[];
  blocks: CalendarBlock[];
  reasonTags: string[];
  placementDecisions?: PlacementDecisionRecord[];
  aiAudit?: AiPlacementAudit;
}
export interface PlacementInput {
  context: PlannerContext;
  capacity: CapacityPlan;
  tasks: Task[];
  blocks: CalendarBlock[];
  date: string;
  cursorStartMinutes?: number;
  anchoredSessions?: Session[];
  dayStartMinutes?: number;
  dayEndMinutes?: number;
}

export interface PlacementOptions {
  cursorStartMinutes?: number;
  anchoredSessions?: Session[];
  dayStartMinutes?: number;
  dayEndMinutes?: number;
}
