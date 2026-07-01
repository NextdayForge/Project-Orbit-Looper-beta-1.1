import { DayPlan } from '../../types/dayPlan';
import { DecisionLog } from '../../types/decisionLog';
import { Session } from '../../types/session';
import {
  AiPlacementDecision,
  PlannerEvaluationInput,
  PlannerEvaluationResult,
  PlannerEvaluationSampleCounts,
} from './plannerEvaluationTypes';

const FAILED_PLACEMENT_STATUSES = new Set<Session['status']>(['rescheduled', 'cancelled', 'skipped']);

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function resolveActualSessions(dayPlan: DayPlan, actualSessions: Session[]): Session[] {
  const plannedIds = new Set(dayPlan.sessions.map((session) => session.id));
  return actualSessions.filter((session) => plannedIds.has(session.id));
}

function countPlacementSuccess(plannedSessions: Session[], actualById: Map<string, Session>): {
  successful: number;
  total: number;
} {
  let successful = 0;

  for (const planned of plannedSessions) {
    const actual = actualById.get(planned.id);
    if (actual && !FAILED_PLACEMENT_STATUSES.has(actual.status)) {
      successful += 1;
    }
  }

  return { successful, total: plannedSessions.length };
}

function computeOutcomeMetrics(sessions: Session[]): {
  completionRate: number;
  overrunRate: number;
  averageFocusScore: number;
  lateStartRate: number;
  sessionsWithOutcome: number;
  completedSessions: number;
  overrunSessions: number;
  lateStartSessions: number;
} {
  const withOutcome = sessions.filter((session) => session.outcome != null);
  const outcomes = withOutcome.map((session) => session.outcome!);
  const completedSessions = outcomes.filter((outcome) => outcome.completed).length;
  const overrunSessions = outcomes.filter((outcome) => outcome.estimationRatio > 1).length;
  const lateStartSessions = outcomes.filter((outcome) => outcome.startedLate).length;

  return {
    completionRate: rate(completedSessions, outcomes.length),
    overrunRate: rate(overrunSessions, outcomes.length),
    averageFocusScore: average(outcomes.map((outcome) => outcome.focusScore)),
    lateStartRate: rate(lateStartSessions, outcomes.length),
    sessionsWithOutcome: outcomes.length,
    completedSessions,
    overrunSessions,
    lateStartSessions,
  };
}

function sumBufferBlockMinutes(dayPlan: DayPlan): number {
  return dayPlan.calendarBlocks
    .filter((block) => block.type === 'buffer')
    .reduce((sum, block) => sum + (block.endMinutes - block.startMinutes), 0);
}

function computeBufferUtilizationRate(dayPlan: DayPlan): number {
  const plannedBufferMinutes = dayPlan.capacity.bufferMinutes;
  if (plannedBufferMinutes <= 0) {
    return 0;
  }

  return sumBufferBlockMinutes(dayPlan) / plannedBufferMinutes;
}

function parseAiPlacementDecision(log: DecisionLog): AiPlacementDecision | null {
  const usedGemini = log.decision.usedGemini;
  const fellBackToLocal = log.decision.fellBackToLocal;

  if (typeof usedGemini !== 'boolean' || typeof fellBackToLocal !== 'boolean') {
    return null;
  }

  return { usedGemini, fellBackToLocal };
}

function computeAiMetrics(aiDecisionLogs: DecisionLog[]): {
  aiUtilizationRate: number;
  aiSuccessRate: number;
  aiPlacementRuns: number;
  aiGeminiAttempts: number;
  aiSuccessfulRuns: number;
} {
  const parsed = aiDecisionLogs
    .map(parseAiPlacementDecision)
    .filter((decision): decision is AiPlacementDecision => decision != null);

  const aiPlacementRuns = parsed.length;
  const aiGeminiAttempts = parsed.filter((decision) => decision.usedGemini).length;
  const aiSuccessfulRuns = parsed.filter(
    (decision) => decision.usedGemini && !decision.fellBackToLocal
  ).length;

  return {
    aiUtilizationRate: rate(aiGeminiAttempts, aiPlacementRuns),
    aiSuccessRate: rate(aiSuccessfulRuns, aiGeminiAttempts),
    aiPlacementRuns,
    aiGeminiAttempts,
    aiSuccessfulRuns,
  };
}

/**
 * Compares a DayPlan snapshot with executed Session outcomes.
 * Pure evaluation — does not read Repository or mutate UserModel.
 */
export class PlannerEvaluationService {
  evaluate(input: PlannerEvaluationInput): PlannerEvaluationResult {
    const { dayPlan, actualSessions, aiDecisionLogs } = input;
    const matchedSessions = resolveActualSessions(dayPlan, actualSessions);
    const actualById = new Map(matchedSessions.map((session) => [session.id, session]));

    const { successful, total } = countPlacementSuccess(dayPlan.sessions, actualById);
    const outcomeMetrics = computeOutcomeMetrics(matchedSessions);
    const aiMetrics = computeAiMetrics(aiDecisionLogs);

    const sampleCounts: PlannerEvaluationSampleCounts = {
      plannedSessions: total,
      placementSuccessful: successful,
      sessionsWithOutcome: outcomeMetrics.sessionsWithOutcome,
      completedSessions: outcomeMetrics.completedSessions,
      overrunSessions: outcomeMetrics.overrunSessions,
      lateStartSessions: outcomeMetrics.lateStartSessions,
      aiPlacementRuns: aiMetrics.aiPlacementRuns,
      aiGeminiAttempts: aiMetrics.aiGeminiAttempts,
      aiSuccessfulRuns: aiMetrics.aiSuccessfulRuns,
    };

    return {
      date: dayPlan.date,
      dayType: dayPlan.dayType,
      placementSuccessRate: rate(successful, total),
      completionRate: outcomeMetrics.completionRate,
      overrunRate: outcomeMetrics.overrunRate,
      averageFocusScore: outcomeMetrics.averageFocusScore,
      lateStartRate: outcomeMetrics.lateStartRate,
      bufferUtilizationRate: computeBufferUtilizationRate(dayPlan),
      aiUtilizationRate: aiMetrics.aiUtilizationRate,
      aiSuccessRate: aiMetrics.aiSuccessRate,
      sampleCounts,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export const plannerEvaluationService = new PlannerEvaluationService();

export type {
  PlannerEvaluationInput,
  PlannerEvaluationResult,
  PlannerEvaluationSampleCounts,
} from './plannerEvaluationTypes';
