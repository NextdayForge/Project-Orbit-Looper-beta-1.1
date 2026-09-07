import { Session, isDayProgressSession, isSessionCompleted } from '../../types/session';
import { addDays, parseDateKey, toDateKey } from '../../utils/time';
import {
  DailyMetrics,
  ExecutionFidelityMetrics,
  LearningSignalMetrics,
  MetricsPeriod,
  NorthStarMetrics,
  PeriodComparison,
  RateDelta,
  ReplanMetrics,
  RetentionMetrics,
} from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const COLD_START_WINDOW_DAYS = 14;

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

/** 暦日数の差（両端を含めない素の差）。DST を跨いでも丸めで吸収する。 */
function dayDiff(fromKey: string, toKey: string): number {
  const from = parseDateKey(fromKey).getTime();
  const to = parseDateKey(toKey).getTime();
  return Math.round((to - from) / MS_PER_DAY);
}

/** 前日の日付キー。期間の「後」の開始日から「前」の終了日を作るのに使う。 */
function previousDateKey(dateKey: string): string {
  return toDateKey(addDays(parseDateKey(dateKey), -1));
}

/** タイマーを実際に回した証跡。`actualStart` が入っていれば開始操作を通っている。 */
function hasActualStart(session: Session): boolean {
  return Boolean(session.actualStart);
}

/** 学習に使える時間信号を持つか（`DailyFeatureExtractor.hasTimerSignal` と同じ判定）。 */
function hasTimerSignal(session: Session): boolean {
  return session.outcome?.timerUsed === true;
}

/**
 * ユーザーが実際に手を動かした証跡がある Session。
 * 単に予定が生成されただけの日を「継続した日」に数えないための判定。
 */
function hasInteraction(session: Session): boolean {
  return (
    hasActualStart(session) ||
    isSessionCompleted(session) ||
    session.status === 'skipped' ||
    session.status === 'rescheduled'
  );
}

function sortedUnique(dates: Iterable<string>): string[] {
  return Array.from(new Set(dates)).sort();
}

/** 連続日数を数える。`dates` は昇順かつ重複なしであること。 */
function streaks(dates: string[]): { longest: number; current: number } {
  if (dates.length === 0) return { longest: 0, current: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i += 1) {
    if (dayDiff(dates[i - 1], dates[i]) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }
  // current = 末尾から遡った連続数（= 最後の run）
  return { longest, current: run };
}

function computeExecution(sessions: Session[]): ExecutionFidelityMetrics {
  const progressSessions = sessions.filter(isDayProgressSession);
  const started = progressSessions.filter(hasActualStart);
  const completed = progressSessions.filter(isSessionCompleted);
  const timedCompleted = completed.filter(hasTimerSignal);

  return {
    plannedSessionCount: progressSessions.length,
    startedSessionCount: started.length,
    actualStartRate: rate(started.length, progressSessions.length),
    completedSessionCount: completed.length,
    timedCompletedSessionCount: timedCompleted.length,
    timedCompletionRate: rate(timedCompleted.length, completed.length),
  };
}

function computeLearning(sessions: Session[], activeDates: string[]): LearningSignalMetrics {
  const learningDates = sortedUnique(
    sessions.filter(hasTimerSignal).map((session) => session.date)
  );

  return {
    activeDayCount: activeDates.length,
    learningDayCount: learningDates.length,
    learningDayRate: rate(learningDates.length, activeDates.length),
  };
}

function computeReplan(sessions: Session[], activeDates: string[]): ReplanMetrics {
  const rescheduled = sessions.filter((session) => session.status === 'rescheduled');
  const replanDates = sortedUnique(rescheduled.map((session) => session.date));

  return {
    rescheduledSessionCount: rescheduled.length,
    replanDayCount: replanDates.length,
    replanDayRate: rate(replanDates.length, activeDates.length),
  };
}

function computeRetention(activeDates: string[]): RetentionMetrics {
  if (activeDates.length === 0) {
    return {
      firstActiveDate: null,
      lastActiveDate: null,
      spanDays: 0,
      activeDayCount: 0,
      currentStreakDays: 0,
      longestStreakDays: 0,
      activeDaysInFirst14: 0,
      survivedTwoWeeks: false,
    };
  }

  const firstActiveDate = activeDates[0];
  const lastActiveDate = activeDates[activeDates.length - 1];
  const { longest, current } = streaks(activeDates);
  const inFirst14 = activeDates.filter(
    (date) => dayDiff(firstActiveDate, date) < COLD_START_WINDOW_DAYS
  );

  return {
    firstActiveDate,
    lastActiveDate,
    spanDays: dayDiff(firstActiveDate, lastActiveDate) + 1,
    activeDayCount: activeDates.length,
    currentStreakDays: current,
    longestStreakDays: longest,
    activeDaysInFirst14: inFirst14.length,
    survivedTwoWeeks: dayDiff(firstActiveDate, lastActiveDate) >= COLD_START_WINDOW_DAYS,
  };
}

/** 日付キーが期間に入るか（両端を含む。文字列比較で足りる YYYY-MM-DD 前提）。 */
function inPeriod(date: string, period?: MetricsPeriod): boolean {
  if (!period) return true;
  if (period.from && date < period.from) return false;
  if (period.to && date > period.to) return false;
  return true;
}

/**
 * 日別の系列。セッションが1件以上ある日のみを日付昇順で返す。
 * 施策の前後で「折れ線に段差が出たか」を見るためのもの。
 */
function computeDailySeries(sessions: Session[]): DailyMetrics[] {
  const byDate = new Map<string, Session[]>();
  for (const session of sessions) {
    const list = byDate.get(session.date) ?? [];
    list.push(session);
    byDate.set(session.date, list);
  }

  return Array.from(byDate.keys())
    .sort()
    .map((date) => {
      const daySessions = byDate.get(date) ?? [];
      const progress = daySessions.filter(isDayProgressSession);
      const started = progress.filter(hasActualStart);
      const completed = progress.filter(isSessionCompleted);
      const timedCompleted = completed.filter(hasTimerSignal);

      return {
        date,
        plannedSessionCount: progress.length,
        startedSessionCount: started.length,
        actualStartRate: rate(started.length, progress.length),
        completedSessionCount: completed.length,
        timedCompletedSessionCount: timedCompleted.length,
        timedCompletionRate: rate(timedCompleted.length, completed.length),
        hasLearningSignal: daySessions.some(hasTimerSignal),
        rescheduledSessionCount: daySessions.filter(
          (session) => session.status === 'rescheduled'
        ).length,
      };
    });
}

/**
 * 保存済みの Session だけから北極星の判定材料を導出する。
 *
 * 新しい計測イベントを一切記録しないので、**既に手元にあるデータへ遡って**効く。
 * 端末外への送信は行わない（設計原則5）。
 *
 * @param period 省略すると全期間。施策の前後を切り分けるときに指定する。
 */
export function computeNorthStarMetrics(
  sessions: Session[],
  period?: MetricsPeriod
): NorthStarMetrics {
  const scoped = period
    ? sessions.filter((session) => inPeriod(session.date, period))
    : sessions;

  const activeDates = sortedUnique(
    scoped.filter(hasInteraction).map((session) => session.date)
  );

  return {
    fromDate: activeDates[0] ?? null,
    toDate: activeDates[activeDates.length - 1] ?? null,
    execution: computeExecution(scoped),
    learning: computeLearning(scoped, activeDates),
    replan: computeReplan(scoped, activeDates),
    retention: computeRetention(activeDates),
    daily: computeDailySeries(scoped),
  };
}

function delta(before: number | null, after: number | null): RateDelta {
  return {
    before,
    after,
    delta: before == null || after == null ? null : after - before,
  };
}

/**
 * 施策の前後を比べる。`splitDate`（施策を入れた日）**を含む日以降**が「後」。
 *
 * 注意: これは n=1 の観察であって対照実験ではない。数字が動かなければ仮説を棄却できるが、
 * 動いたとしても動線改善の効果か UserModel の成熟かは分離できない。
 */
export function compareAroundDate(
  sessions: Session[],
  splitDate: string,
  period?: MetricsPeriod
): PeriodComparison {
  const before = computeNorthStarMetrics(sessions, {
    from: period?.from,
    to: previousDateKey(splitDate),
  });
  const after = computeNorthStarMetrics(sessions, {
    from: splitDate,
    to: period?.to,
  });

  return {
    splitDate,
    before,
    after,
    actualStartRate: delta(before.execution.actualStartRate, after.execution.actualStartRate),
    timedCompletionRate: delta(
      before.execution.timedCompletionRate,
      after.execution.timedCompletionRate
    ),
    learningDayRate: delta(before.learning.learningDayRate, after.learning.learningDayRate),
    replanDayRate: delta(before.replan.replanDayRate, after.replan.replanDayRate),
  };
}
