import { Session, SessionOutcome, plannedDurationMinutes } from '../../types/session';

const LATE_START_THRESHOLD_MINUTES = 5;
const FOCUS_PENALTY_PER_PAUSE = 0.1;
const FOCUS_PENALTY_LATE_START = 0.1;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function plannedStartDate(session: Session): Date {
  const [year, month, day] = session.date.split('-').map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  date.setHours(Math.floor(session.startMinutes / 60), session.startMinutes % 60, 0, 0);
  return date;
}

function resolveActualMinutes(session: Session): number {
  if (session.actualStart && session.actualEnd) {
    const diffMs = new Date(session.actualEnd).getTime() - new Date(session.actualStart).getTime();
    return Math.max(0, diffMs / 60_000);
  }
  if (session.actualStart && session.completedAt) {
    const diffMs = new Date(session.completedAt).getTime() - new Date(session.actualStart).getTime();
    return Math.max(0, diffMs / 60_000);
  }
  return plannedDurationMinutes(session);
}

function resolveStartedLate(session: Session): boolean {
  if (!session.actualStart) return false;
  const plannedStart = plannedStartDate(session).getTime();
  const actualStart = new Date(session.actualStart).getTime();
  return actualStart > plannedStart + LATE_START_THRESHOLD_MINUTES * 60_000;
}

function resolveFocusScore(session: Session, startedLate: boolean): number {
  let score = 1.0;
  score -= session.pauseCount * FOCUS_PENALTY_PER_PAUSE;
  if (startedLate) score -= FOCUS_PENALTY_LATE_START;
  return clamp(score, 0, 1);
}

/**
 * Derives execution outcome from a completed Session.
 * Caller must ensure status === 'completed' and completedAt is set.
 */
export function deriveOutcome(session: Session): SessionOutcome {
  const estimatedMinutes = session.estimatedMinutes;
  const actualMinutes = resolveActualMinutes(session);
  const startedLate = resolveStartedLate(session);
  const interrupted = session.pauseCount > 0;

  return {
    estimatedMinutes,
    actualMinutes,
    completed: session.status === 'completed',
    estimationRatio: estimatedMinutes > 0 ? actualMinutes / estimatedMinutes : 0,
    startedLate,
    interrupted,
    focusScore: resolveFocusScore(session, startedLate),
  };
}

export function shouldDeriveOutcome(session: Session): boolean {
  return session.status === 'completed' && Boolean(session.completedAt);
}
