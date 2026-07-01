import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { APP_NAME } from '../config/brand';
import { Session, isMutableScheduleSession } from '../types/session';
import { Task } from '../types/task';
import { parseDateKey } from '../utils/time';

const LEAD_MINUTES = 5;

/** Expo Go on Android cannot use push APIs; local schedule may still fail — fail silently. */
function isAndroidExpoGo(): boolean {
  return Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient';
}

function findNextSession(sessions: Session[], dateKey: string, nowMinutes: number): Session | null {
  const todays = sessions
    .filter((session) => session.date === dateKey && isMutableScheduleSession(session))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const active = todays.find(
    (session) => nowMinutes >= session.startMinutes && nowMinutes < session.endMinutes
  );
  if (active) return active;

  return todays.find((session) => session.startMinutes > nowMinutes) ?? null;
}

function notifyTriggerDate(session: Session, leadMinutes: number): Date {
  const base = parseDateKey(session.date);
  const start = new Date(base);
  start.setHours(
    Math.floor(session.startMinutes / 60),
    session.startMinutes % 60,
    0,
    0
  );
  start.setMinutes(start.getMinutes() - leadMinutes);
  return start;
}

function isExpoGoPushError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Android Push') || message.includes('Expo Go');
}

/**
 * Schedules a single local notification LEAD_MINUTES before the next session.
 * Skipped on Android Expo Go (SDK 53+ push API restriction — use a dev build for notifications there).
 */
export function useSessionNotifications(
  sessions: Session[],
  tasks: Task[],
  dateKey: string,
  enabled: boolean
): void {
  useEffect(() => {
    if (!enabled || isAndroidExpoGo()) {
      return;
    }

    let cancelled = false;

    async function sync() {
      try {
        const Notifications = await import('expo-notifications');

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('looper-sessions', {
            name: 'セッション開始',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) {
          const requested = await Notifications.requestPermissionsAsync();
          if (!requested.granted || cancelled) {
            return;
          }
        }

        if (cancelled) return;

        await Notifications.cancelAllScheduledNotificationsAsync();

        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        const next = findNextSession(sessions, dateKey, nowMinutes);
        if (!next) {
          return;
        }

        const triggerAt = notifyTriggerDate(next, LEAD_MINUTES);
        if (triggerAt.getTime() <= Date.now()) {
          return;
        }

        const title = tasks.find((task) => task.id === next.taskId)?.title ?? '次のセッション';

        await Notifications.scheduleNotificationAsync({
          content: {
            title: APP_NAME,
            body: `${LEAD_MINUTES}分後: ${title}`,
            ...(Platform.OS === 'android' ? { channelId: 'looper-sessions' } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerAt,
          },
        });
      } catch (error) {
        if (!isExpoGoPushError(error) && __DEV__) {
          console.warn(`[${APP_NAME}] session notification setup failed:`, error);
        }
      }
    }

    void sync();

    return () => {
      cancelled = true;
    };
  }, [sessions, tasks, dateKey, enabled]);
}
