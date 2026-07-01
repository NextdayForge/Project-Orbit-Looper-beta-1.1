import { LooperDataStore } from '../../storage/LooperDataStore';
import { CalendarBlock } from '../../types/calendarBlock';
import { ICalendarBlockRepository } from '../interfaces/ICalendarBlockRepository';

export class CalendarBlockRepository implements ICalendarBlockRepository {
  constructor(private readonly store: LooperDataStore) {}

  async getAll(): Promise<CalendarBlock[]> {
    const data = await this.store.load();
    return [...data.calendarBlocks];
  }

  async getById(id: string): Promise<CalendarBlock | null> {
    const data = await this.store.load();
    return data.calendarBlocks.find((block) => block.id === id) ?? null;
  }

  async getByDate(date: string): Promise<CalendarBlock[]> {
    const data = await this.store.load();
    return data.calendarBlocks.filter((block) => block.date === date);
  }

  async save(block: CalendarBlock): Promise<CalendarBlock> {
    await this.store.mutate((data) => {
      const index = data.calendarBlocks.findIndex((item) => item.id === block.id);
      if (index >= 0) {
        data.calendarBlocks[index] = block;
      } else {
        data.calendarBlocks.push(block);
      }
    });
    return block;
  }

  async saveMany(blocks: CalendarBlock[]): Promise<CalendarBlock[]> {
    await this.store.mutate((data) => {
      for (const block of blocks) {
        const index = data.calendarBlocks.findIndex((item) => item.id === block.id);
        if (index >= 0) {
          data.calendarBlocks[index] = block;
        } else {
          data.calendarBlocks.push(block);
        }
      }
    });
    return blocks;
  }

  async delete(id: string): Promise<void> {
    await this.store.mutate((data) => {
      data.calendarBlocks = data.calendarBlocks.filter((block) => block.id !== id);
    });
  }
}
