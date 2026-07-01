import { buildCandidatePool } from '../intelligence/taskProposal/candidatePoolBuilder';
import { assembleProposalContext } from '../intelligence/taskProposal/proposalContext';
import {
  MAX_PROPOSAL_CANDIDATES,
  selectProposalCandidates,
} from '../intelligence/taskProposal/proposalSelector';
import { scoreCandidatePool } from '../intelligence/taskProposal/scoringEngine';
import { CandidateTask, ProposalCapacitySummary } from '../intelligence/taskProposal/types';
import { DEFAULT_SETTINGS } from '../types/schedule';
import { createDefaultUserModel } from '../types/userModel';
import { makeSession, makeTask } from './fixtures';

describe('selectProposalCandidates', () => {
  const dateKey = '2026-06-30';
  const now = new Date(2026, 5, 30, 10, 0);

  function selectFor(
    tasks: ReturnType<typeof makeTask>[],
    sessions: ReturnType<typeof makeSession>[] = [],
    capacityOverride?: Partial<ProposalCapacitySummary>
  ) {
    const context = assembleProposalContext({
      dateKey,
      now,
      tasks,
      sessions,
      persistedBlocks: [],
      routines: [],
      reflections: [],
      userModel: createDefaultUserModel(now),
      settings: DEFAULT_SETTINGS,
    });
    const pool = buildCandidatePool(context);
    const scores = scoreCandidatePool(pool, context);
    const capacity = { ...context.capacity, ...capacityOverride };
    return selectProposalCandidates(scores, pool, capacity);
  }

  it('selects by score descending', () => {
    const high = makeTask({
      id: 'high',
      status: 'inbox',
      priority: 1,
      estimatedMinutes: 30,
    });
    const low = makeTask({
      id: 'low',
      status: 'inbox',
      priority: 4,
      estimatedMinutes: 30,
    });

    const selected = selectFor([low, high]);

    expect(selected).toHaveLength(2);
    expect(selected[0].taskId).toBe('high');
    expect(selected[0].score).toBeGreaterThan(selected[1].score);
  });

  it('respects remainingFocusMinutes budget', () => {
    const a = makeTask({ id: 'a', status: 'inbox', estimatedMinutes: 40 });
    const b = makeTask({ id: 'b', status: 'inbox', priority: 1, estimatedMinutes: 40 });

    const selected = selectFor([a, b], [], { remainingFocusMinutes: 50 });

    expect(selected).toHaveLength(1);
    expect(selected[0].taskId).toBe('b');
  });

  it('respects remainingSessionSlots limit', () => {
    const tasks = Array.from({ length: 4 }, (_, index) =>
      makeTask({
        id: `task-${index}`,
        status: 'inbox',
        priority: 3,
        estimatedMinutes: 20,
      })
    );

    const selected = selectFor(tasks, [], {
      remainingFocusMinutes: 200,
      remainingSessionSlots: 2,
    });

    expect(selected).toHaveLength(2);
  });

  it('caps selection at five candidates', () => {
    const tasks = Array.from({ length: 8 }, (_, index) =>
      makeTask({
        id: `task-${index}`,
        status: 'inbox',
        priority: 1,
        estimatedMinutes: 10,
      })
    );

    const selected = selectFor(tasks, [], {
      remainingFocusMinutes: 200,
      remainingSessionSlots: 10,
    });

    expect(selected.length).toBe(MAX_PROPOSAL_CANDIDATES);
  });

  it('returns empty when no capacity remains', () => {
    const selected = selectFor([makeTask({ id: 'a', status: 'inbox' })], [], {
      remainingFocusMinutes: 0,
      remainingSessionSlots: 0,
    });

    expect(selected).toEqual([]);
  });

  it('skips scores without a matching candidate entry', () => {
    const candidate: CandidateTask = {
      taskId: 'only',
      task: makeTask({ id: 'only', status: 'inbox' }),
      source: 'inbox',
      remainingMinutes: 30,
    };

    const selected = selectProposalCandidates(
      [
        { taskId: 'only', score: 10, reasons: [] },
        { taskId: 'missing', score: 99, reasons: [] },
      ],
      [candidate],
      {
        targetFocusMinutes: 120,
        targetSessionCount: 5,
        completedSessionCount: 0,
        totalProgressSessionCount: 0,
        remainingFocusMinutes: 120,
        remainingSessionSlots: 5,
        remainingAvailableMinutes: 120,
      }
    );

    expect(selected).toHaveLength(1);
    expect(selected[0].taskId).toBe('only');
  });
});
