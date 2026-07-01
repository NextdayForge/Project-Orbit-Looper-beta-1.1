import { useCallback } from 'react';
import { userModelRepository } from '../repositories';
import { PlannerContext, toPlannerContext } from '../types/userModel';
import { DayPlan } from '../types/dayPlan';
import { AppSettings } from '../types/schedule';
import { Task } from '../types/task';
import { coachService } from '../intelligence/coach/CoachService';
import { isGeminiConfigured } from '../infrastructure/gemini/resolveGeminiConfig';
import {
  ApplyCoachScheduleDeps,
  CoachReply,
  CoachScheduleAction,
  CoachTurn,
} from '../intelligence/coach/types';

/**
 * UI hook for the AI coach. Loads UserModel context and supports schedule actions.
 */
export function useCoach(scheduleDeps?: ApplyCoachScheduleDeps, settings?: AppSettings | null) {
  const aiEnabled = isGeminiConfigured(settings ?? undefined);

  const loadContext = useCallback(async (): Promise<PlannerContext> => {
    const userModel = await userModelRepository.get();
    return toPlannerContext(userModel);
  }, []);

  const explain = useCallback(
    async (plan: DayPlan | null, tasks: Task[]): Promise<CoachReply> => {
      const context = await loadContext();
      return coachService.explainDayPlan({ plan, tasks, context });
    },
    [loadContext]
  );

  const consult = useCallback(
    async (
      message: string,
      history: CoachTurn[],
      plan: DayPlan | null,
      tasks: Task[],
      pendingAction?: CoachScheduleAction
    ): Promise<CoachReply> => {
      const context = await loadContext();
      return coachService.consult(
        { message, history, plan, tasks, context },
        pendingAction
      );
    },
    [loadContext]
  );

  const applyScheduleAction = useCallback(
    async (action: CoachScheduleAction) => {
      if (!scheduleDeps) {
        throw new Error('Coach schedule dependencies are not configured');
      }
      return coachService.applyScheduleAction(action, scheduleDeps);
    },
    [scheduleDeps]
  );

  return { aiEnabled, explain, consult, applyScheduleAction };
}
