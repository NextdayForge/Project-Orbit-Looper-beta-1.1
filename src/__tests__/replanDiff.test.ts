import { buildAiReplanProposal, buildReplanProposal } from '../intelligence/planner/replanDiff';
import { DayPlan } from '../types/dayPlan';
import { makeSession, makeTask } from './fixtures';

const DATE = '2026-06-28';

function makePlan(sessions: ReturnType<typeof makeSession>[]): DayPlan {
  return {
    date: DATE,
    dayType: 'NORMAL',
    capacity: {
      availableMinutes: 600,
      targetFocusMinutes: 240,
      targetSessionCount: 2,
      bufferMinutes: 15,
      breakMinutes: 30,
      reasonTags: [],
    },
    sessions,
    calendarBlocks: [],
    reasonTags: [],
    generatedAt: '2026-06-28T09:00:00.000Z',
  };
}

describe('buildAiReplanProposal', () => {
  it('lists every replanned session even when times are unchanged', () => {
    const task = makeTask({ id: 'task-a', title: '英語' });
    const before = makeSession({
      id: 'session-old',
      taskId: 'task-a',
      date: DATE,
      startMinutes: 10 * 60,
      endMinutes: 11 * 60,
    });
    const after = makeSession({
      id: 'session-new',
      taskId: 'task-a',
      date: DATE,
      startMinutes: 10 * 60,
      endMinutes: 11 * 60,
    });

    const proposal = buildAiReplanProposal(
      [task],
      [before],
      makePlan([after]),
      ['task-a']
    );

    expect(proposal.lines).toHaveLength(1);
    expect(proposal.lines[0]).toMatchObject({
      title: '英語',
      fromLabel: '10:00–11:00',
      toLabel: '10:00–11:00',
    });
    expect(proposal.summary).toContain('1件を並べ替え');
  });

  it('shows before and after times for moved sessions', () => {
    const task = makeTask({ id: 'task-b', title: '数学' });
    const before = makeSession({
      id: 'session-old',
      taskId: 'task-b',
      date: DATE,
      startMinutes: 9 * 60,
      endMinutes: 10 * 60,
    });
    const after = makeSession({
      id: 'session-new',
      taskId: 'task-b',
      date: DATE,
      startMinutes: 14 * 60,
      endMinutes: 15 * 60,
    });

    const proposal = buildAiReplanProposal(
      [task],
      [before],
      makePlan([after]),
      ['task-b']
    );

    expect(proposal.lines[0]).toMatchObject({
      title: '数学',
      fromLabel: '09:00–10:00',
      toLabel: '14:00–15:00',
    });
    expect(proposal.finishByLabel).toBe('15:00');
  });
});

describe('buildReplanProposal', () => {
  it('keeps shift-from-now diff lines for rescheduled sessions', () => {
    const task = makeTask({ id: 'task-c', title: '読書' });
    const before = makeSession({
      id: 'session-old',
      taskId: 'task-c',
      date: DATE,
      startMinutes: 9 * 60,
      endMinutes: 10 * 60,
    });
    const rescheduled = { ...before, status: 'rescheduled' as const, rescheduledAt: '2026-06-28T12:00:00.000Z' };
    const replacement = makeSession({
      id: 'session-new',
      taskId: 'task-c',
      date: DATE,
      startMinutes: 12 * 60,
      endMinutes: 13 * 60,
    });

    const proposal = buildReplanProposal(
      [task],
      [before],
      makePlan([rescheduled, replacement])
    );

    expect(proposal.lines).toHaveLength(1);
    expect(proposal.lines[0].toLabel).toBe('12:00–13:00');
  });
});
