import { GeminiPlacementPrompt } from '../../infrastructure/gemini/types';

import { CalendarBlock } from '../../types/calendarBlock';

import { Task } from '../../types/task';

import { isActivePlacementSession, Session } from '../../types/session';

import { PlacementInput } from './types';
import { selectFewShotExample, resolveDayTypeFromCapacity } from './placementFewShots';
import { PLACEMENT_PLANNER_RULES } from './placementPlannerRules';
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  PLACEMENT_SNAP_MINUTES,
} from './plannerConstants';

import {

  PLACEMENT_RESULT_RESPONSE_SCHEMA,

  PLACEMENT_SYSTEM_INSTRUCTION,

} from './placementResultSchema';



function tasksForPlacement(tasks: Task[]): Array<Record<string, unknown>> {

  return tasks

    .filter((task) => task.status !== 'done' && task.status !== 'cancelled')

    .map((task) => ({

      id: task.id,

      title: task.title,

      category: task.category,

      estimatedMinutes: task.estimatedMinutes,

      priority: task.priority,

      deadline: task.deadline ?? null,

      splittable: task.splittable,

    }));

}



function fixedBlocksForDate(blocks: CalendarBlock[], date: string): Array<Record<string, unknown>> {

  return blocks

    .filter((block) => block.date === date && block.type === 'fixed')

    .map((block) => ({

      id: block.id,

      title: block.title,

      startMinutes: block.startMinutes,

      endMinutes: block.endMinutes,

      locked: block.locked,

    }));

}



function anchoredSessionsForPrompt(sessions: Session[] | undefined): Array<Record<string, unknown>> {

  return (sessions ?? [])

    .filter(isActivePlacementSession)

    .map((session) => ({

      id: session.id,

      taskId: session.taskId,

      startMinutes: session.startMinutes,

      endMinutes: session.endMinutes,

      status: session.status,

    }));

}



function buildActualInputPayload(input: PlacementInput): Record<string, unknown> {

  return {

    date: input.date,

    plannerContext: input.context,

    capacityPlan: input.capacity,

    tasks: tasksForPlacement(input.tasks),

    fixedBlocks: fixedBlocksForDate(input.blocks, input.date),

    anchoredSessions: anchoredSessionsForPrompt(input.anchoredSessions),

    cursorStartMinutes: input.cursorStartMinutes ?? null,

    constraints: {
      dayStartMinutes: input.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES,
      dayEndMinutes: input.dayEndMinutes ?? DEFAULT_DAY_END_MINUTES,
      snapMinutes: PLACEMENT_SNAP_MINUTES,
    },

  };

}



function buildUserContent(input: PlacementInput): string {

  const dayType = resolveDayTypeFromCapacity(input.capacity.reasonTags);

  const fewShot = selectFewShotExample(dayType);

  const actualInput = buildActualInputPayload(input);



  return [

    '## 2. Planner Rules',

    PLACEMENT_PLANNER_RULES,

    '',

    `## 3. Few-shot Example (${dayType})`,

    '### Input',

    JSON.stringify(fewShot.input, null, 2),

    '### Expected Output',

    JSON.stringify(fewShot.output, null, 2),

    '',

    '## 4. Actual Input',

    JSON.stringify(actualInput, null, 2),

    '',

    'Produce PlacementResult JSON for section 4 only.',

  ].join('\n');

}



export function buildPlacementPrompt(input: PlacementInput): GeminiPlacementPrompt {

  return {

    systemInstruction: PLACEMENT_SYSTEM_INSTRUCTION,

    userContent: buildUserContent(input),

    responseSchema: PLACEMENT_RESULT_RESPONSE_SCHEMA,

  };

}


