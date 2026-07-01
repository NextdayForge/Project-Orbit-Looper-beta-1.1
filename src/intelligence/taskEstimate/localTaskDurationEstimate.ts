import { DEFAULT_TASK_CATEGORY, TaskCategory } from '../../types/task';
import { normalizeTaskTitle } from '../../utils/taskTitle';
import { clampEstimatedMinutes } from './taskDurationSchema';
import { TaskDurationEstimate, TaskDurationEstimateInput, TaskDurationEstimateResult } from './types';

interface DurationRule {
  pattern: RegExp;
  minutes: number;
  category: TaskCategory;
}

const DURATION_RULES: DurationRule[] = [
  { pattern: /シャワー|歯磨|メイク|支度|着替/, minutes: 15, category: 'life' },
  { pattern: /朝食|昼食|夕食|食事|ごはん|ランチ|ディナー|コーヒー/, minutes: 30, category: 'life' },
  { pattern: /メール|返信|連絡|電話|メッセ/, minutes: 20, category: 'work' },
  { pattern: /買い物|スーパー|コンビニ| errands/, minutes: 45, category: 'life' },
  { pattern: /掃除|洗濯|片付|整理/, minutes: 30, category: 'life' },
  { pattern: /読書|本を読/, minutes: 45, category: 'study' },
  { pattern: /勉強|学習|復習|予習|宿題|レポート|論文|課題|試験/, minutes: 90, category: 'study' },
  { pattern: /プログラ|コーディング|実装|開発|デバッグ/, minutes: 90, category: 'work' },
  { pattern: /会議|打合|ミーティング|mtg|面談/, minutes: 60, category: 'work' },
  { pattern: /プレゼン|資料|企画|提案/, minutes: 75, category: 'work' },
  { pattern: /運動|ジム|ランニング|筋トレ|ストレッチ|ヨガ|散歩/, minutes: 45, category: 'health' },
  { pattern: /昼寝|仮眠|休息|休憩/, minutes: 20, category: 'health' },
  { pattern: /通勤|移動|通学/, minutes: 30, category: 'life' },
];

function matchRule(title: string): DurationRule | null {
  for (const rule of DURATION_RULES) {
    if (rule.pattern.test(title)) {
      return rule;
    }
  }
  return null;
}

export function localEstimateTaskDuration(
  input: TaskDurationEstimateInput
): TaskDurationEstimateResult {
  const title = normalizeTaskTitle(input.title);
  const fallbackMinutes = input.defaultMinutes ?? 30;
  const rule = matchRule(title);

  if (rule) {
    return {
      estimatedMinutes: clampEstimatedMinutes(rule.minutes, fallbackMinutes),
      category: rule.category,
      source: 'local',
    };
  }

  return {
    estimatedMinutes: clampEstimatedMinutes(fallbackMinutes, 30),
    category: DEFAULT_TASK_CATEGORY,
    source: 'local',
  };
}

export function localEstimateTaskDurationBatch(
  inputs: TaskDurationEstimateInput[]
): Map<string, TaskDurationEstimateResult> {
  const results = new Map<string, TaskDurationEstimateResult>();
  for (const input of inputs) {
    const key = normalizeTaskTitle(input.title);
    if (!key || results.has(key)) {
      continue;
    }
    results.set(key, localEstimateTaskDuration(input));
  }
  return results;
}
