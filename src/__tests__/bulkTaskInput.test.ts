import { parseBulkLines } from '../presentation/calendar/bulkTaskInput';

describe('parseBulkLines', () => {
  it('extracts a trailing "45分" duration hint and strips it from the title', () => {
    const tasks = parseBulkLines('数学の課題 45分');
    expect(tasks).toEqual([{ title: '数学の課題', priority: 3, estimatedMinutes: 45 }]);
  });

  it('leaves estimatedMinutes unset when no duration hint is present', () => {
    const tasks = parseBulkLines('プログラミング課題');
    expect(tasks).toEqual([{ title: 'プログラミング課題', priority: 3 }]);
  });

  it('parses duration hints and unset lines independently in a mixed multi-line input', () => {
    const tasks = parseBulkLines('英単語 30分\nプログラミング課題\n買い物 60分');
    expect(tasks).toEqual([
      { title: '英単語', priority: 3, estimatedMinutes: 30 },
      { title: 'プログラミング課題', priority: 3 },
      { title: '買い物', priority: 3, estimatedMinutes: 60 },
    ]);
  });

  it('supports every offered duration option (15/30/45/60/90/120)', () => {
    const tasks = parseBulkLines('A 15分\nB 30分\nC 45分\nD 60分\nE 90分\nF 120分');
    expect(tasks.map((t) => t.estimatedMinutes)).toEqual([15, 30, 45, 60, 90, 120]);
  });

  it('does not treat a number embedded in a longer digit sequence as a duration hint', () => {
    const tasks = parseBulkLines('615分の伝説を読む');
    expect(tasks).toEqual([{ title: '615分の伝説を読む', priority: 3 }]);
  });

  it('deduplicates identical titles after stripping the duration hint', () => {
    const tasks = parseBulkLines('英単語 30分\n英単語');
    expect(tasks).toHaveLength(1);
  });
});
