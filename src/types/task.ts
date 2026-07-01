import { TaskPriority } from './schedule';

export type TaskCategory = 'study' | 'work' | 'life' | 'health' | 'general';

export type TaskStatus = 'inbox' | 'ready' | 'scheduled' | 'done' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  estimatedMinutes: number;
  priority: TaskPriority;
  deadline?: string;
  projectId?: string | null;
  milestoneId?: string | null;
  status: TaskStatus;
  splittable: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_TASK_CATEGORY: TaskCategory = 'general';
