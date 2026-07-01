import { DecisionLog } from '../../types/decisionLog';
import {
  PlannerEvaluationResult,
  PlannerEvaluationSampleCounts,
} from '../planner/plannerEvaluationTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseSampleCounts(value: unknown): PlannerEvaluationSampleCounts | null {
  if (!isRecord(value)) {
    return null;
  }

  const fields: Array<keyof PlannerEvaluationSampleCounts> = [
    'plannedSessions',
    'placementSuccessful',
    'sessionsWithOutcome',
    'completedSessions',
    'overrunSessions',
    'lateStartSessions',
    'aiPlacementRuns',
    'aiGeminiAttempts',
    'aiSuccessfulRuns',
  ];

  for (const field of fields) {
    if (!Number.isInteger(value[field])) {
      return null;
    }
  }

  return value as unknown as PlannerEvaluationSampleCounts;
}

function parseRateFields(decision: Record<string, unknown>): Record<string, number> | null {
  const fields = [
    'placementSuccessRate',
    'completionRate',
    'overrunRate',
    'averageFocusScore',
    'lateStartRate',
    'bufferUtilizationRate',
    'aiUtilizationRate',
    'aiSuccessRate',
  ] as const;

  const rates: Record<string, number> = {};
  for (const field of fields) {
    if (!isFiniteNumber(decision[field])) {
      return null;
    }
    rates[field] = decision[field];
  }

  return rates;
}

export function parsePlannerEvaluationFromDecisionLog(
  log: DecisionLog
): PlannerEvaluationResult | null {
  if (log.type !== 'planner_evaluation') {
    return null;
  }

  const rates = parseRateFields(log.decision);
  const sampleCounts = parseSampleCounts(log.decision.sampleCounts);
  const generatedAt = log.decision.generatedAt;

  if (!rates || !sampleCounts || typeof generatedAt !== 'string' || !generatedAt.trim()) {
    return null;
  }

  return {
    date: log.date,
    dayType: 'NORMAL',
    placementSuccessRate: rates.placementSuccessRate,
    completionRate: rates.completionRate,
    overrunRate: rates.overrunRate,
    averageFocusScore: rates.averageFocusScore,
    lateStartRate: rates.lateStartRate,
    bufferUtilizationRate: rates.bufferUtilizationRate,
    aiUtilizationRate: rates.aiUtilizationRate,
    aiSuccessRate: rates.aiSuccessRate,
    sampleCounts,
    evaluatedAt: generatedAt,
  };
}

export function selectLatestPlannerEvaluation(
  logs: DecisionLog[]
): PlannerEvaluationResult | null {
  const evaluations = logs
    .filter((log) => log.type === 'planner_evaluation')
    .map(parsePlannerEvaluationFromDecisionLog)
    .filter((evaluation): evaluation is PlannerEvaluationResult => evaluation != null)
    .sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));

  return evaluations[0] ?? null;
}
