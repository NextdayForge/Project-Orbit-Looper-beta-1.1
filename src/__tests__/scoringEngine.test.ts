import { buildCandidatePool } from '../intelligence/taskProposal/candidatePoolBuilder';
import { assembleProposalContext } from '../intelligence/taskProposal/proposalContext';
import { scoreCandidate, SCORE_BY_REASON } from '../intelligence/taskProposal/scoringEngine';
import { CandidateTask, ProposalContext } from '../intelligence/taskProposal/types';
import { DEFAULT_SETTINGS } from '../types/schedule';
import { Session } from '../types/session';
import { createDefaultUserModel } from '../types/userModel';
import { parseDateKey } from '../utils/time';
import { makeSession, makeTask } from './fixtures';

describe('scoreCandidate', () => {
  const dateKey = '2026-06-30';
  const now = new Date(2026, 5, 30, 10, 0);

  function scoreFor(taskOverrides: Parameters<typeof makeTask>[0], sessions: Session[] = []) {
    const task = makeTask(taskOverrides);
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
    const [candidate] = buildCandidatePool(context);
    return scoreCandidate(candidate, context);
  }

  function scoreDirect(candidate: CandidateTask, context: Partial<ProposalContext>) {
    return scoreCandidate(candidate, {
      dateKey,
      carryOverTaskIds: [],
      ...context,
    } as ProposalContext);
  }

  it('scores carry_over', () => {
    const result = scoreFor(
      { id: 'carry', status: 'ready' },
      [
        makeSession({
          taskId: 'carry',
          date: '2026-06-29',
          status: 'planned',
          completed: false,
        }),
      ]
    );

    expect(result.reasons).toContain('carry_over');
    expect(result.score).toBeGreaterThanOrEqual(SCORE_BY_REASON.carry_over);
  });

  it('scores deadline today', () => {
    const dayStart = parseDateKey(dateKey);
    const deadline = new Date(dayStart.getTime() + 18 * 60 * 60 * 1000).toISOString();
    const result = scoreDirect(
      {
        taskId: 'due-today',
        task: makeTask({ id: 'due-today', deadline, priority: 3 }),
        source: 'inbox',
        remainingMinutes: 30,
      },
      { dateKey }
    );

    expect(result.reasons).toContain('deadline_today');
    expect(result.reasons).toContain('deadline_within_24h');
    expect(result.score).toBe(
      SCORE_BY_REASON.deadline_today + SCORE_BY_REASON.deadline_within_24h
    );
  });

  it('scores deadline within 24 hours from day start', () => {
    const dayStart = parseDateKey(dateKey);
    const deadline = new Date(dayStart.getTime() + 20 * 60 * 60 * 1000).toISOString();
    const result = scoreDirect(
      {
        taskId: 'due-soon',
        task: makeTask({ id: 'due-soon', deadline, priority: 3 }),
        source: 'inbox',
        remainingMinutes: 30,
      },
      { dateKey }
    );

    expect(result.reasons).toContain('deadline_within_24h');
    expect(result.score).toBeGreaterThanOrEqual(SCORE_BY_REASON.deadline_within_24h);
  });

  it('scores priority 1 and 2', () => {
    const high = scoreFor({ id: 'p1', status: 'inbox', priority: 1 });
    const medium = scoreFor({ id: 'p2', status: 'inbox', priority: 2 });

    expect(high.reasons).toContain('priority_1');
    expect(medium.reasons).toContain('priority_2');
    expect(high.score).toBe(SCORE_BY_REASON.priority_1);
    expect(medium.score).toBe(SCORE_BY_REASON.priority_2);
  });

  it('stacks independent signals', () => {
    const dayStart = parseDateKey(dateKey);
    const deadline = new Date(dayStart.getTime() + 12 * 60 * 60 * 1000).toISOString();
    const result = scoreFor(
      {
        id: 'stacked',
        status: 'ready',
        priority: 1,
        deadline,
      },
      [
        makeSession({
          taskId: 'stacked',
          date: '2026-06-29',
          status: 'planned',
          completed: false,
        }),
      ]
    );

    expect(result.reasons).toEqual(
      expect.arrayContaining(['carry_over', 'deadline_today', 'deadline_within_24h', 'priority_1'])
    );
    expect(result.score).toBe(
      SCORE_BY_REASON.carry_over +
        SCORE_BY_REASON.deadline_today +
        SCORE_BY_REASON.deadline_within_24h +
        SCORE_BY_REASON.priority_1
    );
  });

  it('returns zero score when no signals match', () => {
    const result = scoreFor({ id: 'plain', status: 'inbox', priority: 3 });

    expect(result.reasons).toEqual([]);
    expect(result.score).toBe(0);
  });
});
