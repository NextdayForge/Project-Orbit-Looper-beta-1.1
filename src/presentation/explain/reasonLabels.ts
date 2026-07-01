import { DayPlan, DayType } from '../../types/dayPlan';

/**
 * Human-readable Japanese translations for planner DayTypes and reasonTags.
 * Supports the Explainable AI principle: the user can always see "なぜこの予定なのか".
 */

export interface DayTypeLabel {
  title: string;
  tagline: string;
}

export const DAY_TYPE_LABELS: Record<DayType, DayTypeLabel> = {
  REST: { title: 'REST DAY', tagline: '回復を優先する一日' },
  LIGHT: { title: 'LIGHT DAY', tagline: '軽めに整える一日' },
  NORMAL: { title: 'NORMAL DAY', tagline: 'バランスよく進める一日' },
  PUSH: { title: 'PUSH DAY', tagline: '集中して攻める一日' },
};

const REASON_TAG_LABELS: Record<string, string> = {
  // DayType classification
  fixed_blocks_6h_plus: '固定予定が6時間以上あるため軽めにしました',
  fixed_blocks_4h_to_6h: '固定予定が多めなので調整しました',
  low_completion_rate: '最近の完了率が低めなので無理のない量にしました',
  high_procrastination: '先延ばし傾向を考慮して余裕を持たせました',
  low_energy: 'エネルギーが低めなので休息を優先します',
  urgent_deadline_floor: '締切が近いタスクがあるため最低限の負荷を確保しました',
  high_ai_confidence: 'これまでの学習からAIの確信度が高い配置です',
  low_ai_confidence: 'まだ学習途中のため控えめに配置しました',
  // Capacity planning
  capacity_rest: '回復日として集中量を抑えています',
  capacity_light: '軽めの集中量に設定しました',
  capacity_normal: '標準的な集中量に設定しました',
  capacity_push: '集中量を多めに設定しました',
  buffer_adjusted: 'あなたの傾向に合わせてバッファを調整しました',
  // Placement
  focus_length: 'あなたの平均集中時間に合わせて分割しました',
  task_priority: '優先度の高いタスクを先に置きました',
  deadline: '締切を考慮して順番を決めました',
  energy_peak: '集中しやすい時間帯に重要な作業を置きました',
  buffer_inserted: 'タスクの間に切り替え時間を入れました',
  // Plan flow
  replan_from_now: '現在時刻から組み直しました',
  shift_from_now: '今からの予定として並べ直しました',
  midday_adjustment: '午後の予定を再調整しました',
  no_tasks_to_replan: '再配置するタスクがありません',
  // Gemini
  gemini_placement: 'AI（Gemini）が配置を提案しました',
};

export function reasonTagLabel(tag: string): string | null {
  return REASON_TAG_LABELS[tag] ?? null;
}

/** One-line strategy for the Morning Briefing dashboard. */
export function buildDayStrategy(plan: DayPlan | null, reasonSentences: string[]): string {
  if (!plan) {
    return 'タスクがあれば、AIが今日の最適な流れを組み立てます。';
  }

  const label = DAY_TYPE_LABELS[plan.dayType];
  const primary = reasonSentences[0] ?? label.tagline;
  return `${label.tagline} ${primary}`;
}

/** Maps reasonTags to deduped Japanese sentences, dropping unknown tags. */
export function reasonTagsToSentences(tags: string[]): string[] {
  const seen = new Set<string>();
  const sentences: string[] = [];
  for (const tag of tags) {
    const label = reasonTagLabel(tag);
    if (label && !seen.has(label)) {
      seen.add(label);
      sentences.push(label);
    }
  }
  return sentences;
}
