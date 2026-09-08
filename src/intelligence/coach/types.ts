import { DayPlan } from '../../types/dayPlan';
import { Task } from '../../types/task';
import { PlannerGateway } from '../../presentation/calendar/CalendarPlannerAdapter';
import { CalendarEditorGateway } from '../../presentation/calendar/CalendarEditorAdapter';
import { TaskPriority } from '../../types/schedule';
import { PlannerContext } from '../../types/userModel';

export type CoachReplySource = 'gemini' | 'local';

export interface CoachProposedTask {
  title: string;
  priority?: TaskPriority;
  estimatedMinutes?: number;
  note?: string;
}

/** A request for a fixed, user-anchored time slot (CalendarBlock), not a Task. */
export interface CoachProposedFixedEvent {
  title: string;
  startMinutes: number;
  endMinutes: number;
}

export interface CoachScheduleTasksAction {
  kind: 'schedule_tasks';
  tasks: CoachProposedTask[];
  autoApply?: boolean;
  summary?: string;
}

export interface CoachScheduleFixedEventsAction {
  kind: 'schedule_fixed_events';
  events: CoachProposedFixedEvent[];
  autoApply?: boolean;
  summary?: string;
}

export type CoachScheduleAction = CoachScheduleTasksAction | CoachScheduleFixedEventsAction;

export interface CoachReply {
  text: string;
  source: CoachReplySource;
  action?: CoachScheduleAction;
}

export interface CoachTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface CoachContextInput {
  plan: DayPlan | null;
  tasks: Task[];
  context: PlannerContext;
}

export interface CoachConsultInput extends CoachContextInput {
  message: string;
  history: CoachTurn[];
}

export interface ApplyCoachScheduleDeps {
  date?: Date;
  defaultDurationMinutes: number;
  editorGateway: Pick<CalendarEditorGateway, 'createTask' | 'updateTask' | 'createCalendarBlock'>;
  plannerGateway: PlannerGateway;
}
