import { DayPlan } from '../../types/dayPlan';
import { Session, isDayProgressSession, isSessionCompleted } from '../../types/session';

/**
 * Generates a short reflective question for the evening journal (local, no API).
 */
export function buildEveningReflectionQuestion(
  plan: DayPlan | null,
  sessions: Session[],
  dateKey: string
): string {
  const daySessions = sessions.filter(
    (session) => session.date === dateKey && isDayProgressSession(session)
  );
  const completed = daySessions.filter(isSessionCompleted);
  const total = daySessions.length;

  if (total === 0) {
    return '今日はどんな一日でしたか？短く書いてみてください。';
  }

  const completionRate = completed.length / total;
  const overruns = completed.filter(
    (session) => session.outcome && session.outcome.estimationRatio > 1.15
  );

  if (overruns.length > 0) {
    const avgOver =
      overruns.reduce((sum, session) => sum + (session.outcome?.estimationRatio ?? 1), 0) /
      overruns.length;
    const pct = Math.round((avgOver - 1) * 100);
    return `今日の見積もりは約${pct}%甘かったようです。何が時間を押しましたか？`;
  }

  if (completionRate >= 0.85) {
    return '今日は計画どおり進められました。うまくいった要因は何だと思いますか？';
  }

  if (completionRate <= 0.5) {
    return '今日は予定より進みにくい一日でした。何が一番の壁になりましたか？';
  }

  if (plan?.dayType === 'PUSH') {
    return '攻めの一日でした。集中できた時間と、崩れた時間の違いは何でしたか？';
  }

  return '今日の流れを振り返って、明日に活かしたいことを書いてみてください。';
}
