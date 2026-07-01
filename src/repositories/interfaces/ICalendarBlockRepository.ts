import { CalendarBlock } from '../../types/calendarBlock';

export interface ICalendarBlockRepository {
  getAll(): Promise<CalendarBlock[]>;
  getById(id: string): Promise<CalendarBlock | null>;
  getByDate(date: string): Promise<CalendarBlock[]>;
  save(block: CalendarBlock): Promise<CalendarBlock>;
  saveMany(blocks: CalendarBlock[]): Promise<CalendarBlock[]>;
  delete(id: string): Promise<void>;
}
