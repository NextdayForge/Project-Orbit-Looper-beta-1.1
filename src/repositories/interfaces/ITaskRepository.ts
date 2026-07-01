import { Task } from '../../types/task';

export interface ITaskRepository {
  getAll(): Promise<Task[]>;
  getById(id: string): Promise<Task | null>;
  save(task: Task): Promise<Task>;
  saveMany(tasks: Task[]): Promise<Task[]>;
  delete(id: string): Promise<void>;
}
