import { DayPlan } from '../../types/dayPlan';
import { DecisionLog } from '../../types/decisionLog';
import { Session } from '../../types/session';

export interface PlannerEvaluationInput {
  dayPlan: DayPlan;
  actualSessions: Session[];
  aiDecisionLogs: DecisionLog[];
}

export interface PlannerEvaluationSampleCounts {
  plannedSessions: number;
  placementSuccessful: number;
  sessionsWithOutcome: number;
  completedSessions: number;
  overrunSessions: number;
  lateStartSessions: number;
  aiPlacementRuns: number;
  aiGeminiAttempts: number;
  aiSuccessfulRuns: number;
}

export interface PlannerEvaluationResult {
  date: string;
  dayType: DayPlan['dayType'];
  placementSuccessRate: number;
  completionRate: number;
  overrunRate: number;
  averageFocusScore: number;
  lateStartRate: number;
  bufferUtilizationRate: number;
  aiUtilizationRate: number;
  aiSuccessRate: number;
  sampleCounts: PlannerEvaluationSampleCounts;
  evaluatedAt: string;
}

export interface AiPlacementDecision {
  usedGemini: boolean;
  fellBackToLocal: boolean;
}
