import {
  BUFFER_NEED_RATIO_MAX,
  BUFFER_NEED_RATIO_MIN,
  DailyFeaturesSnapshot,
  DEFAULT_ENERGY_CURVE,
  UserModel,
} from '../../types/userModel';
import { PlannerEvaluationResult } from '../planner/plannerEvaluationTypes';
import { updateEnergyCurve } from './energyCurveLearning';
import { DailyFeatures } from './types';

const LEARNING_RATE = 0.2;
const EVAL_MIN_ESTIMATION_FACTOR = 0.5;
const EVAL_MAX_ESTIMATION_FACTOR = 2.0;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ema(current: number, next: number, rate: number): number {
  return current * (1 - rate) + next * rate;
}

function clampBufferNeed(bufferNeed: number): number {
  return clamp(bufferNeed, BUFFER_NEED_RATIO_MIN, BUFFER_NEED_RATIO_MAX);
}

function clampEstimationFactor(value: number): number {
  return clamp(value, EVAL_MIN_ESTIMATION_FACTOR, EVAL_MAX_ESTIMATION_FACTOR);
}

function slotCompletionRates(
  slotSignals: DailyFeatures['slotEnergySignals']
): number[] {
  return slotSignals.map((bucket) =>
    bucket.count > 0 ? clamp(bucket.sum / bucket.count, 0, 1) : 0
  );
}

function percentile75(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.75);
  return sorted[Math.min(index, sorted.length - 1)];
}

function applyFocusLengthLearning(userModel: UserModel, features: DailyFeatures): number {
  const observed = percentile75(features.focusDurationMinutes);
  if (observed == null || observed < 10) {
    return userModel.focusLength;
  }
  return Math.round(ema(userModel.focusLength, observed, LEARNING_RATE));
}

function toDailySnapshot(
  features: DailyFeatures,
  userModel: UserModel,
  focusLength: number
): DailyFeaturesSnapshot {
  const slotCompletion = slotCompletionRates(features.slotEnergySignals);

  return {
    date: features.date,
    completionRate: features.completionRate,
    skipRate: features.skipRate,
    rescheduleRate: features.rescheduleRate,
    overrunRate: Math.max(0, features.averageEstimationRatio - 1),
    slotCompletion,
    estimationRatio: {
      default:
        features.estimationSampleCount > 0 ? features.averageEstimationRatio : 1,
      ...features.estimationRatioByCategory,
    },
    focusDurationP75: percentile75(features.focusDurationMinutes) ?? focusLength,
    mood: features.mood ?? 0,
    energy: features.energy ?? 0,
    wins: features.wins,
    blockers: features.blockers,
    aiConfidence: userModel.lastDailySnapshot?.aiConfidence ?? 0.5,
  };
}

function applyEstimationLearning(
  userModel: UserModel,
  features: DailyFeatures
): Record<string, number> {
  const nextFactors = { ...userModel.estimationFactor };

  if (features.estimationSampleCount > 0) {
    const currentDefault = nextFactors.default ?? 1.0;
    nextFactors.default = clampEstimationFactor(
      ema(currentDefault, features.averageEstimationRatio, LEARNING_RATE)
    );
    nextFactors.general = nextFactors.default;
  }

  for (const [category, observedRatio] of Object.entries(features.estimationRatioByCategory)) {
    const current = nextFactors[category] ?? nextFactors.default ?? 1.0;
    nextFactors[category] = clampEstimationFactor(
      ema(current, observedRatio, LEARNING_RATE)
    );
  }

  return nextFactors;
}

function applyPlannerEvaluationAdjustments(
  userModel: UserModel,
  evaluation: PlannerEvaluationResult
): Pick<UserModel, 'bufferNeed' | 'estimationFactor' | 'lastDailySnapshot'> {
  let bufferNeed = userModel.bufferNeed;

  if (evaluation.bufferUtilizationRate > 0.9) {
    bufferNeed += 0.05;
  } else if (evaluation.bufferUtilizationRate < 0.3) {
    bufferNeed -= 0.05;
  }

  bufferNeed = clampBufferNeed(bufferNeed);

  let defaultFactor = userModel.estimationFactor.default ?? 1.0;
  let generalFactor = userModel.estimationFactor.general ?? defaultFactor;

  if (evaluation.completionRate > 0.8) {
    defaultFactor *= 0.98;
    generalFactor *= 0.98;
  }

  if (evaluation.overrunRate > 0.5) {
    defaultFactor *= 1.05;
    generalFactor *= 1.05;
  }

  defaultFactor = clampEstimationFactor(defaultFactor);
  generalFactor = clampEstimationFactor(generalFactor);

  let aiConfidence = userModel.lastDailySnapshot?.aiConfidence ?? 0.5;

  if (evaluation.aiSuccessRate > 0.8) {
    aiConfidence = Math.min(1, aiConfidence + 0.05);
  } else if (evaluation.aiSuccessRate < 0.5) {
    aiConfidence = Math.max(0, aiConfidence - 0.05);
  }

  const lastDailySnapshot = userModel.lastDailySnapshot
    ? { ...userModel.lastDailySnapshot, aiConfidence }
    : null;

  return {
    bufferNeed,
    estimationFactor: {
      ...userModel.estimationFactor,
      default: defaultFactor,
      general: generalFactor,
    },
    lastDailySnapshot,
  };
}

/**
 * Applies DailyFeatures and optional PlannerEvaluation to UserModel (MVP).
 */
export function update(
  userModel: UserModel,
  features: DailyFeatures,
  plannerEvaluation?: PlannerEvaluationResult | null
): UserModel {
  let bufferNeed = userModel.bufferNeed;
  if (features.estimationSampleCount > 0) {
    if (features.averageEstimationRatio > 1.1) {
      bufferNeed += 0.05;
    } else if (features.averageEstimationRatio < 0.9 && features.completionRate >= 0.8) {
      bufferNeed -= 0.05;
    }
  }
  bufferNeed = clampBufferNeed(bufferNeed);

  const baseCurve =
    userModel.energyCurve.length > 0 ? userModel.energyCurve : [...DEFAULT_ENERGY_CURVE];

  const focusLength = applyFocusLengthLearning(userModel, features);

  let nextModel: UserModel = {
    ...userModel,
    estimationFactor: applyEstimationLearning(userModel, features),
    energyCurve: updateEnergyCurve(
      baseCurve,
      features.slotEnergySignals,
      features.energy
    ),
    bufferNeed,
    focusLength,
    procrastinationIndex:
      features.timedOutcomeCount > 0
        ? clamp(
            ema(userModel.procrastinationIndex, features.procrastinationScore, LEARNING_RATE),
            0,
            1
          )
        : userModel.procrastinationIndex,
    lastDailySnapshot: toDailySnapshot(features, userModel, focusLength),
    version: userModel.version + 1,
    updatedAt: new Date().toISOString(),
  };

  if (plannerEvaluation) {
    const evaluationAdjustments = applyPlannerEvaluationAdjustments(nextModel, plannerEvaluation);
    nextModel = {
      ...nextModel,
      ...evaluationAdjustments,
    };
  }

  return nextModel;
}
