import { Session, isMutableScheduleSession, isSessionCompleted } from '../../types/session';
import { generateId, snapToMinutes } from '../../utils/time';

function isMutableForShift(session: Session): boolean {
  return isMutableScheduleSession(session) && !isSessionCompleted(session);
}

function sortByStartMinutes(sessions: Session[]): Session[] {
  return [...sessions].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id)
  );
}

export interface ShiftFromNowResult {
  sessions: Session[];
  replanTaskIds: string[];
}

/**
 * Moves every incomplete session on the date to start at nowMinutes (sequential).
 * Completed sessions keep their original times.
 */
export function shiftIncompleteSessionsFromNow(
  date: string,
  sourceSessions: Session[],
  nowMinutes: number,
  gapMinutes = 5
): ShiftFromNowResult {
  const completedSessions = sourceSessions.filter(
    (session) =>
      session.date === date &&
      session.status !== 'rescheduled' &&
      isSessionCompleted(session)
  );

  const toShift = sortByStartMinutes(
    sourceSessions.filter(
      (session) =>
        session.date === date &&
        isMutableForShift(session)
    )
  );

  const nowIso = new Date().toISOString();
  let cursor = snapToMinutes(nowMinutes, 5);
  const rescheduledHistory: Session[] = [];
  const shifted: Session[] = [];

  for (const session of toShift) {
    const duration = Math.max(
      5,
      snapToMinutes(session.endMinutes - session.startMinutes, 5)
    );

    // Preserve original session as learning history — never delete.
    rescheduledHistory.push({
      ...session,
      status: 'rescheduled',
      rescheduledAt: nowIso,
    });

    shifted.push({
      ...session,
      id: generateId(),
      startMinutes: cursor,
      endMinutes: cursor + duration,
      estimatedMinutes: duration,
      status: 'planned',
      rescheduledAt: null,
      completed: false,
      completedAt: null,
      outcome: null,
    });

    cursor += duration + Math.max(0, gapMinutes);
  }

  const replanTaskIds = [
    ...new Set(
      toShift
        .map((session) => session.taskId)
        .filter((taskId): taskId is string => Boolean(taskId))
    ),
  ];

  return {
    sessions: sortByStartMinutes([...completedSessions, ...rescheduledHistory, ...shifted]),
    replanTaskIds,
  };
}

/**
 * Reassigns session start times sequentially from nowMinutes.
 * Preserves input order (e.g. planner priority) unlike shiftIncompleteSessionsFromNow.
 */
export function enforceSequentialFromNow(
  sessions: Session[],
  nowMinutes: number,
  gapMinutes = 5
): Session[] {
  let cursor = snapToMinutes(nowMinutes, 5);

  return sessions.map((session) => {
    const duration = Math.max(
      5,
      snapToMinutes(session.endMinutes - session.startMinutes, 5)
    );
    const aligned: Session = {
      ...session,
      startMinutes: cursor,
      endMinutes: cursor + duration,
      estimatedMinutes: duration,
    };
    cursor += duration + Math.max(0, gapMinutes);
    return aligned;
  });
}
