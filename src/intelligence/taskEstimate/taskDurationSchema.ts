import { TaskCategory } from '../../types/task';
import { TaskDurationEstimate } from './types';

export interface ParsedTaskDurationRow extends TaskDurationEstimate {
  title: string;
}

const VALID_CATEGORIES = new Set<TaskCategory>(['study', 'work', 'life', 'health', 'general']);

export const TASK_DURATION_BATCH_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    estimates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          estimatedMinutes: {
            type: 'integer',
            description: 'Realistic duration in minutes, snapped to 5-minute steps',
          },
          category: {
            type: 'string',
            enum: ['study', 'work', 'life', 'health', 'general'],
          },
        },
        required: ['title', 'estimatedMinutes', 'category'],
      },
    },
  },
  required: ['estimates'],
};

export function clampEstimatedMinutes(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return clampEstimatedMinutes(fallback, 30);
  }
  const snapped = Math.round(n / 5) * 5;
  return Math.max(5, Math.min(480, snapped));
}

export function parseTaskCategory(value: unknown, fallback: TaskCategory = 'general'): TaskCategory {
  if (typeof value === 'string' && VALID_CATEGORIES.has(value as TaskCategory)) {
    return value as TaskCategory;
  }
  return fallback;
}

export function parseTaskDurationBatchJson(
  raw: string,
  defaultMinutes: number
): ParsedTaskDurationRow[] | null {
  try {
    const parsed = JSON.parse(raw) as { estimates?: unknown };
    if (!Array.isArray(parsed.estimates)) {
      return null;
    }

    const results: ParsedTaskDurationRow[] = [];
    for (const item of parsed.estimates) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const row = item as Record<string, unknown>;
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      if (!title) {
        continue;
      }
      results.push({
        title,
        estimatedMinutes: clampEstimatedMinutes(row.estimatedMinutes, defaultMinutes),
        category: parseTaskCategory(row.category),
      });
    }

    return results.length > 0 ? results : null;
  } catch {
    return null;
  }
}
