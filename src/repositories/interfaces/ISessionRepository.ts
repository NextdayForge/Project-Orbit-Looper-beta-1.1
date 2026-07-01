import { Session } from '../../types/session';

export interface ISessionRepository {
  getAll(): Promise<Session[]>;
  getById(id: string): Promise<Session | null>;
  getByDate(date: string): Promise<Session[]>;
  getByTaskId(taskId: string): Promise<Session[]>;
  save(session: Session): Promise<Session>;
  saveMany(sessions: Session[]): Promise<Session[]>;
  delete(id: string): Promise<void>;
}
