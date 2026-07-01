import { TaskCategory } from '../../types/task';

export interface TaskDurationEstimateInput {
  title: string;
  defaultMinutes?: number;
}

export interface TaskDurationEstimate {
  estimatedMinutes: number;
  category: TaskCategory;
}

export interface TaskDurationEstimateResult extends TaskDurationEstimate {
  source: 'gemini' | 'local';
}

export type TaskDurationEstimateMap = Map<string, TaskDurationEstimateResult>;
