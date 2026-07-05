import { resolveMorningReplanTaskIds } from '../intelligence/planner/morningTaskSelector';
import { makeSession, makeTask } from './fixtures';

const TODAY = '2026-06-28';
const YESTERDAY = '2026-06-27';

const TWO_DAYS_AGO = '2026-06-26';

describe('resolveMorningReplanTaskIds', () => {
  it('returns today active session task ids merged with carry-over', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' }), makeTask({ id: 'carry' })];
    const sessions = [
      makeSession({ taskId: 'a', date: TODAY }),
      makeSession({ taskId: 'b', date: TODAY, status: 'rescheduled' }),
      makeSession({ taskId: 'carry', date: YESTERDAY, startMinutes: 600, endMinutes: 690 }),
    ];

    expect(resolveMorningReplanTaskIds(tasks, sessions, TODAY)).toEqual(
      expect.arrayContaining(['a', 'carry'])
    );
  });

  it('merges placable tasks and yesterday incomplete carry-over', () => {
    const tasks = [
      makeTask({ id: 'new', status: 'scheduled', estimatedMinutes: 60 }),
      makeTask({ id: 'carry', status: 'scheduled', estimatedMinutes: 90 }),
    ];
    const sessions = [
      makeSession({ taskId: 'carry', date: YESTERDAY, startMinutes: 600, endMinutes: 690 }),
    ];

    const ids = resolveMorningReplanTaskIds(tasks, sessions, TODAY);
    expect(ids).toContain('new');
    expect(ids).toContain('carry');
  });

  it('carries incomplete tasks from multiple past days', () => {
    const tasks = [makeTask({ id: 'old', status: 'scheduled', estimatedMinutes: 60 })];
    const sessions = [
      makeSession({ taskId: 'old', date: TWO_DAYS_AGO, startMinutes: 600, endMinutes: 660 }),
    ];

    const ids = resolveMorningReplanTaskIds(tasks, sessions, TODAY);
    expect(ids).toContain('old');
  });

  it('still includes a never-placed placable task even when today already has active sessions', () => {
    // Regression test: previously, once today had ANY active session, brand-new/
    // never-placed inbox tasks (no session anywhere — e.g. one that failed to be
    // placed on an earlier replan attempt) were excluded from replan candidates
    // entirely, making them permanently unreachable (this app has no backlog view).
    const orphan = makeTask({ id: 'orphan', status: 'ready', estimatedMinutes: 30 });
    const placedToday = makeTask({ id: 'placed', status: 'ready', estimatedMinutes: 45 });
    const sessions = [makeSession({ taskId: 'placed', date: TODAY })];

    const ids = resolveMorningReplanTaskIds([orphan, placedToday], sessions, TODAY);
    expect(ids).toEqual(expect.arrayContaining(['placed', 'orphan']));
  });
});
