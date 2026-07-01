import {
  CandidateScore,
  CandidateTask,
  ProposalCapacitySummary,
  SelectedCandidate,
} from './types';

const MAX_SELECTED = 5;

interface RankedEntry {
  score: CandidateScore;
  candidate: CandidateTask;
}

function compareRanked(a: RankedEntry, b: RankedEntry): number {
  if (b.score.score !== a.score.score) {
    return b.score.score - a.score.score;
  }

  if (a.candidate.task.priority !== b.candidate.task.priority) {
    return a.candidate.task.priority - b.candidate.task.priority;
  }

  const deadlineA = a.candidate.task.deadline
    ? new Date(a.candidate.task.deadline).getTime()
    : Number.POSITIVE_INFINITY;
  const deadlineB = b.candidate.task.deadline
    ? new Date(b.candidate.task.deadline).getTime()
    : Number.POSITIVE_INFINITY;
  if (deadlineA !== deadlineB) {
    return deadlineA - deadlineB;
  }

  return a.candidate.task.title.localeCompare(b.candidate.task.title, 'ja');
}

/**
 * Picks up to five scored candidates that fit today's remaining capacity.
 * Does not call Gemini — output is the proposal shortlist only.
 */
export function selectProposalCandidates(
  scores: CandidateScore[],
  candidates: CandidateTask[],
  capacity: ProposalCapacitySummary
): SelectedCandidate[] {
  const candidateById = new Map(candidates.map((candidate) => [candidate.taskId, candidate]));

  const ranked: RankedEntry[] = [];
  for (const score of scores) {
    const candidate = candidateById.get(score.taskId);
    if (!candidate) {
      continue;
    }
    ranked.push({ score, candidate });
  }

  ranked.sort(compareRanked);

  const slotLimit = Math.min(MAX_SELECTED, Math.max(0, capacity.remainingSessionSlots));
  if (slotLimit === 0 || capacity.remainingFocusMinutes <= 0) {
    return [];
  }

  const selected: SelectedCandidate[] = [];
  let usedFocusMinutes = 0;

  for (const entry of ranked) {
    if (selected.length >= slotLimit) {
      break;
    }

    const remainingMinutes = entry.candidate.remainingMinutes;
    if (remainingMinutes <= 0) {
      continue;
    }

    if (usedFocusMinutes + remainingMinutes > capacity.remainingFocusMinutes) {
      continue;
    }

    selected.push({
      taskId: entry.candidate.taskId,
      candidate: entry.candidate,
      score: entry.score.score,
      reasons: entry.score.reasons,
      remainingMinutes,
    });
    usedFocusMinutes += remainingMinutes;
  }

  return selected;
}

export { MAX_SELECTED as MAX_PROPOSAL_CANDIDATES };
