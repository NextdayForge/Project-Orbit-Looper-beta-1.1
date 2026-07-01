import { loadGeminiClient } from '../../infrastructure/gemini';
import { normalizeTaskTitle } from '../../utils/taskTitle';
import { buildTaskDurationBatchPrompt } from './taskDurationPrompts';
import { parseTaskDurationBatchJson } from './taskDurationSchema';
import {
  localEstimateTaskDuration,
  localEstimateTaskDurationBatch,
} from './localTaskDurationEstimate';
import {
  TaskDurationEstimateInput,
  TaskDurationEstimateMap,
  TaskDurationEstimateResult,
} from './types';

/**
 * Estimates task duration and category from titles.
 * Gemini when configured; keyword heuristics otherwise (language understanding only — placement stays local).
 */
export class TaskDurationEstimator {
  async isAiEnabled(): Promise<boolean> {
    return (await loadGeminiClient()).isConfigured();
  }

  async estimate(input: TaskDurationEstimateInput): Promise<TaskDurationEstimateResult> {
    const batch = await this.estimateBatch([input]);
    const key = normalizeTaskTitle(input.title);
    return batch.get(key) ?? localEstimateTaskDuration(input);
  }

  async estimateBatch(inputs: TaskDurationEstimateInput[]): Promise<TaskDurationEstimateMap> {
    const pending: TaskDurationEstimateInput[] = [];
    const seen = new Set<string>();

    for (const input of inputs) {
      const key = normalizeTaskTitle(input.title);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      pending.push({ ...input, title: key });
    }

    if (pending.length === 0) {
      return new Map();
    }

    const defaultMinutes = pending[0]?.defaultMinutes ?? 30;

    const client = await loadGeminiClient();
    if (!client.isConfigured()) {
      return localEstimateTaskDurationBatch(pending);
    }

    const prompt = buildTaskDurationBatchPrompt(pending, defaultMinutes);
    const { text } = await client.generateStructuredJson(prompt);
    if (!text) {
      return localEstimateTaskDurationBatch(pending);
    }

    const parsed = parseTaskDurationBatchJson(text, defaultMinutes);
    if (!parsed) {
      return localEstimateTaskDurationBatch(pending);
    }

    const byTitle = new Map(
      parsed.map((row) => [normalizeTaskTitle(row.title), row] as const)
    );

    const results: TaskDurationEstimateMap = new Map();
    for (const input of pending) {
      const key = normalizeTaskTitle(input.title);
      const geminiRow = byTitle.get(key);
      if (geminiRow) {
        results.set(key, { ...geminiRow, source: 'gemini' });
        continue;
      }
      results.set(key, localEstimateTaskDuration(input));
    }

    return results;
  }
}

export const taskDurationEstimator = new TaskDurationEstimator();
