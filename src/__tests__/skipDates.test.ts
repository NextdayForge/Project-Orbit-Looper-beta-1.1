import {
  expandDateRange,
  formatSkipEntryLabel,
  mergeSkipDateKeys,
  mergeSkipDatesForDisplay,
  removeSkipDateRange,
} from '../utils/skipDates';

describe('skipDates', () => {
  it('expands an inclusive date range', () => {
    expect(expandDateRange('2026-06-28', '2026-06-30')).toEqual([
      '2026-06-28',
      '2026-06-29',
      '2026-06-30',
    ]);
  });

  it('expands reversed range inputs', () => {
    expect(expandDateRange('2026-07-12', '2026-06-28')).toEqual([
      '2026-06-28',
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ]);
  });

  it('merges contiguous skip dates into ranges for display', () => {
    const entries = mergeSkipDatesForDisplay([
      '2026-06-28',
      '2026-06-29',
      '2026-07-01',
      '2026-07-02',
      '2026-07-12',
    ]);

    expect(entries).toEqual([
      { kind: 'range', start: '2026-06-28', end: '2026-06-29' },
      { kind: 'range', start: '2026-07-01', end: '2026-07-02' },
      { kind: 'single', date: '2026-07-12' },
    ]);
    expect(formatSkipEntryLabel(entries[0])).toBe('6/28〜6/29');
  });

  it('adds and removes skip date ranges without duplicates', () => {
    const merged = mergeSkipDateKeys(['2026-06-28'], expandDateRange('2026-06-28', '2026-06-30'));
    expect(merged).toEqual(['2026-06-28', '2026-06-29', '2026-06-30']);

    const removed = removeSkipDateRange(merged, '2026-06-29', '2026-06-30');
    expect(removed).toEqual(['2026-06-28']);
  });
});
