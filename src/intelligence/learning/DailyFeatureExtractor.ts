import { Reflection } from '../../types/reflection';
import { Session, isDayProgressSession } from '../../types/session';
import { Task } from '../../types/task';
import {
  createEmptySlotAccumulators,
  sessionEnergySignal,
  slotIndexForMinute,
} from './energyCurveLearning';
import { DailyFeatures } from './types';

const MIN_VALID_ESTIMATION_RATIO = 0.15;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageByCategory(
  samples: Array<{ category: string; ratio: number }>
): Record<string, number> {
  const buckets = new Map<string, number[]>();

  for (const sample of samples) {
    const values = buckets.get(sample.category) ?? [];
    values.push(sample.ratio);
    buckets.set(sample.category, values);
  }

  const result: Record<string, number> = {};
  for (const [category, values] of buckets.entries()) {
    result[category] = average(values);
  }
  return result;
}

function isValidEstimationSample(outcome: NonNullable<Session['outcome']>): boolean {
  if (outcome.estimatedMinutes <= 0) {
    return false;
  }
  if (outcome.estimationRatio < MIN_VALID_ESTIMATION_RATIO) {
    return false;
  }
  return Number.isFinite(outcome.estimationRatio);
}

/**
 * Aggregates daily learning signals from Session outcomes (MVP).
 * Mood / energy come from Reflection when present.
 */
export function extract(
  date: string,
  sessions: Session[],
  reflection: Reflection | null,
  tasks: Task[]
): DailyFeatures {
  const taskCategoryById = new Map(tasks.map((task) => [task.id, task.category]));
  const daySessions = sessions.filter(
    (session) => session.date === date && isDayProgressSession(session)
  );
  const allDaySessions = sessions.filter(
    (session) => session.date === date && (isDayProgressSession(session) || session.status === 'rescheduled')
  );
  const withOutcome = daySessions.filter((session) => session.outcome != null);

  const outcomes = withOutcome.map((session) => session.outcome!);
  const completedCount = outcomes.filter((outcome) => outcome.completed).length;
  const lateCount = outcomes.filter((outcome) => outcome.startedLate).length;
  const skipCount = daySessions.filter(
    (session) =>
      session.status === 'skipped' ||
      (session.status === 'cancelled' && !session.outcome?.completed)
  ).length;
  const rescheduleCount = allDaySessions.filter((session) => session.status === 'rescheduled').length;
  const rateDenominator = Math.max(allDaySessions.length, 1);

  const focusDurationMinutes = withOutcome
    .filter((session) => session.outcome!.completed && session.outcome!.actualMinutes > 0)
    .map((session) => session.outcome!.actualMinutes);

  const estimationSamples = withOutcome
    .filter((session) => session.outcome && isValidEstimationSample(session.outcome))
    .map((session) => ({
      category: (session.taskId && taskCategoryById.get(session.taskId)) || 'general',
      ratio: session.outcome!.estimationRatio,
    }));

  const slotEnergySignals = createEmptySlotAccumulators();
  for (const session of withOutcome) {
    const outcome = session.outcome!;
    const slotIndex = slotIndexForMinute(session.startMinutes);
    const signal = sessionEnergySignal(outcome.completed, outcome.focusScore);
    slotEnergySignals[slotIndex].sum += signal;
    slotEnergySignals[slotIndex].count += 1;
  }

  return {
    date,
    completionRate: outcomes.length > 0 ? completedCount / outcomes.length : 0,
    skipRate: allDaySessions.length > 0 ? skipCount / rateDenominator : 0,
    rescheduleRate: allDaySessions.length > 0 ? rescheduleCount / rateDenominator : 0,
    averageEstimationRatio: average(estimationSamples.map((sample) => sample.ratio)),
    estimationSampleCount: estimationSamples.length,
    estimationRatioByCategory: averageByCategory(estimationSamples),
    averageFocusScore: average(outcomes.map((outcome) => outcome.focusScore)),
    procrastinationScore: outcomes.length > 0 ? lateCount / outcomes.length : 0,
    focusDurationMinutes,
    energy: reflection?.energy ?? null,
    mood: reflection?.mood ?? null,
    wins: reflection?.wins?.slice(0, 5) ?? [],
    blockers: reflection?.blockers?.slice(0, 5) ?? [],
    slotEnergySignals,
  };
}
