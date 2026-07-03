import { resolveBedtimeHint } from '../presentation/calendar/bedtimeHint';

describe('resolveBedtimeHint', () => {
  const settings = { sleepMinutes: 23 * 60 };

  it('returns a hint when the schedule date is today and the current time is past bedtime', () => {
    const now = new Date(2026, 5, 28, 23, 37);
    const scheduleDate = new Date(2026, 5, 28, 10, 0);

    const hint = resolveBedtimeHint(settings, scheduleDate, now);

    expect(hint).toContain('23:00');
    expect(hint).toContain('就寝時刻');
  });

  it('returns null when the current time is still before bedtime', () => {
    const now = new Date(2026, 5, 28, 20, 0);
    const scheduleDate = new Date(2026, 5, 28, 10, 0);

    expect(resolveBedtimeHint(settings, scheduleDate, now)).toBeNull();
  });

  it('returns null when the schedule date is not today (e.g. planning tomorrow)', () => {
    const now = new Date(2026, 5, 28, 23, 37);
    const scheduleDate = new Date(2026, 5, 29, 10, 0);

    expect(resolveBedtimeHint(settings, scheduleDate, now)).toBeNull();
  });

  it('treats the exact bedtime minute as already past bedtime', () => {
    const now = new Date(2026, 5, 28, 23, 0);
    const scheduleDate = new Date(2026, 5, 28, 10, 0);

    expect(resolveBedtimeHint(settings, scheduleDate, now)).not.toBeNull();
  });
});
