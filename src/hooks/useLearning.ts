import { useCallback } from 'react';
import { learningPipeline } from '../intelligence/learning/LearningPipeline';
import {
  plannerEvaluationService,
  PlannerEvaluationResult,
} from '../intelligence/planner/PlannerEvaluationService';
import { decisionLogRepository, sessionRepository } from '../repositories';
import { DayPlan } from '../types/dayPlan';
import { DecisionLog } from '../types/decisionLog';
import { generateId } from '../utils/time';

const PLANNER_EVALUATION_REASON_TAGS = ['evaluation', 'planner', 'learning'] as const;

function buildPlannerEvaluationDecisionLog(result: PlannerEvaluationResult): DecisionLog {
  return {
    id: generateId(),
    date: result.date,
    type: 'planner_evaluation',
    decision: {
      placementSuccessRate: result.placementSuccessRate,
      completionRate: result.completionRate,
      overrunRate: result.overrunRate,
      averageFocusScore: result.averageFocusScore,
      lateStartRate: result.lateStartRate,
      bufferUtilizationRate: result.bufferUtilizationRate,
      aiUtilizationRate: result.aiUtilizationRate,
      aiSuccessRate: result.aiSuccessRate,
      sampleCounts: result.sampleCounts,
      generatedAt: result.evaluatedAt,
    },
    reasonTags: [...PLANNER_EVALUATION_REASON_TAGS],
    inputSnapshot: {},
    outputSnapshot: {},
    createdAt: new Date().toISOString(),
  };
}

function hasPlannerEvaluationForDate(decisionLogs: DecisionLog[]): boolean {
  return decisionLogs.some((log) => log.type === 'planner_evaluation');
}

/**
 * Nightly LearningPipeline and planner quality evaluation.
 * Reflection persistence is composed in useDayOrchestrator.
 */
export function useLearning() {
  const runLearningPipeline = useCallback(async (date?: string) => {
    await learningPipeline.run(date);
  }, []);

  const evaluatePlanner = useCallback(
    async (dayPlan: DayPlan): Promise<PlannerEvaluationResult | null> => {
      const [sessions, decisionLogs] = await Promise.all([
        sessionRepository.getAll(),
        decisionLogRepository.getByDate(dayPlan.date),
      ]);

      if (hasPlannerEvaluationForDate(decisionLogs)) {
        return null;
      }

      // Intentionally NOT filtered by isDayProgressSession here: PlannerEvaluationService
      // needs to see each planned session's real status/archived flag directly, so it can
      // tell "deleted by the user" (archived, excluded from the evaluation) apart from
      // "rescheduled away" (a genuine placement failure) — both would otherwise look like
      // the same "missing from the list" case if pre-filtered.
      const actualSessions = sessions.filter((session) => session.date === dayPlan.date);
      const aiDecisionLogs = decisionLogs.filter((log) => log.type === 'planner_ai_generate');

      const result = plannerEvaluationService.evaluate({
        dayPlan,
        actualSessions,
        aiDecisionLogs,
      });

      await decisionLogRepository.append(buildPlannerEvaluationDecisionLog(result));

      return result;
    },
    []
  );

  return {
    runLearningPipeline,
    evaluatePlanner,
  };
}

export type UseLearningReturn = ReturnType<typeof useLearning>;
