import { DayPlan } from '../../types/dayPlan';
import { Task } from '../../types/task';
import { PlannerContext } from '../../types/userModel';
import { minutesToTime } from '../../utils/time';
import { DAY_TYPE_LABELS, reasonTagsToSentences } from '../../presentation/explain/reasonLabels';

export interface PlanSummary {
  dayTypeTitle: string;
  dayTypeTagline: string;
  reasons: string[];
  sessions: { title: string; time: string }[];
  targetFocusMinutes: number;
  targetSessionCount: number;
}

/** Human-readable, model-grounding traits for the coach prompt. */
export function summarizeTraits(context: PlannerContext): string[] {
  const traits: string[] = [];
  traits.push(`平均集中時間: 約${Math.round(context.focusLength)}分`);

  const pi = context.procrastinationIndex;
  if (pi >= 0.6) {
    traits.push('先延ばし傾向: 高め');
  } else if (pi <= 0.3) {
    traits.push('先延ばし傾向: 低め');
  } else {
    traits.push('先延ばし傾向: ふつう');
  }

  const curve = context.energyCurve;
  if (curve && curve.length > 0) {
    let peakIndex = 0;
    for (let i = 1; i < curve.length; i++) {
      if (curve[i] > curve[peakIndex]) {
        peakIndex = i;
      }
    }
    const ratio = peakIndex / curve.length;
    const phrase = ratio < 0.25 ? '朝' : ratio < 0.5 ? '午前〜昼' : ratio < 0.75 ? '午後' : '夜';
    traits.push(`調子が出やすい時間帯: ${phrase}`);
  }

  return traits;
}

export function summarizePlan(plan: DayPlan, tasks: Task[]): PlanSummary {
  const label = DAY_TYPE_LABELS[plan.dayType];
  const titleById = new Map(tasks.map((task) => [task.id, task.title]));

  const sessions = [...plan.sessions]
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map((session) => ({
      title: (session.taskId && titleById.get(session.taskId)) || 'セッション',
      time: `${minutesToTime(session.startMinutes)}–${minutesToTime(session.endMinutes)}`,
    }));

  return {
    dayTypeTitle: label.title,
    dayTypeTagline: label.tagline,
    reasons: reasonTagsToSentences(plan.reasonTags),
    sessions,
    targetFocusMinutes: plan.capacity.targetFocusMinutes,
    targetSessionCount: plan.capacity.targetSessionCount,
  };
}
