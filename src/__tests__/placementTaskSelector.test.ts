import {
  excludeTaskIdsWithFutureSessions,
  getActiveSessionTaskIdsForDate,
  getAnchorSessionsForReplan,
  getRemainingMinutesForPlacement,
  hasFutureMutableSession,
  selectTasksForPlacement,
} from '../intelligence/planner/placementTaskSelector';
import { makeSession, makeTask } from './fixtures';

const DATE = '2026-06-28';

describe('getActiveSessionTaskIdsForDate', () => {
  it('collects task ids of active, non-completed sessions on the date', () => {
    const sessions = [
      makeSession({ taskId: 'a', date: DATE }),
      makeSession({ taskId: 'b', date: DATE, status: 'completed' }),
      makeSession({ taskId: 'c', date: DATE, status: 'rescheduled' }),
      makeSession({ taskId: 'd', date: '2026-06-29' }),
    ];

    expect(getActiveSessionTaskIdsForDate(sessions, DATE)).toEqual(['a']);
  });
});

describe('getAnchorSessionsForReplan', () => {
  it('returns active sessions whose task is NOT being replanned', () => {
    const sessions = [
      makeSession({ taskId: 'replan', date: DATE }),
      makeSession({ taskId: 'keep', date: DATE }),
    ];

    const anchors = getAnchorSessionsForReplan(sessions, DATE, ['replan']);
    expect(anchors.map((s) => s.taskId)).toEqual(['keep']);
  });
});

describe('remaining minutes', () => {
  it('subtracts minutes from completed sessions on other dates', () => {
    const task = makeTask({ id: 'split', estimatedMinutes: 120 });
    const sessions = [
      makeSession({
        taskId: 'split',
        date: '2026-06-27',
        estimatedMinutes: 45,
        completed: true,
        status: 'completed',
      }),
    ];

    expect(getRemainingMinutesForPlacement(task, DATE, sessions)).toBe(75);
  });

  it('does not subtract incomplete sessions on past dates so they can carry over', () => {
    const task = makeTask({ id: 'carry', estimatedMinutes: 60 });
    const sessions = [
      makeSession({ taskId: 'carry', date: '2026-06-27', estimatedMinutes: 60 }),
    ];

    expect(getRemainingMinutesForPlacement(task, DATE, sessions)).toBe(60);
  });

  it('excludes done/cancelled tasks and zero-estimate tasks from placement', () => {
    const tasks = [
      makeTask({ id: 'ok', estimatedMinutes: 60, status: 'ready' }),
      makeTask({ id: 'done', estimatedMinutes: 60, status: 'done' }),
      makeTask({ id: 'zero', estimatedMinutes: 0, status: 'ready' }),
    ];

    const selected = selectTasksForPlacement(tasks, [], DATE);
    expect(selected.map((t) => t.id)).toEqual(['ok']);
  });
});

describe('excludeTaskIdsWithFutureSessions', () => {
  // selectTasksForPlacement only nets out *completed* sessions on other dates
  // (see "does not subtract incomplete sessions on past dates" above, which is
  // deliberate — that's how carry-over works). So on its own it would let a task
  // already scheduled for tomorrow also get a second, duplicate session placed
  // today. This filter is the other half: it only looks forward, for an existing
  // mutable (not done/cancelled/rescheduled) session strictly after `dateKey`.
  it('excludes a task that already has a mutable session on a later date', () => {
    const sessions = [makeSession({ taskId: 'future', date: '2026-06-29', status: 'planned' })];
    expect(hasFutureMutableSession('future', DATE, sessions)).toBe(true);
    expect(excludeTaskIdsWithFutureSessions(['future', 'other'], DATE, sessions)).toEqual(['other']);
  });

  it('does not exclude a task whose only future session is completed/cancelled/rescheduled', () => {
    const sessions = [
      makeSession({ taskId: 'done-tomorrow', date: '2026-06-29', status: 'completed', completed: true }),
      makeSession({ taskId: 'cancelled-tomorrow', date: '2026-06-29', status: 'cancelled' }),
      makeSession({ taskId: 'rescheduled-tomorrow', date: '2026-06-29', status: 'rescheduled' }),
    ];
    const ids = ['done-tomorrow', 'cancelled-tomorrow', 'rescheduled-tomorrow'];
    expect(excludeTaskIdsWithFutureSessions(ids, DATE, sessions)).toEqual(ids);
  });

  it('does not exclude a task whose mutable session is on the target date itself or in the past', () => {
    const sessions = [
      makeSession({ taskId: 'today', date: DATE, status: 'planned' }),
      makeSession({ taskId: 'past', date: '2026-06-27', status: 'planned' }),
    ];
    expect(excludeTaskIdsWithFutureSessions(['today', 'past'], DATE, sessions)).toEqual(['today', 'past']);
  });
});
