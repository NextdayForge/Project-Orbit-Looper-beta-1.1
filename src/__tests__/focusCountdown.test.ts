import {
  buildCountdownSlots,
  layoutMetrics,
  resolveCountdownLayout,
  resolveRemainingFocusSeconds,
} from '../focus/focusCountdown';

describe('resolveRemainingFocusSeconds', () => {
  const start = '2026-07-04T09:00:00.000Z';
  const startMs = new Date(start).getTime();
  const total = 45 * 60; // 45 min session

  it('shows full duration before focus has started (no actualStart)', () => {
    expect(resolveRemainingFocusSeconds(null, total, startMs)).toBe(total);
    expect(resolveRemainingFocusSeconds(undefined, total, startMs)).toBe(total);
  });

  it('counts down from actualStart, not the scheduled clock time', () => {
    // 10 minutes after focus began → 35 minutes remain
    expect(resolveRemainingFocusSeconds(start, total, startMs + 10 * 60 * 1000)).toBe(35 * 60);
  });

  it('starts immediately: one second after start it is already ticking', () => {
    expect(resolveRemainingFocusSeconds(start, total, startMs + 1000)).toBe(total - 1);
  });

  it('never goes below zero once the duration has elapsed', () => {
    expect(resolveRemainingFocusSeconds(start, total, startMs + 60 * 60 * 1000)).toBe(0);
  });

  it('falls back to full duration for an invalid actualStart', () => {
    expect(resolveRemainingFocusSeconds('not-a-date', total, startMs)).toBe(total);
  });
});

describe('FocusCountdown', () => {
  it('uses mmss layout under one hour', () => {
    expect(resolveCountdownLayout(3599)).toBe('mmss');
    expect(buildCountdownSlots(3599)).toEqual({
      layout: 'mmss',
      slots: ['5', '9', ':', '5', '9'],
    });
  });

  it('switches to hmmss at one hour', () => {
    expect(resolveCountdownLayout(3600)).toBe('hmmss');
    expect(buildCountdownSlots(3600)).toEqual({
      layout: 'hmmss',
      slots: ['1', ':', '0', '0', ':', '0', '0'],
    });
  });

  it('uses hmmss for single-digit hours', () => {
    expect(buildCountdownSlots(5025)).toEqual({
      layout: 'hmmss',
      slots: ['1', ':', '2', '3', ':', '4', '5'],
    });
  });

  it('switches to hhmmss at ten hours', () => {
    expect(resolveCountdownLayout(36000)).toBe('hhmmss');
    expect(buildCountdownSlots(36000)).toEqual({
      layout: 'hhmmss',
      slots: ['1', '0', ':', '0', '0', ':', '0', '0'],
    });
  });

  it('sizes slots so digits fit without overlapping', () => {
    (['mmss', 'hmmss', 'hhmmss'] as const).forEach((layout) => {
      const metrics = layoutMetrics(layout);
      expect(metrics.fontSize).toBeLessThanOrEqual(metrics.digitSlotWidth);
      expect(metrics.rowWidth).toBeLessThanOrEqual(228);
    });

    expect(layoutMetrics('mmss').fontSize).toBe(46);
    expect(layoutMetrics('hmmss').fontSize).toBe(36);
    expect(layoutMetrics('hhmmss').fontSize).toBe(30);
  });
});
