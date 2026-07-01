/**
 * Presentation gateway for Planner actions.
 * CalendarView must not reference Planner types or repositories directly.
 */

export type ApplyDayPlanResult = 'applied' | 'skipped_empty';

export interface PlanApplyOutcome {
  result: ApplyDayPlanResult;
  rolledTomorrowTitles: string[];
  bumpedTomorrowTitles: string[];
  carriedFromPastTitles: string[];
}

export interface GenerateDayPlanOptions {
  taskIds?: string[];
}

export interface PlannerGateway {
  generateDayPlan(date?: Date, options?: GenerateDayPlanOptions): Promise<PlanApplyOutcome>;
  runMiddayAdjustment(date?: Date): Promise<PlanApplyOutcome>;
}

export async function runForceReschedule(
  date: Date,
  gateway: PlannerGateway
): Promise<PlanApplyOutcome> {
  return gateway.generateDayPlan(date);
}

export async function runShiftFromNow(
  date: Date,
  gateway: PlannerGateway
): Promise<PlanApplyOutcome> {
  return gateway.runMiddayAdjustment(date);
}

export async function runAiDayPlan(
  date: Date,
  gateway: PlannerGateway,
  options?: GenerateDayPlanOptions
): Promise<PlanApplyOutcome> {
  return gateway.generateDayPlan(date, options);
}
