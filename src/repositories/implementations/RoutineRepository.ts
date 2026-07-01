import { LooperDataStore } from '../../storage/LooperDataStore';
import { RoutineTemplate } from '../../types/routine';
import { IRoutineRepository } from '../interfaces/IRoutineRepository';

export class RoutineRepository implements IRoutineRepository {
  constructor(private readonly store: LooperDataStore) {}

  async getAll(): Promise<RoutineTemplate[]> {
    const data = await this.store.load();
    return [...data.routines];
  }

  async getById(id: string): Promise<RoutineTemplate | null> {
    const data = await this.store.load();
    return data.routines.find((routine) => routine.id === id) ?? null;
  }

  async save(routine: RoutineTemplate): Promise<RoutineTemplate> {
    await this.store.mutate((data) => {
      const index = data.routines.findIndex((item) => item.id === routine.id);
      if (index >= 0) {
        data.routines[index] = routine;
      } else {
        data.routines.push(routine);
      }
    });
    return routine;
  }

  async delete(id: string): Promise<void> {
    await this.store.mutate((data) => {
      data.routines = data.routines.filter((routine) => routine.id !== id);
    });
  }
}
