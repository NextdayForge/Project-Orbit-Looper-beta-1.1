import { plannerEvaluationService } from '../intelligence/planner/PlannerEvaluationService';
import { DayPlan } from '../types/dayPlan';
import { makeCapacity, makeSession } from './fixtures';

function makeDayPlan(sessions: DayPlan['sessions']): DayPlan {
  return {
    date: '2026-06-28',
    dayType: 'NORMAL',
    capacity: makeCapacity(),
    sessions,
    calendarBlocks: [],
    reasonTags: [],
    generatedAt: '2026-06-28T00:00:00.000Z',
  };
}

describe('PlannerEvaluationService', () => {
  it('excludes a deleted (archived+incomplete) session from placement success entirely', () => {
    const kept = makeSession({ status: 'planned' });
    const deleted = makeSession({ status: 'cancelled' });
    const dayPlan = makeDayPlan([kept, deleted]);

    const result = plannerEvaluationService.evaluate({
      dayPlan,
      actualSessions: [kept, { ...deleted, archived: true }],
      aiDecisionLogs: [],
    });

    expect(result.sampleCounts.plannedSessions).toBe(1);
    expect(result.sampleCounts.placementSuccessful).toBe(1);
    expect(result.placementSuccessRate).toBe(1);
  });

  it('still counts a rescheduled session as a placement failure', () => {
    const kept = makeSession({ status: 'planned' });
    const rescheduled = makeSession({ status: 'planned' });
    const dayPlan = makeDayPlan([kept, rescheduled]);

    const result = plannerEvaluationService.evaluate({
      dayPlan,
      actualSessions: [kept, { ...rescheduled, status: 'rescheduled' }],
      aiDecisionLogs: [],
    });

    expect(result.sampleCounts.plannedSessions).toBe(2);
    expect(result.sampleCounts.placementSuccessful).toBe(1);
    expect(result.placementSuccessRate).toBe(0.5);
  });
});
