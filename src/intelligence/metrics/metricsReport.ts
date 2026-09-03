import { NorthStarMetrics } from './types';

function pct(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

function ratio(numerator: number, denominator: number): string {
  return `${numerator}/${denominator}`;
}

/**
 * 計測結果を人が読めるテキストにする（共有・貼り付け用）。
 *
 * 端末外へ自動送信はしない。ユーザーが設定画面から自分でコピー／送信する前提。
 * 個人を特定しうる内容（タスク名・ふりかえり本文）は一切含めない。
 */
export function formatMetricsReport(metrics: NorthStarMetrics): string {
  const { execution, learning, replan, retention } = metrics;
  const period =
    metrics.fromDate && metrics.toDate
      ? `${metrics.fromDate} 〜 ${metrics.toDate}`
      : '活動記録なし';

  const lines = [
    '# Orbit Looper 計測レポート',
    '',
    `対象期間: ${period}`,
    `活動日数: ${retention.activeDayCount}日（暦 ${retention.spanDays}日中）`,
    '',
    '## 実行フィデリティ（学習信号が入っているか）',
    `- タイマー開始率: ${pct(execution.actualStartRate)}  (${ratio(
      execution.startedSessionCount,
      execution.plannedSessionCount
    )})  ★最重要`,
    `- 完了のうちタイマー経由: ${pct(execution.timedCompletionRate)}  (${ratio(
      execution.timedCompletedSessionCount,
      execution.completedSessionCount
    )})`,
    '',
    '## 学習の成立',
    `- 学習が成立した日: ${pct(learning.learningDayRate)}  (${ratio(
      learning.learningDayCount,
      learning.activeDayCount
    )})`,
    '',
    '## 再計画（最大の差別化）',
    `- 再計画が適用された日: ${pct(replan.replanDayRate)}  (${ratio(
      replan.replanDayCount,
      learning.activeDayCount
    )})`,
    `- 変形されたセッション数: ${replan.rescheduledSessionCount}`,
    '',
    '## 継続（コールドスタートの谷）',
    `- 最長連続: ${retention.longestStreakDays}日 / 直近連続: ${retention.currentStreakDays}日`,
    `- 最初の14日間の活動日数: ${retention.activeDaysInFirst14}日`,
    `- 2週間の谷を越えた: ${retention.survivedTwoWeeks ? 'はい' : 'いいえ'}`,
  ];

  return lines.join('\n');
}
