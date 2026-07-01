import {
  GeminiBlockDto,
  GeminiPlacementResultDto,
  GeminiSessionDto,
} from '../../infrastructure/gemini/types';
import { CalendarBlock } from '../../types/calendarBlock';
import { Session, isActivePlacementSession } from '../../types/session';
import { generateId } from '../../utils/time';
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  VALID_MINUTE_MAX,
  VALID_MINUTE_MIN,
} from './plannerConstants';
import { PlacementInput, PlacementResult } from './types';

const BLOCK_TYPES = new Set<GeminiBlockDto['type']>(['buffer', 'break', 'power_nap']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntegerMinutes(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= VALID_MINUTE_MIN &&
    value <= VALID_MINUTE_MAX
  );
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (!value.every((item) => typeof item === 'string')) {
    return null;
  }
  return value;
}

function parseSessionDto(value: unknown): GeminiSessionDto | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.taskId !== 'string' || !value.taskId.trim()) {
    return null;
  }
  if (!isIntegerMinutes(value.startMinutes) || !isIntegerMinutes(value.endMinutes)) {
    return null;
  }
  if (value.endMinutes <= value.startMinutes) {
    return null;
  }
  const reasonTags = value.reasonTags === undefined ? undefined : parseStringArray(value.reasonTags);
  if (value.reasonTags !== undefined && reasonTags === null) {
    return null;
  }
  return {
    taskId: value.taskId,
    startMinutes: value.startMinutes,
    endMinutes: value.endMinutes,
    reasonTags: reasonTags ?? undefined,
  };
}

function parseBlockDto(value: unknown): GeminiBlockDto | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.title !== 'string' || !value.title.trim()) {
    return null;
  }
  if (!isIntegerMinutes(value.startMinutes) || !isIntegerMinutes(value.endMinutes)) {
    return null;
  }
  if (value.endMinutes <= value.startMinutes) {
    return null;
  }
  if (typeof value.type !== 'string' || !BLOCK_TYPES.has(value.type as GeminiBlockDto['type'])) {
    return null;
  }
  return {
    title: value.title.trim(),
    startMinutes: value.startMinutes,
    endMinutes: value.endMinutes,
    type: value.type as GeminiBlockDto['type'],
  };
}

export function parseGeminiPlacementResultDto(raw: string): GeminiPlacementResultDto | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  if (!Array.isArray(parsed.sessions) || !Array.isArray(parsed.blocks)) {
    return null;
  }

  const reasonTags = parseStringArray(parsed.reasonTags);
  if (reasonTags === null) {
    return null;
  }

  const sessions: GeminiSessionDto[] = [];
  for (const item of parsed.sessions) {
    const session = parseSessionDto(item);
    if (!session) {
      return null;
    }
    sessions.push(session);
  }

  const blocks: GeminiBlockDto[] = [];
  for (const item of parsed.blocks) {
    const block = parseBlockDto(item);
    if (!block) {
      return null;
    }
    blocks.push(block);
  }

  return { sessions, blocks, reasonTags };
}

interface TimeRange {
  start: number;
  end: number;
}

function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

function collectOccupiedRanges(input: PlacementInput): TimeRange[] {
  const fixedBlocks = input.blocks.filter(
    (block) => block.date === input.date && block.type === 'fixed'
  );
  const anchoredSessions = (input.anchoredSessions ?? []).filter(isActivePlacementSession);

  return [
    ...fixedBlocks.map((block) => ({ start: block.startMinutes, end: block.endMinutes })),
    ...anchoredSessions.map((session) => ({
      start: session.startMinutes,
      end: session.endMinutes,
    })),
  ];
}

function validateBusinessRules(dto: GeminiPlacementResultDto, input: PlacementInput): boolean {
  const dayStart = input.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES;
  const dayEnd = input.dayEndMinutes ?? DEFAULT_DAY_END_MINUTES;
  const taskIds = new Set(
    input.tasks
      .filter((task) => task.status !== 'done' && task.status !== 'cancelled')
      .map((task) => task.id)
  );

  for (const session of dto.sessions) {
    if (!taskIds.has(session.taskId)) {
      return false;
    }
    if (session.startMinutes < dayStart || session.endMinutes > dayEnd) {
      return false;
    }
  }

  const occupied = collectOccupiedRanges(input);
  const placedRanges: TimeRange[] = [];

  for (const session of dto.sessions) {
    const range = { start: session.startMinutes, end: session.endMinutes };
    if (occupied.some((block) => overlaps(block, range))) {
      return false;
    }
    if (placedRanges.some((block) => overlaps(block, range))) {
      return false;
    }
    placedRanges.push(range);
  }

  for (const block of dto.blocks) {
    const range = { start: block.startMinutes, end: block.endMinutes };
    if (block.startMinutes < dayStart || block.endMinutes > dayEnd) {
      return false;
    }
    if (occupied.some((item) => overlaps(item, range))) {
      return false;
    }
    if (placedRanges.some((item) => overlaps(item, range))) {
      return false;
    }
    placedRanges.push(range);
  }

  if (input.cursorStartMinutes !== undefined) {
    for (const session of dto.sessions) {
      if (session.startMinutes < input.cursorStartMinutes) {
        return false;
      }
    }
    for (const block of dto.blocks) {
      if (block.startMinutes < input.cursorStartMinutes) {
        return false;
      }
    }
  }

  const pendingTasks = input.tasks.filter(
    (task) => task.status !== 'done' && task.status !== 'cancelled' && task.estimatedMinutes > 0
  );
  if (
    pendingTasks.length > 0 &&
    input.capacity.targetSessionCount > 0 &&
    dto.sessions.length === 0
  ) {
    return false;
  }

  return true;
}

function mapToPlacementResult(
  dto: GeminiPlacementResultDto,
  input: PlacementInput
): PlacementResult {
  const fixedBlocks = input.blocks.filter(
    (block) => block.date === input.date && block.type === 'fixed'
  );

  const sessions: Session[] = dto.sessions.map((session) => ({
    id: generateId(),
    taskId: session.taskId,
    date: input.date,
    startMinutes: session.startMinutes,
    endMinutes: session.endMinutes,
    estimatedMinutes: session.endMinutes - session.startMinutes,
    pauseCount: 0,
    status: 'planned',
    outcome: null,
    aiGenerated: true,
    completed: false,
    reasonTags: [...(session.reasonTags ?? []), 'gemini_placement'],
  }));

  const blocks: CalendarBlock[] = dto.blocks.map((block) => ({
    id: generateId(),
    title: block.title,
    date: input.date,
    startMinutes: block.startMinutes,
    endMinutes: block.endMinutes,
    type: block.type,
    locked: false,
    source: 'ai',
    recurring: false,
  }));

  return {
    sessions,
    blocks: [...fixedBlocks, ...blocks],
    reasonTags: [...dto.reasonTags, 'gemini_placement'],
  };
}

export function validateAndMapPlacementResult(
  raw: string,
  input: PlacementInput
): PlacementResult | null {
  const dto = parseGeminiPlacementResultDto(raw);
  if (!dto) {
    return null;
  }
  if (!validateBusinessRules(dto, input)) {
    return null;
  }
  return mapToPlacementResult(dto, input);
}
