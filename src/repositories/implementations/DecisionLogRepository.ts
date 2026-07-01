import { LooperDecisionsStore } from '../../storage/LooperDecisionsStore';
import { DecisionLog } from '../../types/decisionLog';
import { IDecisionLogRepository } from '../interfaces/IDecisionLogRepository';

export class DecisionLogRepository implements IDecisionLogRepository {
  constructor(private readonly store: LooperDecisionsStore) {}

  async getAll(): Promise<DecisionLog[]> {
    const data = await this.store.load();
    return [...data.decisionLogs];
  }

  async getByDate(date: string): Promise<DecisionLog[]> {
    const data = await this.store.load();
    return data.decisionLogs.filter((log) => log.date === date);
  }

  async append(log: DecisionLog): Promise<DecisionLog> {
    await this.store.mutate((data) => {
      data.decisionLogs.push(log);
    });
    return log;
  }
}
