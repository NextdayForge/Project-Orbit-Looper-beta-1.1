export const BUFFER_NEED_RATIO_MIN = 0.05;
export const BUFFER_NEED_RATIO_MAX = 0.5;
export const DEFAULT_BUFFER_NEED = 0.2;
export const DEFAULT_AI_CONFIDENCE = 0.5;

export interface DailyFeaturesSnapshot {
  date: string;
  completionRate: number;
  skipRate: number;
  rescheduleRate: number;
  overrunRate: number;
  slotCompletion: number[];
  estimationRatio: Record<string, number>;
  focusDurationP75: number;
  mood: number;
  energy: number;
  wins: string[];
  blockers: string[];
  aiConfidence: number;
}

export interface UserModel {
  id: string;
  procrastinationIndex: number;
  energyCurve: number[];
  focusLength: number;
  estimationFactor: Record<string, number>;
  bufferNeed: number;
  lastDailySnapshot: DailyFeaturesSnapshot | null;
  version: number;
  updatedAt: string;
}

export type PlannerContext = Pick<
  UserModel,
  'procrastinationIndex' | 'energyCurve' | 'focusLength' | 'estimationFactor' | 'bufferNeed' | 'lastDailySnapshot'
> & {
  aiConfidence: number;
};

export const DEFAULT_ENERGY_CURVE: number[] = [0.5, 0.85, 0.55, 0.7, 0.6, 0.35];

export function createDefaultUserModel(now = new Date()): UserModel {
  return {
    id: 'user-model',
    procrastinationIndex: 0.3,
    energyCurve: [...DEFAULT_ENERGY_CURVE],
    focusLength: 45,
    estimationFactor: { default: 1.0, general: 1.0 },
    bufferNeed: DEFAULT_BUFFER_NEED,
    lastDailySnapshot: null,
    version: 1,
    updatedAt: now.toISOString(),
  };
}

export function toPlannerContext(userModel: UserModel): PlannerContext {
  return {
    procrastinationIndex: userModel.procrastinationIndex,
    energyCurve: userModel.energyCurve,
    focusLength: userModel.focusLength,
    estimationFactor: userModel.estimationFactor,
    bufferNeed: userModel.bufferNeed,
    lastDailySnapshot: userModel.lastDailySnapshot,
    aiConfidence: userModel.lastDailySnapshot?.aiConfidence ?? DEFAULT_AI_CONFIDENCE,
  };
}
