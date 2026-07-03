export type {
  CalendarDisplayEvent,
  CalendarDisplaySource,
  CalendarEntityType,
  EditableCalendarEvent,
  EditableCalendarEventInput,
} from './CalendarDisplayEvent';

export type { CalendarViewModel } from './CalendarViewAdapter';

export type {
  CalendarEditorGateway,
  CreateCalendarBlockPayload,
  CreateSessionPayload,
  CreateTaskPayload,
} from './CalendarEditorAdapter';

export type { CalendarDragGateway, DragMode, DragPreview } from './CalendarDragAdapter';

export type {
  PlannerGateway,
  GenerateDayPlanOptions,
  ApplyDayPlanResult,
  PlanApplyOutcome,
} from './CalendarPlannerAdapter';

export { runAiDayPlan, runForceReschedule, runShiftFromNow } from './CalendarPlannerAdapter';

export { resolveAiTaskInputs, normalizeTaskTitle } from './resolveAiTasks';
export type { ResolveAiTaskInputsResult } from './resolveAiTasks';

export { syncTasksAfterDayPlan } from './syncTasksAfterDayPlan';

export { buildRolloverNotice, runPlacementWithRollover, getUnplacedTaskIds } from './placementRollover';

export { resolveBedtimeHint } from './bedtimeHint';

export {
  beginDrag,
  cancel,
  commit,
  getActiveDragPreview,
  move,
  resize,
} from './CalendarDragAdapter';

export {
  buildCalendarViewModel,
  buildDisplayEventCountByDate,
  buildDomainDisplayEvents,
  filterDisplayEventsByDate,
} from './CalendarViewAdapter';

export {
  applyDelete,
  applyEdit,
  buildEditableFromInput,
  createEntityFromInput,
  createNewEditableDraft,
  toEditableModel,
  toggleCompleted,
} from './CalendarEditorAdapter';
