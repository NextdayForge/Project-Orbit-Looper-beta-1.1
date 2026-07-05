import { applyDelete, CalendarEditorGateway } from '../presentation/calendar/CalendarEditorAdapter';
import { EditableCalendarEvent } from '../presentation/calendar/CalendarDisplayEvent';
import { makeSession, makeTask } from './fixtures';

function makeEditable(overrides: Partial<EditableCalendarEvent> = {}): EditableCalendarEvent {
  return {
    displayId: 'd1',
    entityType: 'session',
    entityId: 's1',
    date: '2026-06-28',
    title: 'Task',
    startMinutes: 540,
    endMinutes: 600,
    color: 'blue',
    priority: 3,
    locked: false,
    editable: true,
    deletable: true,
    isNew: false,
    ...overrides,
  };
}

function makeGateway(overrides: Partial<CalendarEditorGateway> = {}): CalendarEditorGateway {
  return {
    sessions: [],
    calendarBlocks: [],
    tasks: [],
    createTask: jest.fn(),
    createSession: jest.fn(),
    createCalendarBlock: jest.fn(),
    updateSession: jest.fn(),
    deleteSession: jest.fn().mockResolvedValue(undefined),
    updateCalendarBlock: jest.fn(),
    deleteCalendarBlock: jest.fn(),
    updateTask: jest.fn().mockResolvedValue(undefined),
    deleteTask: jest.fn().mockResolvedValue(undefined),
    toggleSessionCompleted: jest.fn(),
    ...overrides,
  };
}

describe('applyDelete (session)', () => {
  it('deletes the task entirely when this was its only active session', async () => {
    const task = makeTask({ id: 't1', estimatedMinutes: 60 });
    const session = makeSession({ id: 's1', taskId: 't1', date: '2026-06-28' });
    const gateway = makeGateway({ sessions: [session], tasks: [task] });

    await applyDelete(makeEditable({ entityId: 's1' }), gateway);

    expect(gateway.deleteSession).toHaveBeenCalledWith('s1');
    expect(gateway.deleteTask).toHaveBeenCalledWith('t1');
    expect(gateway.updateTask).not.toHaveBeenCalled();
  });

  it('shrinks the task remaining scope instead of recreating it when another active session still exists', async () => {
    // Regression: splittable task with a chunk today (being deleted) and another
    // chunk still planned tomorrow. Previously the task's estimatedMinutes stayed
    // untouched, so the next AI replan would recreate a new session covering the
    // just-deleted chunk's time — looking like the deleted task "came back".
    const task = makeTask({ id: 't1', estimatedMinutes: 120, splittable: true });
    const today = makeSession({
      id: 's-today',
      taskId: 't1',
      date: '2026-06-28',
      startMinutes: 540,
      endMinutes: 600,
      estimatedMinutes: 60,
      status: 'planned',
    });
    const tomorrow = makeSession({ id: 's-tomorrow', taskId: 't1', date: '2026-06-29', status: 'planned' });
    const gateway = makeGateway({ sessions: [today, tomorrow], tasks: [task] });

    await applyDelete(makeEditable({ entityId: 's-today' }), gateway);

    expect(gateway.deleteSession).toHaveBeenCalledWith('s-today');
    expect(gateway.deleteTask).not.toHaveBeenCalled();
    expect(gateway.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', estimatedMinutes: 60 })
    );
  });

  it('does not shrink the task when the deleted session was already completed', async () => {
    const task = makeTask({ id: 't1', estimatedMinutes: 120 });
    const completedToday = makeSession({
      id: 's-today',
      taskId: 't1',
      date: '2026-06-28',
      status: 'completed',
      completed: true,
    });
    const tomorrow = makeSession({ id: 's-tomorrow', taskId: 't1', date: '2026-06-29', status: 'planned' });
    const gateway = makeGateway({ sessions: [completedToday, tomorrow], tasks: [task] });

    await applyDelete(makeEditable({ entityId: 's-today' }), gateway);

    expect(gateway.deleteTask).not.toHaveBeenCalled();
    expect(gateway.updateTask).not.toHaveBeenCalled();
  });

  it('never reduces estimatedMinutes below zero', async () => {
    const task = makeTask({ id: 't1', estimatedMinutes: 30 });
    const today = makeSession({
      id: 's-today',
      taskId: 't1',
      date: '2026-06-28',
      startMinutes: 540,
      endMinutes: 600,
      estimatedMinutes: 60,
      status: 'planned',
    });
    const tomorrow = makeSession({ id: 's-tomorrow', taskId: 't1', date: '2026-06-29', status: 'planned' });
    const gateway = makeGateway({ sessions: [today, tomorrow], tasks: [task] });

    await applyDelete(makeEditable({ entityId: 's-today' }), gateway);

    expect(gateway.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', estimatedMinutes: 0 })
    );
  });
});
