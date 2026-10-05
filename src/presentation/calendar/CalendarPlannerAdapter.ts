/**
 * Presentation gateway for Planner actions.
 * CalendarView must not reference Planner types or repositories directly.
 */

export type ApplyDayPlanResult = 'applied' | 'skipped_empty';

export interface PendingRolloverTask {
  taskId: string;
  title: string;
}

export interface PlanApplyOutcome {
  result: ApplyDayPlanResult;
  carriedFromPastTitles: string[];
  /** Tasks that didn't fit `fromDateKey` and have not been moved anywhere — see placementRollover.ts. */
  pendingRollover: PendingRolloverTask[];
  /** The date `pendingRollover` is pending from (empty string when pendingRollover is empty). */
  fromDateKey: string;
}

export interface GenerateDayPlanOptions {
  taskIds?: string[];
}

export interface PlannerGateway {
  generateDayPlan(date?: Date, options?: GenerateDayPlanOptions): Promise<PlanApplyOutcome>;
  runMiddayAdjustment(date?: Date): Promise<PlanApplyOutcome>;
  /** User-confirmed: places `taskIds` (a prior outcome's `pendingRollover`) on the day after `fromDate`. */
  confirmRollover(fromDate: Date, taskIds: string[]): Promise<PlanApplyOutcome>;
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
