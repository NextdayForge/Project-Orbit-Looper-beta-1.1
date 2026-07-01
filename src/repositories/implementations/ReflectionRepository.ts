import { LooperDataStore } from '../../storage/LooperDataStore';
import { Reflection } from '../../types/reflection';
import { IReflectionRepository } from '../interfaces/IReflectionRepository';

export class ReflectionRepository implements IReflectionRepository {
  constructor(private readonly store: LooperDataStore) {}

  async getAll(): Promise<Reflection[]> {
    const data = await this.store.load();
    return [...data.reflections];
  }

  async getByDate(date: string): Promise<Reflection | null> {
    const data = await this.store.load();
    return data.reflections.find((reflection) => reflection.date === date) ?? null;
  }

  async save(reflection: Reflection): Promise<Reflection> {
    await this.store.mutate((data) => {
      const index = data.reflections.findIndex(
        (item) => item.id === reflection.id || item.date === reflection.date
      );
      if (index >= 0) {
        data.reflections[index] = reflection;
      } else {
        data.reflections.push(reflection);
      }
    });
    return reflection;
  }

  async delete(id: string): Promise<void> {
    await this.store.mutate((data) => {
      data.reflections = data.reflections.filter((reflection) => reflection.id !== id);
    });
  }
}
