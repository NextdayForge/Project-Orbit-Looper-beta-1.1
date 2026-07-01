import { DecisionLog } from '../../types/decisionLog';

export interface IDecisionLogRepository {
  getAll(): Promise<DecisionLog[]>;
  getByDate(date: string): Promise<DecisionLog[]>;
  append(log: DecisionLog): Promise<DecisionLog>;
}
