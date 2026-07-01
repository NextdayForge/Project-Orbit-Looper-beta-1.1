import { LooperDataStore } from '../../storage/LooperDataStore';
import { Session } from '../../types/session';
import { ISessionRepository } from '../interfaces/ISessionRepository';

export class SessionRepository implements ISessionRepository {
  constructor(private readonly store: LooperDataStore) {}

  async getAll(): Promise<Session[]> {
    const data = await this.store.load();
    return [...data.sessions];
  }

  async getById(id: string): Promise<Session | null> {
    const data = await this.store.load();
    return data.sessions.find((session) => session.id === id) ?? null;
  }

  async getByDate(date: string): Promise<Session[]> {
    const data = await this.store.load();
    return data.sessions.filter((session) => session.date === date);
  }

  async getByTaskId(taskId: string): Promise<Session[]> {
    const data = await this.store.load();
    return data.sessions.filter((session) => session.taskId === taskId);
  }

  async save(session: Session): Promise<Session> {
    await this.store.mutate((data) => {
      const index = data.sessions.findIndex((item) => item.id === session.id);
      if (index >= 0) {
        data.sessions[index] = session;
      } else {
        data.sessions.push(session);
      }
    });
    return session;
  }

  async saveMany(sessions: Session[]): Promise<Session[]> {
    await this.store.mutate((data) => {
      for (const session of sessions) {
        const index = data.sessions.findIndex((item) => item.id === session.id);
        if (index >= 0) {
          data.sessions[index] = session;
        } else {
          data.sessions.push(session);
        }
      }
    });
    return sessions;
  }

  async delete(id: string): Promise<void> {
    await this.store.mutate((data) => {
      data.sessions = data.sessions.filter((session) => session.id !== id);
    });
  }
}
