import { DayPlan } from '../../types/dayPlan';
import { Session, isMutableScheduleSession, isScheduleVisibleSession } from '../../types/session';
import { Task } from '../../types/task';
import { minutesToTime } from '../../utils/time';

export interface ReplanDiffLine {
  title: string;
  fromLabel: string;
  toLabel: string;
}

export interface ReplanProposal {
  summary: string;
  finishByLabel: string | null;
  lines: ReplanDiffLine[];
  shiftedCount: number;
}

function titleForSession(session: Session, tasks: Map<string, Task>): string {
  if (session.taskId && tasks.has(session.taskId)) {
    return tasks.get(session.taskId)!.title;
  }
  return 'セッション';
}

function timeRange(session: Session): string {
  return `${minutesToTime(session.startMinutes)}–${minutesToTime(session.endMinutes)}`;
}

/**
 * Builds a human-readable diff between the current schedule and a shift-from-now proposal.
 */
export function buildReplanProposal(
  tasks: Task[],
  beforeSessions: Session[],
  proposedPlan: DayPlan
): ReplanProposal {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const date = proposedPlan.date;

  const toShift = beforeSessions.filter(
    (session) =>
      session.date === date &&
      isMutableScheduleSession(session) &&
      isScheduleVisibleSession(session)
  );

  const rescheduledIds = new Set(
    proposedPlan.sessions
      .filter((session) => session.date === date && session.status === 'rescheduled')
      .map((session) => session.id)
  );

  const newPlanned = proposedPlan.sessions
    .filter(
      (session) =>
        session.date === date &&
        session.status === 'planned' &&
        session.taskId != null &&
        !rescheduledIds.has(session.id)
    )
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const lines: ReplanDiffLine[] = [];

  for (const oldSession of toShift) {
    const rescheduledInPlan = proposedPlan.sessions.find(
      (session) => session.id === oldSession.id && session.status === 'rescheduled'
    );
    if (!rescheduledInPlan) {
      continue;
    }

    const replacement = newPlanned.find(
      (session) => session.taskId === oldSession.taskId && session.id !== oldSession.id
    );
    if (!replacement) {
      continue;
    }

    lines.push({
      title: titleForSession(oldSession, taskMap),
      fromLabel: timeRange(oldSession),
      toLabel: timeRange(replacement),
    });
  }

  const activeEnd = newPlanned.reduce(
    (max, session) => Math.max(max, session.endMinutes),
    0
  );

  const shiftedCount = lines.length;
  const finishByLabel = activeEnd > 0 ? minutesToTime(activeEnd) : null;

  let summary: string;
  if (shiftedCount === 0) {
    summary = '残りのセッションを、今から無理のない順番に並べ替えます。';
  } else if (finishByLabel) {
    summary = `${shiftedCount}件を並べ替え、${finishByLabel}頃までに終わる見込みです。`;
  } else {
    summary = `${shiftedCount}件を、今から順に並べ替えます。`;
  }

  return { summary, finishByLabel, lines, shiftedCount };
}

/**
 * Builds a human-readable diff between the current schedule and a full AI replan proposal.
 */
export function buildAiReplanProposal(
  tasks: Task[],
  beforeSessions: Session[],
  proposedPlan: DayPlan,
  replanTaskIds: string[]
): ReplanProposal {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const date = proposedPlan.date;
  const replanTaskIdSet = new Set(replanTaskIds);

  const toReplan = beforeSessions
    .filter(
      (session) =>
        session.date === date &&
        session.taskId != null &&
        replanTaskIdSet.has(session.taskId) &&
        isMutableScheduleSession(session) &&
        isScheduleVisibleSession(session)
    )
    .sort((a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id));

  const proposedPlanned = proposedPlan.sessions
    .filter(
      (session) =>
        session.date === date &&
        session.status === 'planned' &&
        session.taskId != null &&
        replanTaskIdSet.has(session.taskId)
    )
    .sort((a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id));

  const usedProposedIds = new Set<string>();
  const lines: ReplanDiffLine[] = [];

  for (const oldSession of toReplan) {
    const replacement = proposedPlanned.find(
      (session) =>
        session.taskId === oldSession.taskId && !usedProposedIds.has(session.id)
    );

    if (replacement) {
      usedProposedIds.add(replacement.id);
      lines.push({
        title: titleForSession(oldSession, taskMap),
        fromLabel: timeRange(oldSession),
        toLabel: timeRange(replacement),
      });
      continue;
    }

    lines.push({
      title: titleForSession(oldSession, taskMap),
      fromLabel: timeRange(oldSession),
      toLabel: '見送り',
    });
  }

  for (const newSession of proposedPlanned) {
    if (usedProposedIds.has(newSession.id)) {
      continue;
    }

    lines.push({
      title: titleForSession(newSession, taskMap),
      fromLabel: '未配置',
      toLabel: timeRange(newSession),
    });
  }

  const activeEnd = proposedPlanned.reduce(
    (max, session) => Math.max(max, session.endMinutes),
    0
  );

  const shiftedCount = lines.length;
  const finishByLabel = activeEnd > 0 ? minutesToTime(activeEnd) : null;

  let summary: string;
  if (shiftedCount === 0) {
    summary = finishByLabel
      ? `AIが今日の予定を見直し、${finishByLabel}頃までに終わる見込みです。`
      : 'AIが今日の予定を見直します。';
  } else if (finishByLabel) {
    summary = `AIが${shiftedCount}件を並べ替え、${finishByLabel}頃までに終わる見込みです。`;
  } else {
    summary = `AIが${shiftedCount}件の予定を並べ替えます。`;
  }

  return { summary, finishByLabel, lines, shiftedCount };
}
