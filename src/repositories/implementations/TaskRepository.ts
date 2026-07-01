import { LooperDataStore } from '../../storage/LooperDataStore';
import { Task } from '../../types/task';
import { ITaskRepository } from '../interfaces/ITaskRepository';

export class TaskRepository implements ITaskRepository {
  constructor(private readonly store: LooperDataStore) {}

  async getAll(): Promise<Task[]> {
    const data = await this.store.load();
    return [...data.tasks];
  }

  async getById(id: string): Promise<Task | null> {
    const data = await this.store.load();
    return data.tasks.find((task) => task.id === id) ?? null;
  }

  async save(task: Task): Promise<Task> {
    await this.store.mutate((data) => {
      const index = data.tasks.findIndex((item) => item.id === task.id);
      if (index >= 0) {
        data.tasks[index] = task;
      } else {
        data.tasks.push(task);
      }
    });
    return task;
  }

  async saveMany(tasks: Task[]): Promise<Task[]> {
    await this.store.mutate((data) => {
      for (const task of tasks) {
        const index = data.tasks.findIndex((item) => item.id === task.id);
        if (index >= 0) {
          data.tasks[index] = task;
        } else {
          data.tasks.push(task);
        }
      }
    });
    return tasks;
  }

  async delete(id: string): Promise<void> {
    await this.store.mutate((data) => {
      data.tasks = data.tasks.filter((task) => task.id !== id);
    });
  }
}
