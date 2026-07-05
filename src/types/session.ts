export type SessionStatus =
  | 'planned'
  | 'active'
  | 'completed'
  | 'skipped'
  | 'cancelled'
  | 'rescheduled';

export interface SessionOutcome {
  estimatedMinutes: number;
  actualMinutes: number;
  completed: boolean;
  estimationRatio: number;
  startedLate: boolean;
  interrupted: boolean;
  focusScore: number;
  /** True when derived from actual timer usage (actualStart + actualEnd/completedAt). */
  timerUsed: boolean;
}

export interface Session {
  id: string;
  taskId: string | null;
  date: string;
  startMinutes: number;
  endMinutes: number;
  estimatedMinutes: number;
  actualStart?: string | null;
  actualEnd?: string | null;
  completedAt?: string | null;
  rescheduledAt?: string | null;
  pauseCount: number;
  status: SessionStatus;
  outcome?: SessionOutcome | null;
  aiGenerated: boolean;
  completed: boolean;
  reasonTags: string[];
  /** Hidden from calendar/timeline; retained for progress and learning. */
  archived?: boolean;
}

export function plannedDurationMinutes(session: Pick<Session, 'startMinutes' | 'endMinutes'>): number {
  return session.endMinutes - session.startMinutes;
}

/** Sessions kept for history after midday adjustment; excluded from placement. */
export function isActivePlacementSession(session: Session): boolean {
  return session.status !== 'rescheduled';
}

export function isSessionCompleted(session: Session): boolean {
  return session.completed || session.status === 'completed';
}

/** Shown on Today timeline and calendar (active schedule). */
export function isScheduleVisibleSession(session: Session): boolean {
  return (
    !session.archived &&
    session.status !== 'rescheduled' &&
    session.status !== 'cancelled' &&
    session.status !== 'skipped'
  );
}

/**
 * Counted in Today progress / completion-rate stats (Today, Insights, learning
 * pipeline). Includes archived *completed* sessions (history kept after tidy-up),
 * but excludes archived *incomplete* sessions — those are user-deleted tasks
 * (see `useScheduleActions.deleteTask`/`deleteSession`), not real unfinished work.
 * Counting a deleted task here would permanently drag down completion rates,
 * since it can never become "done".
 */
export function isDayProgressSession(session: Session): boolean {
  if (session.status === 'rescheduled') {
    return false;
  }
  if (session.archived && !isSessionCompleted(session)) {
    return false;
  }
  return true;
}

/** Incomplete sessions that can still be planned, focused, or shifted. */
export function isMutableScheduleSession(session: Session): boolean {
  return (
    isScheduleVisibleSession(session) &&
    !isSessionCompleted(session) &&
    session.status !== 'cancelled'
  );
}

/** Terminal session states that should not block task completion. */
export function isInactiveScheduleSession(session: Session): boolean {
  return (
    isSessionCompleted(session) ||
    session.status === 'cancelled' ||
    session.status === 'skipped' ||
    session.status === 'rescheduled' ||
    Boolean(session.archived)
  );
}
