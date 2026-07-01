import { CalendarBlock } from '../types/calendarBlock';
import { CapacityPlan } from '../types/capacityPlan';
import { Session } from '../types/session';
import { Task } from '../types/task';
import { DEFAULT_ENERGY_CURVE, PlannerContext } from '../types/userModel';

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: nextId('task'),
    title: 'Task',
    category: 'general',
    estimatedMinutes: 60,
    priority: 3,
    status: 'ready',
    splittable: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  const startMinutes = overrides.startMinutes ?? 9 * 60;
  const endMinutes = overrides.endMinutes ?? startMinutes + 45;
  return {
    id: nextId('session'),
    taskId: nextId('task'),
    date: '2026-06-28',
    startMinutes,
    endMinutes,
    estimatedMinutes: endMinutes - startMinutes,
    pauseCount: 0,
    status: 'planned',
    outcome: null,
    aiGenerated: false,
    completed: false,
    reasonTags: [],
    ...overrides,
  };
}

export function makeFixedBlock(overrides: Partial<CalendarBlock> = {}): CalendarBlock {
  const startMinutes = overrides.startMinutes ?? 12 * 60;
  const endMinutes = overrides.endMinutes ?? startMinutes + 60;
  return {
    id: nextId('block'),
    title: 'Fixed',
    date: '2026-06-28',
    startMinutes,
    endMinutes,
    type: 'fixed',
    locked: true,
    source: 'user',
    recurring: false,
    ...overrides,
  };
}

export function makeContext(overrides: Partial<PlannerContext> = {}): PlannerContext {
  return {
    procrastinationIndex: 0.3,
    energyCurve: [...DEFAULT_ENERGY_CURVE],
    focusLength: 45,
    estimationFactor: { default: 1, general: 1 },
    bufferNeed: 0.2,
    lastDailySnapshot: null,
    aiConfidence: 0.5,
    ...overrides,
  };
}

export function makeCapacity(overrides: Partial<CapacityPlan> = {}): CapacityPlan {
  return {
    availableMinutes: 600,
    targetFocusMinutes: 240,
    targetSessionCount: 4,
    bufferMinutes: 0,
    breakMinutes: 0,
    reasonTags: [],
    ...overrides,
  };
}
