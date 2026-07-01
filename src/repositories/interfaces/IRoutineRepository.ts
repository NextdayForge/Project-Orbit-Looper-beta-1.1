import { RoutineTemplate } from '../../types/routine';

export interface IRoutineRepository {
  getAll(): Promise<RoutineTemplate[]>;
  getById(id: string): Promise<RoutineTemplate | null>;
  save(routine: RoutineTemplate): Promise<RoutineTemplate>;
  delete(id: string): Promise<void>;
}
