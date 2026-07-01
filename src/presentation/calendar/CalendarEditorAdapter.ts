import { CalendarBlock, CalendarBlockSource, CalendarBlockType } from '../../types/calendarBlock';
import { EventColor, TaskPriority } from '../../types/schedule';
import { Session } from '../../types/session';
import { Task, TaskCategory, TaskStatus } from '../../types/task';
import {
  CalendarDisplayEvent,
  EditableCalendarEvent,
  EditableCalendarEventInput,
} from './CalendarDisplayEvent';
import { taskDurationEstimator } from '../../intelligence/taskEstimate/TaskDurationEstimator';
import { scaleMinutesForEstimation } from '../../intelligence/planner/estimationScale';
import { userModelRepository } from '../../repositories';

export interface CreateTaskPayload {
  title: string;
  description?: string;
  category?: TaskCategory;
  estimatedMinutes: number;
  priority?: TaskPriority;
  deadline?: string;
  status?: TaskStatus;
  splittable?: boolean;
}

export interface CreateSessionPayload {
  taskId?: string | null;
  date: string;
  startMinutes: number;
  endMinutes: number;
  estimatedMinutes?: number;
  status?: Session['status'];
  aiGenerated?: boolean;
  completed?: boolean;
  reasonTags?: string[];
}

export interface CreateCalendarBlockPayload {
  title: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  type: CalendarBlockType;
  locked?: boolean;
  source?: CalendarBlockSource;
  recurring?: boolean;
}

const CATEGORY_COLOR: Record<TaskCategory, EventColor> = {
  study: 'blue',
  work: 'green',
  life: 'orange',
  health: 'teal',
  general: 'purple',
};

const COLOR_CATEGORY: Partial<Record<EventColor, TaskCategory>> = {
  blue: 'study',
  green: 'work',
  orange: 'life',
  teal: 'health',
  purple: 'general',
};

export interface CalendarEditorGateway {
  sessions: Session[];
  calendarBlocks: CalendarBlock[];
  tasks: Task[];
  createTask: (input: CreateTaskPayload) => Promise<Task>;
  createSession: (input: CreateSessionPayload) => Promise<Session>;
  createCalendarBlock: (input: CreateCalendarBlockPayload) => Promise<CalendarBlock>;
  updateSession: (session: Session) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  updateCalendarBlock: (block: CalendarBlock) => Promise<CalendarBlock>;
  deleteCalendarBlock: (id: string) => Promise<void>;
  updateTask: (task: Task) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  toggleSessionCompleted: (sessionId: string) => Promise<void>;
}

export function createNewEditableDraft(
  date: string,
  startMinutes: number,
  endMinutes: number
): EditableCalendarEvent {
  return {
    displayId: 'new',
    entityType: 'session',
    entityId: '',
    date,
    title: '',
    startMinutes,
    endMinutes,
    color: 'blue',
    priority: 3,
    locked: false,
    editable: true,
    deletable: false,
    isNew: true,
  };
}

export function toEditableModel(event: CalendarDisplayEvent): EditableCalendarEvent {
  return {
    displayId: event.id,
    entityType: event.entityType,
    entityId: event.entityId,
    date: event.date,
    title: event.title,
    startMinutes: event.startMinutes,
    endMinutes: event.endMinutes,
    color: event.color,
    note: event.note,
    priority: event.priority,
    locked: event.locked,
    editable: event.editable,
    deletable: event.deletable,
    isNew: event.isNew ?? false,
  };
}

function mergeEditableInput(
  editable: EditableCalendarEvent,
  input: EditableCalendarEventInput
): EditableCalendarEvent {
  return {
    ...editable,
    ...input,
  };
}

export function buildEditableFromInput(
  editable: EditableCalendarEvent,
  input: EditableCalendarEventInput
): EditableCalendarEvent {
  return mergeEditableInput(editable, input);
}

function resolveCreateEntityType(editable: EditableCalendarEvent) {
  if (editable.locked) {
    return 'calendar_block' as const;
  }
  return 'session' as const;
}

async function createSessionEntity(
  editable: EditableCalendarEvent,
  gateway: CalendarEditorGateway,
  defaultDurationMinutes = 30
): Promise<void> {
  const slotMinutes = editable.endMinutes - editable.startMinutes;
  const estimate = await taskDurationEstimator.estimate({
    title: editable.title,
    defaultMinutes: defaultDurationMinutes,
  });
  const userModel = await userModelRepository.get();
  const category = estimate.category || COLOR_CATEGORY[editable.color] || 'general';
  const estimatedMinutes = scaleMinutesForEstimation(
    Math.max(slotMinutes, estimate.estimatedMinutes),
    category,
    userModel.estimationFactor
  );

  const task = await gateway.createTask({
    title: editable.title,
    category,
    estimatedMinutes,
    priority: editable.priority ?? 3,
    status: 'scheduled',
  });

  await gateway.createSession({
    taskId: task.id,
    date: editable.date,
    startMinutes: editable.startMinutes,
    endMinutes: editable.endMinutes,
    estimatedMinutes: slotMinutes,
  });
}

async function createCalendarBlockEntity(
  editable: EditableCalendarEvent,
  gateway: CalendarEditorGateway
): Promise<void> {
  await gateway.createCalendarBlock({
    title: editable.title,
    date: editable.date,
    startMinutes: editable.startMinutes,
    endMinutes: editable.endMinutes,
    type: 'fixed',
    locked: editable.locked ?? true,
    source: 'user',
  });
}

export async function createEntityFromInput(
  editable: EditableCalendarEvent,
  gateway: CalendarEditorGateway,
  defaultDurationMinutes = 30
): Promise<void> {
  if (!editable.isNew) {
    return;
  }

  switch (resolveCreateEntityType(editable)) {
    case 'session':
      await createSessionEntity(editable, gateway, defaultDurationMinutes);
      return;
    case 'calendar_block':
      await createCalendarBlockEntity(editable, gateway);
      return;
    default:
      return;
  }
}

async function applySessionEdit(
  editable: EditableCalendarEvent,
  gateway: CalendarEditorGateway
): Promise<void> {
  const session = gateway.sessions.find((item) => item.id === editable.entityId);
  if (!session) {
    return;
  }

  const updatedSession: Session = {
    ...session,
    date: editable.date,
    startMinutes: editable.startMinutes,
    endMinutes: editable.endMinutes,
    estimatedMinutes: editable.endMinutes - editable.startMinutes,
  };

  await gateway.updateSession(updatedSession);

  if (!session.taskId) {
    return;
  }

  const task = gateway.tasks.find((item) => item.id === session.taskId);
  if (!task) {
    return;
  }

  await gateway.updateTask({
    ...task,
    title: editable.title,
    priority: editable.priority ?? task.priority,
    category: COLOR_CATEGORY[editable.color] ?? task.category,
    updatedAt: new Date().toISOString(),
  });
}

async function applyCalendarBlockEdit(
  editable: EditableCalendarEvent,
  gateway: CalendarEditorGateway
): Promise<void> {
  const block = gateway.calendarBlocks.find((item) => item.id === editable.entityId);
  if (!block) {
    return;
  }

  await gateway.updateCalendarBlock({
    ...block,
    title: editable.title,
    date: editable.date,
    startMinutes: editable.startMinutes,
    endMinutes: editable.endMinutes,
    locked: editable.locked ?? block.locked,
  });
}

export async function applyEdit(
  editable: EditableCalendarEvent,
  gateway: CalendarEditorGateway
): Promise<void> {
  if (!editable.editable || editable.isNew) {
    return;
  }

  switch (editable.entityType) {
    case 'session':
      await applySessionEdit(editable, gateway);
      return;
    case 'calendar_block':
      await applyCalendarBlockEdit(editable, gateway);
      return;
    default:
      return;
  }
}

export async function applyDelete(
  editable: EditableCalendarEvent,
  gateway: CalendarEditorGateway
): Promise<void> {
  if (!editable.deletable || editable.isNew) {
    return;
  }

  switch (editable.entityType) {
    case 'session': {
      const session = gateway.sessions.find((item) => item.id === editable.entityId);
      await gateway.deleteSession(editable.entityId);

      if (session?.taskId) {
        const hasOtherSessions = gateway.sessions.some(
          (item) =>
            item.taskId === session.taskId &&
            item.id !== session.id &&
            item.status !== 'cancelled' &&
            item.status !== 'rescheduled' &&
            !item.archived
        );
        if (!hasOtherSessions) {
          await gateway.deleteTask(session.taskId);
        }
      }
      return;
    }
    case 'calendar_block':
      await gateway.deleteCalendarBlock(editable.entityId);
      return;
    default:
      return;
  }
}

export async function toggleCompleted(
  displayEvent: CalendarDisplayEvent,
  gateway: CalendarEditorGateway
): Promise<void> {
  if (displayEvent.entityType === 'session') {
    await gateway.toggleSessionCompleted(displayEvent.entityId);
  }
}

export { CATEGORY_COLOR };
