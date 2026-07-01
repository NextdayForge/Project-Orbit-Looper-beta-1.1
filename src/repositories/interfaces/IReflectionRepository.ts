import { Reflection } from '../../types/reflection';

export interface IReflectionRepository {
  getAll(): Promise<Reflection[]>;
  getByDate(date: string): Promise<Reflection | null>;
  save(reflection: Reflection): Promise<Reflection>;
  delete(id: string): Promise<void>;
}
