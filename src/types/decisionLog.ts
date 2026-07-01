export type DecisionLogType =
  | 'day_type'
  | 'task_selection'
  | 'placement'
  | 'midday_adjustment'
  | 'planner_generate'
  | 'planner_ai_generate'
  | 'planner_evaluation'
  | 'planner_midday_adjustment'
  | 'learning_update'
  | 'ai_schedule';

export interface DecisionLog {
  id: string;
  date: string;
  type: DecisionLogType;
  decision: Record<string, unknown>;
  reasonTags: string[];
  inputSnapshot: Record<string, unknown>;
  outputSnapshot: Record<string, unknown>;
  createdAt: string;
}
