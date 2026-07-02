import { DecisionLog } from '../../types/decisionLog';
import { UserModel } from '../../types/userModel';
import { SlotEnergyAccumulator } from './energyCurveLearning';

export interface DailyFeatures {
  date: string;
  completionRate: number;
  skipRate: number;
  rescheduleRate: number;
  averageEstimationRatio: number;
  estimationSampleCount: number;
  estimationRatioByCategory: Record<string, number>;
  averageFocusScore: number;
  procrastinationScore: number;
  /** Count of outcomes with real timer data; used to gate timer-dependent learning signals. */
  timedOutcomeCount: number;
  focusDurationMinutes: number[];
  energy: number | null;
  mood: number | null;
  wins: string[];
  blockers: string[];
  slotEnergySignals: SlotEnergyAccumulator[];
}

export interface LearningPipelineResult {
  userModel: UserModel;
  features: DailyFeatures;
  decisionLog: DecisionLog;
}
