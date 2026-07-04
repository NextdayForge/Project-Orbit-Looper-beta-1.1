import { AiTaskInput, DEFAULT_PRIORITY, TASK_DURATION_OPTIONS, TaskPriority } from '../../types/schedule';

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

// Explicit "!高" style priority hint. Longest tokens first so "最高"/"最低"/"普通" match
// before their single-character substrings ("高"/"低"/"普"). Requires the "!" marker
// (rather than a bare word) so an ordinary task title containing e.g. "高" is never
// mistaken for a priority hint.
const PRIORITY_ALIASES: [string, TaskPriority][] = [
  ['最高', 1],
  ['最低', 5],
  ['普通', 3],
  ['高', 2],
  ['低', 4],
  ['普', 3],
  ['1', 1],
  ['2', 2],
  ['3', 3],
  ['4', 4],
  ['5', 5],
];
const BULK_PRIORITY_PATTERN = new RegExp(
  `(?:^|\\s)!(${PRIORITY_ALIASES.map(([token]) => token).join('|')})(?=\\s|$)`
);

export function extractPriorityHint(line: string): { title: string; priority?: TaskPriority } {
  const match = BULK_PRIORITY_PATTERN.exec(line);
  if (!match) {
    return { title: line };
  }
  const priority = PRIORITY_ALIASES.find(([token]) => token === match[1])?.[1];
  const title = (line.slice(0, match.index) + line.slice(match.index + match[0].length))
    .replace(/\s+/g, ' ')
    .trim();
  return { title, priority };
}

/**
 * Parses "1 task per line" bulk input, with optional per-line hints:
 * a "30分" style duration hint, and a "!高" style priority hint.
 */
export function parseBulkLines(text: string): AiTaskInput[] {
  const seen = new Set<string>();
  const tasks: AiTaskInput[] = [];

  for (const rawLine of text.split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }
    const { title: afterDuration, estimatedMinutes } = extractDurationHint(trimmed);
    const { title, priority } = extractPriorityHint(afterDuration);
    if (!title || seen.has(title)) {
      continue;
    }
    seen.add(title);
    tasks.push({
      title,
      priority: priority ?? DEFAULT_PRIORITY,
      ...(estimatedMinutes ? { estimatedMinutes } : {}),
    });
  }

  return tasks;
}
