import { AppSettings } from '../../types/schedule';
import { minutesToTime, toDateKey } from '../../utils/time';

/**
 * Explains why a schedule generated for today came back empty/rolled-over when the
 * cause is the current time being past the configured sleep time (capacity is
 * intentionally zero from that point on — see useDayPlan.ts computeRemainingAvailableMinutes).
 * Returns null when the schedule date isn't today, or it's still before bedtime.
 */
export function resolveBedtimeHint(
  settings: Pick<AppSettings, 'sleepMinutes'>,
  scheduleDate: Date,
  now: Date = new Date()
): string | null {
  if (toDateKey(scheduleDate) !== toDateKey(now)) {
    return null;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes < settings.sleepMinutes) {
    return null;
  }

  return `設定の就寝時刻（${minutesToTime(settings.sleepMinutes)}）を過ぎているため、今日の予定にはこれ以上入りません。夜遅くまで使う場合は設定の「起床・就寝」時刻を調整してください。`;
}
