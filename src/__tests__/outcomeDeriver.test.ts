import { deriveOutcome } from '../intelligence/outcome/OutcomeDeriver';
import { makeSession } from './fixtures';

describe('OutcomeDeriver.deriveOutcome', () => {
  it('marks timerUsed true when actualStart and actualEnd are recorded', () => {
    const session = makeSession({
      status: 'completed',
      completedAt: '2026-06-28T10:00:00.000Z',
      actualStart: '2026-06-28T09:00:00.000Z',
      actualEnd: '2026-06-28T09:45:00.000Z',
    });

    const outcome = deriveOutcome(session);
    expect(outcome.timerUsed).toBe(true);
    expect(outcome.actualMinutes).toBeCloseTo(45);
  });

  it('marks timerUsed true when actualStart and completedAt are recorded (no actualEnd)', () => {
    const session = makeSession({
      status: 'completed',
      actualStart: '2026-06-28T09:00:00.000Z',
      completedAt: '2026-06-28T09:30:00.000Z',
    });

    const outcome = deriveOutcome(session);
    expect(outcome.timerUsed).toBe(true);
    expect(outcome.actualMinutes).toBeCloseTo(30);
  });

  it('marks timerUsed false and reports a perfect-looking outcome for manual completion without timer data', () => {
    const session = makeSession({
      status: 'completed',
      completedAt: '2026-06-28T09:45:00.000Z',
      estimatedMinutes: 45,
    });

    const outcome = deriveOutcome(session);
    expect(outcome.timerUsed).toBe(false);
    expect(outcome.estimationRatio).toBeCloseTo(1);
    expect(outcome.focusScore).toBe(1);
    expect(outcome.startedLate).toBe(false);
  });

  it('marks timerUsed false when actualStart is missing even if actualEnd is present', () => {
    const session = makeSession({
      status: 'completed',
      completedAt: '2026-06-28T09:45:00.000Z',
      actualEnd: '2026-06-28T09:45:00.000Z',
    });

    const outcome = deriveOutcome(session);
    expect(outcome.timerUsed).toBe(false);
  });
});
