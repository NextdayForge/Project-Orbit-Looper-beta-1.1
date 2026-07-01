import { EventColor, TaskPriority } from '../../types/schedule';

export type CalendarEntityType = 'session' | 'calendar_block';

export type CalendarDisplaySource = 'session' | 'calendar_block';

/**
 * CalendarView display model.
 * Not a domain entity — derived from Session or CalendarBlock.
 */
export interface CalendarDisplayEvent {
  id: string;
  date: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  color: EventColor;
  note?: string;
  completed: boolean;
  priority?: TaskPriority;
  locked?: boolean;
  isAuxiliary?: boolean;
  source: CalendarDisplaySource;
  sourceId: string;
  entityType: CalendarEntityType;
  entityId: string;
  editable: boolean;
  deletable: boolean;
  isNew: boolean;
}

export interface EditableCalendarEvent {
  displayId: string;
  entityType: CalendarEntityType;
  entityId: string;
  date: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  color: EventColor;
  note?: string;
  priority?: TaskPriority;
  locked?: boolean;
  editable: boolean;
  deletable: boolean;
  isNew: boolean;
}

export type EditableCalendarEventInput = Pick<
  EditableCalendarEvent,
  'date' | 'title' | 'startMinutes' | 'endMinutes' | 'color' | 'note' | 'priority' | 'locked'
>;
