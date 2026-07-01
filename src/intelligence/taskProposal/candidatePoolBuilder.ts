import { isMutableScheduleSession } from '../../types/session';
import { Task, TaskStatus } from '../../types/task';
import { CandidateTask, CandidateTaskSource, ProposalContext } from './types';

const EXCLUDED_STATUSES = new Set<TaskStatus>(['done', 'cancelled']);

const SOURCE_ORDER: Record<CandidateTaskSource, number> = {
  carry_over: 0,
  today_unfinished: 1,
  inbox: 2,
  ready: 3,
};

function isEligibleTask(task: Task, remainingMinutes: number): boolean {
  return !EXCLUDED_STATUSES.has(task.status) && remainingMinutes > 0;
}

function todayUnfinishedTaskIds(context: ProposalContext): Set<string> {
  const ids = new Set<string>();

  for (const session of context.todaySessions) {
    if (session.taskId != null && isMutableScheduleSession(session)) {
      ids.add(session.taskId);
    }
  }

  return ids;
}

function resolveSource(
  task: Task,
  carryOverIds: Set<string>,
  todayUnfinishedIds: Set<string>
): CandidateTaskSource | null {
  if (carryOverIds.has(task.id)) {
    return 'carry_over';
  }

  if (todayUnfinishedIds.has(task.id)) {
    return 'today_unfinished';
  }

  if (task.status === 'inbox') {
    return 'inbox';
  }

  if (task.status === 'ready' || task.status === 'scheduled') {
    return 'ready';
  }

  return null;
}

function compareCandidates(a: CandidateTask, b: CandidateTask): number {
  const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
  if (sourceDiff !== 0) {
    return sourceDiff;
  }

  if (a.task.priority !== b.task.priority) {
    return a.task.priority - b.task.priority;
  }

  const deadlineA = a.task.deadline ? new Date(a.task.deadline).getTime() : Number.POSITIVE_INFINITY;
  const deadlineB = b.task.deadline ? new Date(b.task.deadline).getTime() : Number.POSITIVE_INFINITY;
  if (deadlineA !== deadlineB) {
    return deadlineA - deadlineB;
  }

  return a.task.title.localeCompare(b.task.title, 'ja');
}

/**
 * Extracts and labels today's proposal task pool from ProposalContext.
 * Scoring is not applied — only eligibility and source classification.
 */
export function buildCandidatePool(context: ProposalContext): CandidateTask[] {
  const carryOverIds = new Set(context.carryOverTaskIds);
  const todayUnfinishedIds = todayUnfinishedTaskIds(context);
  const pool: CandidateTask[] = [];
  const seen = new Set<string>();

  for (const task of context.candidateTasks) {
    if (seen.has(task.id)) {
      continue;
    }

    const remainingMinutes = task.estimatedMinutes;
    if (!isEligibleTask(task, remainingMinutes)) {
      continue;
    }

    const source = resolveSource(task, carryOverIds, todayUnfinishedIds);
    if (!source) {
      continue;
    }

    seen.add(task.id);
    pool.push({
      taskId: task.id,
      task,
      source,
      remainingMinutes,
    });
  }

  return pool.sort(compareCandidates);
}
