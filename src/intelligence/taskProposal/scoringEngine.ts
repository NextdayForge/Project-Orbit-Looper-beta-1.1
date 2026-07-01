import { parseDateKey, toDateKey } from '../../utils/time';
import { CandidateScore, CandidateTask, ProposalContext, ScoreReason } from './types';

const URGENT_DEADLINE_MS = 24 * 60 * 60 * 1000;

const SCORE_BY_REASON: Record<ScoreReason, number> = {
  carry_over: 30,
  deadline_today: 40,
  deadline_within_24h: 25,
  priority_1: 20,
  priority_2: 12,
};

function deadlineDateKey(deadline: string): string | null {
  const parsed = new Date(deadline);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return toDateKey(parsed);
}

function isDeadlineToday(task: CandidateTask['task'], dateKey: string): boolean {
  if (!task.deadline) {
    return false;
  }
  return deadlineDateKey(task.deadline) === dateKey;
}

function isDeadlineWithin24Hours(task: CandidateTask['task'], dateKey: string): boolean {
  if (!task.deadline) {
    return false;
  }

  const deadlineMs = new Date(task.deadline).getTime();
  if (!Number.isFinite(deadlineMs)) {
    return false;
  }

  const dayStartMs = parseDateKey(dateKey).getTime();
  const windowEndMs = dayStartMs + URGENT_DEADLINE_MS;

  return deadlineMs >= dayStartMs && deadlineMs < windowEndMs;
}

function collectReasons(candidate: CandidateTask, context: ProposalContext): ScoreReason[] {
  const reasons: ScoreReason[] = [];
  const { task } = candidate;

  if (candidate.source === 'carry_over' || context.carryOverTaskIds.includes(task.id)) {
    reasons.push('carry_over');
  }

  if (isDeadlineToday(task, context.dateKey)) {
    reasons.push('deadline_today');
  }

  if (isDeadlineWithin24Hours(task, context.dateKey)) {
    reasons.push('deadline_within_24h');
  }

  if (task.priority === 1) {
    reasons.push('priority_1');
  } else if (task.priority === 2) {
    reasons.push('priority_2');
  }

  return reasons;
}

/**
 * Rule-based score for a single candidate (no Reflection / UserModel).
 */
export function scoreCandidate(
  candidate: CandidateTask,
  context: ProposalContext
): CandidateScore {
  const reasons = collectReasons(candidate, context);
  const score = reasons.reduce((sum, reason) => sum + SCORE_BY_REASON[reason], 0);

  return {
    taskId: candidate.taskId,
    score,
    reasons,
  };
}

/** Scores every candidate in pool order. */
export function scoreCandidatePool(
  candidates: CandidateTask[],
  context: ProposalContext
): CandidateScore[] {
  return candidates.map((candidate) => scoreCandidate(candidate, context));
}

export { SCORE_BY_REASON };
