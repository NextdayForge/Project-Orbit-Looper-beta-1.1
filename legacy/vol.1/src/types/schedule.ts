export interface ScheduleEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  startMinutes: number; // 0–1439
  endMinutes: number; // 1–1440
  color: EventColor;
  note?: string;
  completed?: boolean;
  priority?: TaskPriority;
  locked?: boolean;
  isAuxiliary?: boolean;
}

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

export type AppTab = 'calendar' | 'settings';

export type CalendarMode = 'month' | 'day';

export interface AiScheduleItem {
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  type: 'task' | 'buffer' | 'power_nap' | 'break';
  category?: string;
  priority?: TaskPriority;
  /** 元タスクID（再配置時の優先度・ID保持用） */
  sourceTaskId?: string;
}

export interface AiTaskInput {
  title: string;
  priority: TaskPriority;
}

export interface AppSettings {
  pxPerMinute: number;
  minEventHeightPx: number;
  defaultDurationMinutes: number;
  defaultBufferMinutes: number;
  weekStartsOn: 0 | 1;
  use24Hour: boolean;
  showWeekNumbers: boolean;
}

export const EVENT_COLORS: EventColor[] = ['blue', 'green', 'orange', 'red', 'purple', 'teal'];

export const COLOR_MAP: Record<EventColor, { bg: string; border: string; text: string }> = {
  blue: { bg: 'rgba(0,122,255,0.15)', border: '#007AFF', text: '#007AFF' },
  green: { bg: 'rgba(52,199,89,0.15)', border: '#34C759', text: '#248A3D' },
  orange: { bg: 'rgba(255,149,0,0.15)', border: '#FF9500', text: '#C93400' },
  red: { bg: 'rgba(255,59,48,0.15)', border: '#FF3B30', text: '#D70015' },
  purple: { bg: 'rgba(175,82,222,0.15)', border: '#AF52DE', text: '#8944AB' },
  teal: { bg: 'rgba(90,200,250,0.15)', border: '#5AC8FA', text: '#0071A4' },
};

export const DEFAULT_SETTINGS: AppSettings = {
  pxPerMinute: 2,
  minEventHeightPx: 52,
  defaultDurationMinutes: 30,
  defaultBufferMinutes: 5,
  weekStartsOn: 0,
  use24Hour: true,
  showWeekNumbers: false,
};
