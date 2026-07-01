import { assembleProposalContext } from '../intelligence/taskProposal/proposalContext';
import { DEFAULT_SETTINGS } from '../types/schedule';
import { createDefaultUserModel } from '../types/userModel';
import { makeFixedBlock, makeSession, makeTask } from './fixtures';

describe('assembleProposalContext', () => {
  const dateKey = '2026-06-30';
  const now = new Date(2026, 5, 30, 10, 30);

  it('builds candidate pool from placable inbox tasks', () => {
    const task = makeTask({ id: 'task-a', title: '英語', status: 'inbox', estimatedMinutes: 45 });
    const context = assembleProposalContext({
      dateKey,
      now,
      tasks: [task],
      sessions: [],
      persistedBlocks: [],
      routines: [],
      reflections: [],
      userModel: createDefaultUserModel(now),
      settings: DEFAULT_SETTINGS,
    });

    expect(context.candidateTaskIds).toContain('task-a');
    expect(context.candidateTasks).toHaveLength(1);
    expect(context.candidateTasks[0].title).toBe('英語');
    expect(context.daySnapshot.dayType).toBeDefined();
    expect(context.learningNotes).toEqual([]);
  });

  it('includes carry-over task ids from past incomplete sessions', () => {
    const task = makeTask({ id: 'carry-task', status: 'ready' });
    const sessions = [
      makeSession({
        taskId: 'carry-task',
        date: '2026-06-29',
        status: 'planned',
        completed: false,
      }),
    ];

    const context = assembleProposalContext({
      dateKey,
      now,
      tasks: [task],
      sessions,
      persistedBlocks: [],
      routines: [],
      reflections: [],
      userModel: createDefaultUserModel(now),
      settings: DEFAULT_SETTINGS,
    });

    expect(context.carryOverTaskIds).toEqual(['carry-task']);
    expect(context.candidateTaskIds).toContain('carry-task');
  });

  it('computes remaining focus from completed sessions today', () => {
    const task = makeTask({ id: 'task-done' });
    const sessions = [
      makeSession({
        taskId: 'task-done',
        date: dateKey,
        startMinutes: 9 * 60,
        endMinutes: 10 * 60,
        status: 'completed',
        completed: true,
      }),
    ];

    const context = assembleProposalContext({
      dateKey,
      now,
      tasks: [task],
      sessions,
      persistedBlocks: [],
      routines: [],
      reflections: [],
      userModel: createDefaultUserModel(now),
      settings: DEFAULT_SETTINGS,
    });

    expect(context.capacity.completedSessionCount).toBe(1);
    expect(context.capacity.remainingFocusMinutes).toBeLessThan(
      context.capacity.targetFocusMinutes
    );
    expect(context.capacity.remainingSessionSlots).toBeLessThan(
      context.capacity.targetSessionCount
    );
  });

  it('reduces remaining available minutes when fixed blocks occupy the day', () => {
    const context = assembleProposalContext({
      dateKey,
      now,
      tasks: [],
      sessions: [],
      persistedBlocks: [
        makeFixedBlock({
          date: dateKey,
          startMinutes: 9 * 60,
          endMinutes: 17 * 60,
        }),
      ],
      routines: [],
      reflections: [],
      userModel: createDefaultUserModel(now),
      settings: DEFAULT_SETTINGS,
    });

    expect(context.fixedBlocks).toHaveLength(1);
    expect(context.capacity.remainingAvailableMinutes).toBeLessThan(
      DEFAULT_SETTINGS.sleepMinutes - DEFAULT_SETTINGS.wakeMinutes
    );
  });

  it('selects up to three recent reflections on or before the target date', () => {
    const context = assembleProposalContext({
      dateKey,
      now,
      tasks: [],
      sessions: [],
      persistedBlocks: [],
      routines: [],
      reflections: [
        {
          id: 'r1',
          date: '2026-06-28',
          mood: 3,
          energy: 3,
          wins: [],
          blockers: [],
          createdAt: '2026-06-28T20:00:00.000Z',
        },
        {
          id: 'r2',
          date: '2026-06-30',
          mood: 4,
          energy: 4,
          wins: ['集中できた'],
          blockers: [],
          createdAt: '2026-06-30T07:00:00.000Z',
        },
        {
          id: 'r3',
          date: '2026-07-01',
          mood: 2,
          energy: 2,
          wins: [],
          blockers: [],
          createdAt: '2026-07-01T20:00:00.000Z',
        },
      ],
      userModel: createDefaultUserModel(now),
      settings: DEFAULT_SETTINGS,
    });

    expect(context.recentReflections.map((r) => r.id)).toEqual(['r2', 'r1']);
  });
});
