import { GeminiPlacementResultDto } from '../../infrastructure/gemini/types';
import { DayType } from './types';
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  PLACEMENT_SNAP_MINUTES,
} from './plannerConstants';

const PLACEMENT_CONSTRAINTS = {
  dayStartMinutes: DEFAULT_DAY_START_MINUTES,
  dayEndMinutes: DEFAULT_DAY_END_MINUTES,
  snapMinutes: PLACEMENT_SNAP_MINUTES,
};

export interface PlacementFewShotExample {
  dayType: DayType;
  input: Record<string, unknown>;
  output: GeminiPlacementResultDto;
}

const REST_EXAMPLE: PlacementFewShotExample = {
  dayType: 'REST',
  input: {
    date: '2026-06-27',
    plannerContext: {
      focusLength: 45,
      bufferNeed: 0.1,
      procrastinationIndex: 0.4,
      energyCurve: [0.4, 0.5, 0.45, 0.35, 0.3, 0.25],
    },
    capacityPlan: {
      availableMinutes: 180,
      targetFocusMinutes: 36,
      targetSessionCount: 1,
      bufferMinutes: 30,
      breakMinutes: 7,
      reasonTags: ['capacity_rest'],
    },
    tasks: [
      {
        id: 'task-rest-1',
        title: 'Inbox triage',
        category: 'admin',
        estimatedMinutes: 30,
        priority: 2,
        deadline: null,
        splittable: false,
      },
    ],
    fixedBlocks: [
      {
        id: 'fixed-rest-1',
        title: 'Family lunch',
        startMinutes: 720,
        endMinutes: 840,
        locked: true,
      },
    ],
    anchoredSessions: [],
    cursorStartMinutes: null,
    constraints: PLACEMENT_CONSTRAINTS,
  },
  output: {
    sessions: [
      {
        taskId: 'task-rest-1',
        startMinutes: 540,
        endMinutes: 570,
        reasonTags: ['rest_day', 'morning_light_slot'],
      },
    ],
    blocks: [
      {
        title: 'Recovery buffer',
        startMinutes: 570,
        endMinutes: 585,
        type: 'buffer',
      },
    ],
    reasonTags: ['rest_day', 'minimal_focus', 'capacity_rest'],
  },
};

const LIGHT_EXAMPLE: PlacementFewShotExample = {
  dayType: 'LIGHT',
  input: {
    date: '2026-06-28',
    plannerContext: {
      focusLength: 45,
      bufferNeed: 0.12,
      procrastinationIndex: 0.35,
      energyCurve: [0.5, 0.75, 0.55, 0.65, 0.5, 0.35],
    },
    capacityPlan: {
      availableMinutes: 300,
      targetFocusMinutes: 105,
      targetSessionCount: 3,
      bufferMinutes: 36,
      breakMinutes: 21,
      reasonTags: ['capacity_light'],
    },
    tasks: [
      {
        id: 'task-light-1',
        title: 'Write weekly summary',
        category: 'writing',
        estimatedMinutes: 45,
        priority: 3,
        deadline: null,
        splittable: true,
      },
      {
        id: 'task-light-2',
        title: 'Review pull requests',
        category: 'dev',
        estimatedMinutes: 30,
        priority: 2,
        deadline: null,
        splittable: false,
      },
    ],
    fixedBlocks: [
      {
        id: 'fixed-light-1',
        title: 'Team standup',
        startMinutes: 540,
        endMinutes: 570,
        locked: true,
      },
    ],
    anchoredSessions: [],
    cursorStartMinutes: null,
    constraints: PLACEMENT_CONSTRAINTS,
  },
  output: {
    sessions: [
      {
        taskId: 'task-light-1',
        startMinutes: 585,
        endMinutes: 630,
        reasonTags: ['light_day', 'post_standup_focus'],
      },
      {
        taskId: 'task-light-2',
        startMinutes: 660,
        endMinutes: 690,
        reasonTags: ['light_day', 'midday_slot'],
      },
    ],
    blocks: [
      {
        title: 'Short break',
        startMinutes: 630,
        endMinutes: 645,
        type: 'break',
      },
    ],
    reasonTags: ['light_day', 'moderate_pacing', 'capacity_light'],
  },
};

const NORMAL_EXAMPLE: PlacementFewShotExample = {
  dayType: 'NORMAL',
  input: {
    date: '2026-06-29',
    plannerContext: {
      focusLength: 45,
      bufferNeed: 0.15,
      procrastinationIndex: 0.3,
      energyCurve: [0.55, 0.85, 0.6, 0.7, 0.55, 0.35],
    },
    capacityPlan: {
      availableMinutes: 420,
      targetFocusMinutes: 210,
      targetSessionCount: 5,
      bufferMinutes: 63,
      breakMinutes: 42,
      reasonTags: ['capacity_normal'],
    },
    tasks: [
      {
        id: 'task-normal-1',
        title: 'Implement feature module',
        category: 'dev',
        estimatedMinutes: 90,
        priority: 4,
        deadline: '2026-06-30',
        splittable: true,
      },
      {
        id: 'task-normal-2',
        title: 'Design review',
        category: 'design',
        estimatedMinutes: 45,
        priority: 3,
        deadline: null,
        splittable: false,
      },
      {
        id: 'task-normal-3',
        title: 'Documentation update',
        category: 'writing',
        estimatedMinutes: 45,
        priority: 2,
        deadline: null,
        splittable: true,
      },
    ],
    fixedBlocks: [
      {
        id: 'fixed-normal-1',
        title: 'Client call',
        startMinutes: 780,
        endMinutes: 840,
        locked: true,
      },
    ],
    anchoredSessions: [],
    cursorStartMinutes: null,
    constraints: PLACEMENT_CONSTRAINTS,
  },
  output: {
    sessions: [
      {
        taskId: 'task-normal-1',
        startMinutes: 480,
        endMinutes: 525,
        reasonTags: ['normal_day', 'high_energy_morning', 'priority_task'],
      },
      {
        taskId: 'task-normal-1',
        startMinutes: 540,
        endMinutes: 585,
        reasonTags: ['normal_day', 'split_session', 'priority_task'],
      },
      {
        taskId: 'task-normal-2',
        startMinutes: 870,
        endMinutes: 915,
        reasonTags: ['normal_day', 'post_call_recovery'],
      },
      {
        taskId: 'task-normal-3',
        startMinutes: 930,
        endMinutes: 975,
        reasonTags: ['normal_day', 'afternoon_focus'],
      },
    ],
    blocks: [
      {
        title: 'Transition buffer',
        startMinutes: 525,
        endMinutes: 540,
        type: 'buffer',
      },
      {
        title: 'Afternoon break',
        startMinutes: 915,
        endMinutes: 930,
        type: 'break',
      },
    ],
    reasonTags: ['normal_day', 'balanced_load', 'capacity_normal'],
  },
};

const PUSH_EXAMPLE: PlacementFewShotExample = {
  dayType: 'PUSH',
  input: {
    date: '2026-06-30',
    plannerContext: {
      focusLength: 45,
      bufferNeed: 0.18,
      procrastinationIndex: 0.25,
      energyCurve: [0.6, 0.9, 0.7, 0.75, 0.65, 0.45],
    },
    capacityPlan: {
      availableMinutes: 480,
      targetFocusMinutes: 312,
      targetSessionCount: 7,
      bufferMinutes: 86,
      breakMinutes: 62,
      reasonTags: ['capacity_push'],
    },
    tasks: [
      {
        id: 'task-push-1',
        title: 'Ship release candidate',
        category: 'dev',
        estimatedMinutes: 120,
        priority: 5,
        deadline: '2026-06-30',
        splittable: true,
      },
      {
        id: 'task-push-2',
        title: 'Fix critical bugs',
        category: 'dev',
        estimatedMinutes: 90,
        priority: 5,
        deadline: '2026-06-30',
        splittable: true,
      },
      {
        id: 'task-push-3',
        title: 'Prepare demo',
        category: 'presentation',
        estimatedMinutes: 60,
        priority: 4,
        deadline: '2026-06-30',
        splittable: false,
      },
    ],
    fixedBlocks: [],
    anchoredSessions: [
      {
        id: 'session-push-anchored',
        taskId: 'task-push-1',
        startMinutes: 480,
        endMinutes: 510,
        status: 'in_progress',
      },
    ],
    cursorStartMinutes: 510,
    constraints: PLACEMENT_CONSTRAINTS,
  },
  output: {
    sessions: [
      {
        taskId: 'task-push-1',
        startMinutes: 515,
        endMinutes: 560,
        reasonTags: ['push_day', 'deadline_pressure', 'continue_priority'],
      },
      {
        taskId: 'task-push-2',
        startMinutes: 570,
        endMinutes: 615,
        reasonTags: ['push_day', 'deadline_pressure', 'high_priority'],
      },
      {
        taskId: 'task-push-2',
        startMinutes: 625,
        endMinutes: 670,
        reasonTags: ['push_day', 'split_session', 'high_priority'],
      },
      {
        taskId: 'task-push-3',
        startMinutes: 690,
        endMinutes: 735,
        reasonTags: ['push_day', 'demo_prep', 'afternoon_push'],
      },
    ],
    blocks: [
      {
        title: 'Quick buffer',
        startMinutes: 560,
        endMinutes: 570,
        type: 'buffer',
      },
      {
        title: 'Power nap',
        startMinutes: 670,
        endMinutes: 690,
        type: 'power_nap',
      },
    ],
    reasonTags: ['push_day', 'deadline_sprint', 'capacity_push'],
  },
};

const FEW_SHOT_BY_DAY_TYPE: Record<DayType, PlacementFewShotExample> = {
  REST: REST_EXAMPLE,
  LIGHT: LIGHT_EXAMPLE,
  NORMAL: NORMAL_EXAMPLE,
  PUSH: PUSH_EXAMPLE,
};

const DAY_TYPE_FROM_CAPACITY_TAG: Record<string, DayType> = {
  capacity_rest: 'REST',
  capacity_light: 'LIGHT',
  capacity_normal: 'NORMAL',
  capacity_push: 'PUSH',
};

export function resolveDayTypeFromCapacity(reasonTags: string[]): DayType {
  for (const tag of reasonTags) {
    const dayType = DAY_TYPE_FROM_CAPACITY_TAG[tag];
    if (dayType) {
      return dayType;
    }
  }
  return 'NORMAL';
}

export function selectFewShotExample(dayType: DayType): PlacementFewShotExample {
  return FEW_SHOT_BY_DAY_TYPE[dayType];
}
