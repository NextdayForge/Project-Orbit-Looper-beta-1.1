import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, DEFAULT_SETTINGS, ScheduleEvent } from '../types/schedule';

const STORAGE_KEY = 'my-calendar-app-data';

interface StoredData {
  events: ScheduleEvent[];
  settings: AppSettings;
}

export async function loadStoredData(): Promise<StoredData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { events: [], settings: DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as StoredData;
    return {
      events: parsed.events ?? [],
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    };
  } catch {
    return { events: [], settings: DEFAULT_SETTINGS };
  }
}

export async function saveStoredData(events: ScheduleEvent[], settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ events, settings }));
}
