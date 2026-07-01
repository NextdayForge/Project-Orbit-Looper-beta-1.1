import { TASK_DURATION_BATCH_SCHEMA } from './taskDurationSchema';
import { TaskDurationEstimateInput } from './types';

export function buildTaskDurationBatchPrompt(
  items: TaskDurationEstimateInput[],
  defaultMinutes: number
) {
  const taskLines = items
    .map((item, index) => `${index + 1}. ${item.title.trim()}`)
    .join('\n');

  return {
    systemInstruction: [
      'You estimate realistic task durations for a personal daily scheduler (Orbit Looper).',
      'Return JSON only.',
      'Rules:',
      '- estimatedMinutes: integer, 5-minute steps, range 5–480',
      '- category: study | work | life | health | general',
      '- Infer from Japanese or English task titles',
      '- Short errands ~15–30m, focused work ~45–90m, deep work ~90–180m',
      `- If unclear, use about ${defaultMinutes} minutes and category general`,
      '- Echo each title exactly as given',
    ].join('\n'),
    userContent: `Estimate duration and category for each task:\n${taskLines}`,
    responseSchema: TASK_DURATION_BATCH_SCHEMA,
    temperature: 0.2,
  };
}
