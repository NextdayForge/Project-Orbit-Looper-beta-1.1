import { applyCoachScheduleAction } from '../intelligence/coach/coachApply';
import { CoachScheduleFixedEventsAction } from '../intelligence/coach/types';
import { CalendarBlock } from '../types/calendarBlock';
import { CreateCalendarBlockPayload } from '../presentation/calendar/CalendarEditorAdapter';
import { PlannerGateway } from '../presentation/calendar/CalendarPlannerAdapter';

// ts-jest hoists jest.mock() calls above the imports above, so these mocks
// are in place before coachApply.ts (and its transitive dependencies,
// including the AsyncStorage-backed repositories) are ever evaluated.
jest.mock('../repositories', () => ({
  taskRepository: { getAll: jest.fn(async () => []) },
  sessionRepository: { getAll: jest.fn(async () => []) },
  userModelRepository: { get: jest.fn(async () => ({})) },
  settingsRepository: { get: jest.fn(async () => ({})) },
}));

jest.mock('../intelligence/taskEstimate/TaskDurationEstimator', () => ({
  taskDurationEstimator: { estimateBatch: jest.fn(async () => []) },
}));

function makeFakeEditorGateway() {
  const createCalendarBlock = jest.fn(
    async (input: CreateCalendarBlockPayload): Promise<CalendarBlock> => ({
      id: 'block-1',
      locked: false,
      source: 'ai',
      recurring: false,
      ...input,
    })
  );
  return {
    createCalendarBlock,
    createTask: jest.fn(),
    updateTask: jest.fn(),
  };
}

const NOOP_PLANNER_GATEWAY = {} as PlannerGateway;

describe('applyCoachScheduleAction — schedule_fixed_events', () => {
  it('creates a locked, AI-sourced fixed CalendarBlock honoring the exact requested start time', async () => {
    const gateway = makeFakeEditorGateway();
    const action: CoachScheduleFixedEventsAction = {
      kind: 'schedule_fixed_events',
      events: [{ title: '寝る', startMinutes: 22 * 60, endMinutes: 23 * 60 }],
      autoApply: true,
    };

    const result = await applyCoachScheduleAction(action, {
      date: new Date(2026, 8, 8),
      defaultDurationMinutes: 30,
      editorGateway: gateway,
      plannerGateway: NOOP_PLANNER_GATEWAY,
    });

    expect(gateway.createCalendarBlock).toHaveBeenCalledTimes(1);
    expect(gateway.createCalendarBlock).toHaveBeenCalledWith({
      title: '寝る',
      date: '2026-09-08',
      startMinutes: 22 * 60,
      endMinutes: 23 * 60,
      type: 'fixed',
      locked: true,
      source: 'ai',
    });
    expect(gateway.createTask).not.toHaveBeenCalled();
    expect(result.result).toBe('applied');
    expect(result.message).toContain('寝る');
  });

  it('creates one CalendarBlock per proposed event, in order', async () => {
    const gateway = makeFakeEditorGateway();
    const action: CoachScheduleFixedEventsAction = {
      kind: 'schedule_fixed_events',
      events: [
        { title: '起床', startMinutes: 7 * 60, endMinutes: 7 * 60 + 30 },
        { title: '通院', startMinutes: 15 * 60, endMinutes: 16 * 60 },
      ],
      autoApply: true,
    };

    await applyCoachScheduleAction(action, {
      date: new Date(2026, 8, 8),
      defaultDurationMinutes: 30,
      editorGateway: gateway,
      plannerGateway: NOOP_PLANNER_GATEWAY,
    });

    expect(gateway.createCalendarBlock).toHaveBeenCalledTimes(2);
    expect(gateway.createCalendarBlock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ title: '起床', startMinutes: 7 * 60 })
    );
    expect(gateway.createCalendarBlock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ title: '通院', startMinutes: 15 * 60 })
    );
  });

  it('reports skipped_empty and creates nothing when there are no events', async () => {
    const gateway = makeFakeEditorGateway();
    const action: CoachScheduleFixedEventsAction = {
      kind: 'schedule_fixed_events',
      events: [],
      autoApply: true,
    };

    const result = await applyCoachScheduleAction(action, {
      date: new Date(2026, 8, 8),
      defaultDurationMinutes: 30,
      editorGateway: gateway,
      plannerGateway: NOOP_PLANNER_GATEWAY,
    });

    expect(gateway.createCalendarBlock).not.toHaveBeenCalled();
    expect(result.result).toBe('skipped_empty');
  });
});
