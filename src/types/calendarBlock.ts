export type CalendarBlockType = 'fixed' | 'buffer' | 'break' | 'power_nap';

export type CalendarBlockSource = 'user' | 'system' | 'ai';

export interface CalendarBlock {
  id: string;
  title: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  type: CalendarBlockType;
  locked: boolean;
  source: CalendarBlockSource;
  recurring: boolean;
}
