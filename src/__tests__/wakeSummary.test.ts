import { buildTodaySummary } from '../presentation/notifications/wakeSummary';
import { makeSession, makeTask } from './fixtures';

const DATE = '2026-06-28';

describe('buildTodaySummary', () => {
  it('prompts to open the app when there are no sessions today', () => {
    const summary = buildTodaySummary([], [], DATE);
    expect(summary).toContain('今日の予定を準備しましょう');
  });

  it('names the single task when there is exactly one session today', () => {
    const task = makeTask({ id: 'task-1', title: '英単語' });
    const session = makeSession({ taskId: 'task-1', date: DATE, startMinutes: 9 * 60 });

    const summary = buildTodaySummary([session], [task], DATE);
    expect(summary).toContain('英単語');
    expect(summary).toContain('1件');
  });

  it('names the earliest task and counts the rest when there are multiple sessions today', () => {
    const early = makeTask({ id: 'early', title: '英単語' });
    const late = makeTask({ id: 'late', title: '買い物' });
    const earlySession = makeSession({
      taskId: 'early',
      date: DATE,
      startMinutes: 9 * 60,
      endMinutes: 9 * 60 + 30,
    });
    const lateSession = makeSession({
      taskId: 'late',
      date: DATE,
      startMinutes: 16 * 60,
      endMinutes: 16 * 60 + 30,
    });

    const summary = buildTodaySummary([lateSession, earlySession], [early, late], DATE);
    expect(summary).toContain('英単語');
    expect(summary).toContain('2件');
    expect(summary).toContain('他1件');
  });

  it('ignores sessions from other dates', () => {
    const task = makeTask({ id: 'task-1', title: '英単語' });
    const otherDaySession = makeSession({ taskId: 'task-1', date: '2026-06-27' });

    const summary = buildTodaySummary([otherDaySession], [task], DATE);
    expect(summary).toContain('今日の予定を準備しましょう');
  });

  it('ignores completed sessions when counting today\'s remaining plan', () => {
    const task = makeTask({ id: 'task-1', title: '英単語' });
    const completedSession = makeSession({
      taskId: 'task-1',
      date: DATE,
      status: 'completed',
      completed: true,
    });

    const summary = buildTodaySummary([completedSession], [task], DATE);
    expect(summary).toContain('今日の予定を準備しましょう');
  });
});
