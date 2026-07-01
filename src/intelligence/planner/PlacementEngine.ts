import { CalendarBlock } from '../../types/calendarBlock';
import { Task } from '../../types/task';
import { PlannerContext } from '../../types/userModel';
import { LocalPlacementStrategy } from './LocalPlacementStrategy';
import { PlacementStrategy } from './PlacementStrategy';
import { CapacityPlan, PlacementOptions, PlacementResult } from './types';

/**
 * Thin wrapper over PlacementStrategy.
 * PlacementEngine must not call legacy schedulers directly.
 *
 * Default: LocalPlacementStrategy only (.cursorrules Sprint 5 — Gemini is not used for placement).
 * Override: new PlacementEngine(new GeminiPlacementStrategy()) for experiments.
 */
export class PlacementEngine {
  private readonly strategy: PlacementStrategy;

  constructor(strategy?: PlacementStrategy) {
    this.strategy = strategy ?? new LocalPlacementStrategy();
  }

  place(
    context: PlannerContext,
    capacity: CapacityPlan,
    tasks: Task[],
    blocks: CalendarBlock[],
    date: string,
    options?: PlacementOptions
  ): Promise<PlacementResult> {
    return Promise.resolve(
      this.strategy.place({
        context,
        capacity,
        tasks,
        blocks,
        date,
        cursorStartMinutes: options?.cursorStartMinutes,
        anchoredSessions: options?.anchoredSessions,
        dayStartMinutes: options?.dayStartMinutes,
        dayEndMinutes: options?.dayEndMinutes,
      })
    );
  }
}

export const placementEngine = new PlacementEngine();

export async function place(
  context: PlannerContext,
  capacity: CapacityPlan,
  tasks: Task[],
  blocks: CalendarBlock[],
  date: string,
  options?: PlacementOptions
): Promise<PlacementResult> {
  return placementEngine.place(context, capacity, tasks, blocks, date, options);
}
