import { APP_NAME } from '../../config/brand';
import { Session, isMutableScheduleSession } from '../../types/session';
import { Task } from '../../types/task';

/** Builds the wake-notification body from that day's sessions (title of the first task + count). */
export function buildTodaySummary(sessions: Session[], tasks: Task[], dateKey: string): string {
  const todays = sessions
    .filter((session) => session.date === dateKey && isMutableScheduleSession(session))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  if (todays.length === 0) {
    return `${APP_NAME}を開いて今日の予定を準備しましょう`;
  }

  const firstTitle = tasks.find((task) => task.id === todays[0].taskId)?.title ?? '予定';
  const rest = todays.length - 1;
  return rest > 0
    ? `今日は${todays.length}件の予定。まずは「${firstTitle}」他${rest}件`
    : `今日の予定は「${firstTitle}」の1件`;
}
