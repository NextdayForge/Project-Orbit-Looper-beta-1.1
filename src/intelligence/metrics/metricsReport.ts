import { DailyMetrics, NorthStarMetrics, PeriodComparison, RateDelta } from './types';

/** レポートに載せる日別行の上限。古い分から落とす。 */
const MAX_DAILY_ROWS = 21;

function pct(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

function ratio(numerator: number, denominator: number): string {
  return `${numerator}/${denominator}`;
}

function signedPct(value: number | null): string {
  if (value == null) return '—';
  const points = Math.round(value * 100);
  return `${points >= 0 ? '+' : ''}${points}pt`;
}

/** 0..1 を 10 段階のバーにする。折れ線の代わりに段差を目視するためのもの。 */
function bar(value: number | null): string {
  if (value == null) return '·'.repeat(10);
  const filled = Math.round(value * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function dailyLines(daily: DailyMetrics[]): string[] {
  if (daily.length === 0) return ['（データなし）'];

  const rows = daily.slice(-MAX_DAILY_ROWS);
  const omitted = daily.length - rows.length;
  const lines = rows.map((day) => {
    const flag = day.hasLearningSignal ? '' : '  ※学習信号なし';
    return `${day.date}  ${bar(day.actualStartRate)} ${pct(day.actualStartRate).padStart(
      4
    )}  (${ratio(day.startedSessionCount, day.plannedSessionCount)})${flag}`;
  });

  return omitted > 0 ? [`（古い ${omitted} 日分は省略）`, ...lines] : lines;
}

function deltaLine(label: string, d: RateDelta): string {
  return `- ${label}: ${pct(d.before)} → ${pct(d.after)}  (${signedPct(d.delta)})`;
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
    '',
    '## 日別のタイマー開始率',
    '施策の効果は累積値ではなく、この系列の段差で見ること。',
    '',
    ...dailyLines(metrics.daily),
  ];

  return lines.join('\n');
}

/**
 * 施策の前後比較を人が読めるテキストにする。
 *
 * 累積値の比較ではなく、期間を切った比較であることが重要。
 * 判定の限界（n=1・学習の成熟との交絡）もレポート本文に明記する。
 */
export function formatComparisonReport(comparison: PeriodComparison): string {
  const { before, after } = comparison;

  return [
    '# Orbit Looper 施策の前後比較',
    '',
    `施策を入れた日: ${comparison.splitDate}（この日から「後」）`,
    `前: ${before.fromDate ?? '—'} 〜 ${before.toDate ?? '—'}（${before.retention.activeDayCount}日）`,
    `後: ${after.fromDate ?? '—'} 〜 ${after.toDate ?? '—'}（${after.retention.activeDayCount}日）`,
    '',
    '## 変化',
    deltaLine('タイマー開始率  ★', comparison.actualStartRate),
    deltaLine('完了のうちタイマー経由', comparison.timedCompletionRate),
    deltaLine('学習が成立した日', comparison.learningDayRate),
    deltaLine('再計画が適用された日', comparison.replanDayRate),
    '',
    '## 日別（後）',
    ...dailyLines(after.daily),
    '',
    '## 日別（前）',
    ...dailyLines(before.daily),
    '',
    '## 読み方の注意',
    '- これは n=1 の観察であり対照実験ではない。数字が動かなければ仮説を棄却できるが、',
    '  動いたとしても動線改善の効果か UserModel の成熟かは分離できない。',
    '- 前後の期間の長さが大きく違うと比較にならない。同程度の日数で切ること。',
  ].join('\n');
}
