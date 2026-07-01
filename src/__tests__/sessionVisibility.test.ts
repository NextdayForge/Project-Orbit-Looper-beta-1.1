import {
  isDayProgressSession,
  isInactiveScheduleSession,
  isMutableScheduleSession,
  isScheduleVisibleSession,
} from '../types/session';
import { makeSession } from './fixtures';

describe('session visibility helpers', () => {
  it('hides rescheduled, cancelled, skipped, and archived from schedule display', () => {
    expect(isScheduleVisibleSession(makeSession())).toBe(true);
    expect(isScheduleVisibleSession(makeSession({ status: 'rescheduled' }))).toBe(false);
    expect(isScheduleVisibleSession(makeSession({ status: 'cancelled' }))).toBe(false);
    expect(isScheduleVisibleSession(makeSession({ status: 'skipped' }))).toBe(false);
    expect(isScheduleVisibleSession(makeSession({ archived: true }))).toBe(false);
  });

  it('counts archived completed sessions in day progress', () => {
    const archivedDone = makeSession({ status: 'completed', completed: true, archived: true });
    expect(isDayProgressSession(archivedDone)).toBe(true);
    expect(isScheduleVisibleSession(archivedDone)).toBe(false);
  });

  it('treats rescheduled and archived as inactive for task completion', () => {
    expect(isInactiveScheduleSession(makeSession({ status: 'rescheduled' }))).toBe(true);
    expect(isInactiveScheduleSession(makeSession({ archived: true, status: 'planned' }))).toBe(true);
    expect(isInactiveScheduleSession(makeSession({ status: 'planned' }))).toBe(false);
  });

  it('excludes rescheduled from mutable schedule', () => {
    expect(isMutableScheduleSession(makeSession({ status: 'planned' }))).toBe(true);
    expect(isMutableScheduleSession(makeSession({ status: 'rescheduled' }))).toBe(false);
    expect(isMutableScheduleSession(makeSession({ archived: true }))).toBe(false);
  });
});
