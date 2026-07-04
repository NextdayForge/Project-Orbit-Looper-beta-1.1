export type EventColor = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'teal';

/** 1=最高 … 5=低 */
export type TaskPriority = 1 | 2 | 3 | 4 | 5;

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  1: '最高',
  2: '高',
  3: '普通',
  4: '低',
  5: '最低',
};

export const PRIORITY_SHORT: Record<TaskPriority, string> = {
  1: '最高',
  2: '高',
  3: '普',
  4: '低',
  5: '最低',
};

export const DEFAULT_PRIORITY: TaskPriority = 3;

export type AppTab = 'today' | 'calendar' | 'insights' | 'settings';

/** Subscription tier for Looper-hosted cloud AI. */
export type LooperPlan = 'free' | 'pro';

export type CalendarMode = 'month' | 'day';

export interface AiTaskInput {
  title: string;
  priority: TaskPriority;
  /** User-specified duration; when present, takes priority over AI/keyword estimation. */
  estimatedMinutes?: number;
}

/** Duration choices offered in task input UI (AiScheduleModal detail cards, bulk "30分" parsing). */
export const TASK_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

export interface AppSettings {
  pxPerMinute: number;
  minEventHeightPx: number;
  defaultDurationMinutes: number;
  defaultBufferMinutes: number;
  /** Wake time: earliest minute-of-day the planner may place sessions (default 7:00). */
  wakeMinutes: number;
  /** Sleep time: latest minute-of-day the planner may place sessions (default 23:00). */
  sleepMinutes: number;
  weekStartsOn: 0 | 1;
  use24Hour: boolean;
  showWeekNumbers: boolean;
  /** Visual appearance. */
  themeMode: 'light' | 'dark';
  /** Looper subscription tier — cloud AI requires `pro` + Looper backend. */
  looperPlan?: LooperPlan;
  /**
   * User-supplied Gemini API key. Web only: the public web build carries no
   * shared proxy token, so each user brings their own key. Ignored on native
   * (APK uses the Looper proxy). Stored on-device only.
   */
  geminiApiKey?: string;
  /** First-run onboarding completed. */
  onboardingCompleted?: boolean;
}

export const EVENT_COLORS: EventColor[] = ['blue', 'green', 'orange', 'red', 'purple', 'teal'];

/**
 * Monochrome event palette. Categories differ only by a subtle grayscale ramp;
 * shared neutral fill keeps the timeline calm and Apple-like.
 */
export const COLOR_MAP: Record<EventColor, { bg: string; border: string; text: string }> = {
  blue: { bg: 'rgba(0,0,0,0.04)', border: '#1D1D1F', text: '#1D1D1F' },
  green: { bg: 'rgba(0,0,0,0.04)', border: '#3A3A3C', text: '#3A3A3C' },
  orange: { bg: 'rgba(0,0,0,0.04)', border: '#48484A', text: '#48484A' },
  red: { bg: 'rgba(0,0,0,0.04)', border: '#5A5A5E', text: '#5A5A5E' },
  purple: { bg: 'rgba(0,0,0,0.04)', border: '#636366', text: '#636366' },
  teal: { bg: 'rgba(0,0,0,0.04)', border: '#8E8E93', text: '#6E6E73' },
};

export const DEFAULT_SETTINGS: AppSettings = {
  pxPerMinute: 2,
  minEventHeightPx: 52,
  defaultDurationMinutes: 30,
  defaultBufferMinutes: 5,
  wakeMinutes: 7 * 60,
  sleepMinutes: 23 * 60,
  weekStartsOn: 0,
  use24Hour: true,
  showWeekNumbers: false,
  themeMode: 'light',
  looperPlan: 'free',
};
