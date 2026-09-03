import { Session, isDayProgressSession, isSessionCompleted } from '../../types/session';
import { parseDateKey } from '../../utils/time';
import {
  ExecutionFidelityMetrics,
  LearningSignalMetrics,
  NorthStarMetrics,
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

/**
 * 保存済みの Session だけから北極星の判定材料を導出する。
 *
 * 新しい計測イベントを一切記録しないので、**既に手元にあるデータへ遡って**効く。
 * 端末外への送信は行わない（設計原則5）。
 */
export function computeNorthStarMetrics(sessions: Session[]): NorthStarMetrics {
  const activeDates = sortedUnique(
    sessions.filter(hasInteraction).map((session) => session.date)
  );

  return {
    fromDate: activeDates[0] ?? null,
    toDate: activeDates[activeDates.length - 1] ?? null,
    execution: computeExecution(sessions),
    learning: computeLearning(sessions, activeDates),
    replan: computeReplan(sessions, activeDates),
    retention: computeRetention(activeDates),
  };
}
