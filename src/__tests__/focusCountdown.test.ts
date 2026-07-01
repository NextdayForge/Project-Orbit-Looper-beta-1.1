import {
  buildCountdownSlots,
  layoutMetrics,
  resolveCountdownLayout,
} from '../focus/focusCountdown';

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
