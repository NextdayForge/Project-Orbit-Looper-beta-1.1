import { AiTaskInput, TASK_DURATION_OPTIONS } from '../../types/schedule';

// Matches an explicit "30分" style duration hint restricted to TASK_DURATION_OPTIONS,
// guarding against accidentally matching inside a longer number (e.g. "615分").
const BULK_DURATION_PATTERN = new RegExp(`(${TASK_DURATION_OPTIONS.join('|')})分`, 'g');

export function extractDurationHint(line: string): { title: string; estimatedMinutes?: number } {
  BULK_DURATION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = BULK_DURATION_PATTERN.exec(line))) {
    const charBefore = match.index > 0 ? line[match.index - 1] : '';
    if (/\d/.test(charBefore)) {
      continue;
    }
    const title = (line.slice(0, match.index) + line.slice(match.index + match[0].length))
      .replace(/\s+/g, ' ')
      .trim();
    return { title, estimatedMinutes: Number(match[1]) };
  }

  return { title: line };
}

/** Parses "1 task per line" bulk input, with an optional "30分" style duration hint per line. */
export function parseBulkLines(text: string): AiTaskInput[] {
  const seen = new Set<string>();
  const tasks: AiTaskInput[] = [];

  for (const rawLine of text.split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }
    const { title, estimatedMinutes } = extractDurationHint(trimmed);
    if (!title || seen.has(title)) {
      continue;
    }
    seen.add(title);
    tasks.push(estimatedMinutes ? { title, priority: 3, estimatedMinutes } : { title, priority: 3 });
  }

  return tasks;
}
