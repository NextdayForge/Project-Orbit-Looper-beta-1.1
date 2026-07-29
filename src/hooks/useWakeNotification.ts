import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { APP_NAME } from '../config/brand';
import { buildTodaySummary } from '../presentation/notifications/wakeSummary';
import { Session } from '../types/session';
import { Task } from '../types/task';

const CHANNEL_ID = 'looper-wake';
const NOTIFICATION_ID = 'looper-wake-daily';

/** Expo Go on Android cannot use push APIs; local schedule may still fail — fail silently. */
function isAndroidExpoGo(): boolean {
  return Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient';
}

function isExpoGoPushError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Android Push') || message.includes('Expo Go');
}

/**
 * Schedules a daily local notification at wake time, OS-managed so it fires even if the
 * app hasn't been opened. Its *content* can only reflect that day's actual tasks when the
 * app has run since midnight to refresh it (client-only, no server push — a full "always
 * accurate" version would need a cloud sync backend, out of scope for this local-first app).
 */
export function useWakeNotification(
  sessions: Session[],
  tasks: Task[],
  dateKey: string,
  wakeMinutes: number,
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
          await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: '毎朝の予定',
            importance: Notifications.AndroidImportance.MAX,
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

        const hour = Math.floor(wakeMinutes / 60);
        const minute = wakeMinutes % 60;

        await Notifications.scheduleNotificationAsync({
          identifier: NOTIFICATION_ID,
          content: {
            title: `${APP_NAME} — おはようございます`,
            body: buildTodaySummary(sessions, tasks, dateKey),
            ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
          },
        });
      } catch (error) {
        if (!isExpoGoPushError(error) && __DEV__) {
          console.warn(`[${APP_NAME}] wake notification setup failed:`, error);
        }
      }
    }

    void sync();

    return () => {
      cancelled = true;
    };
  }, [sessions, tasks, dateKey, wakeMinutes, enabled]);
}
