import { buildCandidatePool } from '../intelligence/taskProposal/candidatePoolBuilder';
import { assembleProposalContext } from '../intelligence/taskProposal/proposalContext';
import { DEFAULT_SETTINGS } from '../types/schedule';
import { createDefaultUserModel } from '../types/userModel';
import { makeSession, makeTask } from './fixtures';

describe('buildCandidatePool', () => {
  const dateKey = '2026-06-30';
  const now = new Date(2026, 5, 30, 10, 0);

  it('labels carry-over tasks', () => {
    const task = makeTask({ id: 'carry', title: '未完了の課題', status: 'ready' });
    const context = assembleProposalContext({
      dateKey,
      now,
      tasks: [task],
      sessions: [
        makeSession({
          taskId: 'carry',
          date: '2026-06-29',
          status: 'planned',
          completed: false,
        }),
      ],
      persistedBlocks: [],
      routines: [],
      reflections: [],
      userModel: createDefaultUserModel(now),
      settings: DEFAULT_SETTINGS,
    });

    const pool = buildCandidatePool(context);

    expect(pool).toHaveLength(1);
    expect(pool[0].source).toBe('carry_over');
    expect(pool[0].remainingMinutes).toBeGreaterThan(0);
  });

  it('labels today unfinished before inbox', () => {
    const task = makeTask({ id: 'today', title: '今日のセッション', status: 'inbox' });
    const context = assembleProposalContext({
      dateKey,
      now,
      tasks: [task],
      sessions: [
        makeSession({
          taskId: 'today',
          date: dateKey,
          status: 'planned',
          completed: false,
        }),
      ],
      persistedBlocks: [],
      routines: [],
      reflections: [],
      userModel: createDefaultUserModel(now),
      settings: DEFAULT_SETTINGS,
    });

    const pool = buildCandidatePool(context);

    expect(pool).toHaveLength(1);
    expect(pool[0].source).toBe('today_unfinished');
  });

  it('includes inbox tasks when no today sessions exist', () => {
    const task = makeTask({ id: 'inbox-task', title: '買い物', status: 'inbox' });
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

    const pool = buildCandidatePool(context);

    expect(pool).toHaveLength(1);
    expect(pool[0].source).toBe('inbox');
  });

  it('includes ready tasks', () => {
    const task = makeTask({ id: 'ready-task', title: '読書', status: 'ready' });
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

    const pool = buildCandidatePool(context);

    expect(pool).toHaveLength(1);
    expect(pool[0].source).toBe('ready');
  });

  it('excludes done and cancelled tasks', () => {
    const done = makeTask({ id: 'done', status: 'done' });
    const cancelled = makeTask({ id: 'cancelled', status: 'cancelled' });
    const context = assembleProposalContext({
      dateKey,
      now,
      tasks: [done, cancelled],
      sessions: [],
      persistedBlocks: [],
      routines: [],
      reflections: [],
      userModel: createDefaultUserModel(now),
      settings: DEFAULT_SETTINGS,
    });

    expect(buildCandidatePool(context)).toHaveLength(0);
  });

  it('prefers carry_over label when task is also inbox', () => {
    const task = makeTask({ id: 'both', status: 'inbox' });
    const context = assembleProposalContext({
      dateKey,
      now,
      tasks: [task],
      sessions: [
        makeSession({
          taskId: 'both',
          date: '2026-06-28',
          status: 'planned',
          completed: false,
        }),
      ],
      persistedBlocks: [],
      routines: [],
      reflections: [],
      userModel: createDefaultUserModel(now),
      settings: DEFAULT_SETTINGS,
    });

    expect(buildCandidatePool(context)[0].source).toBe('carry_over');
  });

  it('sorts by source then priority', () => {
    const carry = makeTask({ id: 'carry', title: 'Carry', status: 'ready', priority: 5 });
    const inbox = makeTask({ id: 'inbox', title: 'Inbox', status: 'inbox', priority: 2 });
    const context = assembleProposalContext({
      dateKey,
      now,
      tasks: [inbox, carry],
      sessions: [
        makeSession({
          taskId: 'carry',
          date: '2026-06-29',
          status: 'planned',
          completed: false,
        }),
      ],
      persistedBlocks: [],
      routines: [],
      reflections: [],
      userModel: createDefaultUserModel(now),
      settings: DEFAULT_SETTINGS,
    });

    const pool = buildCandidatePool(context);

    expect(pool.map((item) => item.source)).toEqual(['carry_over', 'inbox']);
  });
});
