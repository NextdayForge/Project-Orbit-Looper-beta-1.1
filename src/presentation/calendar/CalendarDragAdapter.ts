import { CalendarBlock } from '../../types/calendarBlock';
import { Session } from '../../types/session';
import { clampMinutes, snapToMinutes } from '../../utils/time';
import { CalendarDisplayEvent, EditableCalendarEvent } from './CalendarDisplayEvent';
import { toEditableModel } from './CalendarEditorAdapter';

export type DragMode = 'move' | 'resize';

export interface DragPreview {
  displayId: string;
  startMinutes: number;
  endMinutes: number;
}

export interface CalendarDragGateway {
  sessions: Session[];
  calendarBlocks: CalendarBlock[];
  updateSession: (session: Session) => Promise<Session>;
  updateCalendarBlock: (block: CalendarBlock) => Promise<CalendarBlock>;
}

const MIN_DURATION_MINUTES = 5;

interface ActiveDrag {
  editable: EditableCalendarEvent;
  mode: DragMode;
  originStart: number;
  originEnd: number;
  startMinutes: number;
  endMinutes: number;
}

let activeDrag: ActiveDrag | null = null;

function previewFromActive(active: ActiveDrag): DragPreview {
  return {
    displayId: active.editable.displayId,
    startMinutes: active.startMinutes,
    endMinutes: active.endMinutes,
  };
}

export function beginDrag(
  displayEvent: CalendarDisplayEvent,
  mode: DragMode = 'move'
): DragPreview | null {
  if (!displayEvent.editable) {
    return null;
  }

  const editable = toEditableModel(displayEvent);
  activeDrag = {
    editable,
    mode,
    originStart: editable.startMinutes,
    originEnd: editable.endMinutes,
    startMinutes: editable.startMinutes,
    endMinutes: editable.endMinutes,
  };

  return previewFromActive(activeDrag);
}

export function move(deltaMinutes: number): DragPreview | null {
  if (!activeDrag || activeDrag.mode !== 'move') {
    return null;
  }

  const duration = activeDrag.originEnd - activeDrag.originStart;
  let start = clampMinutes(snapToMinutes(activeDrag.originStart + deltaMinutes, 5));
  let end = start + duration;

  if (end > 1440) {
    end = 1440;
    start = Math.max(0, end - duration);
  }

  activeDrag.startMinutes = start;
  activeDrag.endMinutes = end;

  return previewFromActive(activeDrag);
}

export function resize(endMinutes: number): DragPreview | null {
  if (!activeDrag || activeDrag.mode !== 'resize') {
    return null;
  }

  const snappedEnd = clampMinutes(snapToMinutes(endMinutes, 5));
  const minEnd = activeDrag.startMinutes + MIN_DURATION_MINUTES;
  activeDrag.endMinutes = Math.max(minEnd, Math.min(1440, snappedEnd));

  return previewFromActive(activeDrag);
}

export async function commit(gateway: CalendarDragGateway): Promise<void> {
  if (!activeDrag) {
    return;
  }

  const editable: EditableCalendarEvent = {
    ...activeDrag.editable,
    startMinutes: activeDrag.startMinutes,
    endMinutes: activeDrag.endMinutes,
  };

  switch (editable.entityType) {
    case 'session':
      await commitSessionDrag(editable, gateway);
      break;
    case 'calendar_block':
      await commitCalendarBlockDrag(editable, gateway);
      break;
    default:
      break;
  }

  activeDrag = null;
}

export function cancel(): void {
  activeDrag = null;
}

export function getActiveDragPreview(): DragPreview | null {
  return activeDrag ? previewFromActive(activeDrag) : null;
}

async function commitSessionDrag(
  editable: EditableCalendarEvent,
  gateway: CalendarDragGateway
): Promise<void> {
  const session = gateway.sessions.find((item) => item.id === editable.entityId);
  if (!session) {
    return;
  }

  await gateway.updateSession({
    ...session,
    startMinutes: editable.startMinutes,
    endMinutes: editable.endMinutes,
    estimatedMinutes: editable.endMinutes - editable.startMinutes,
  });
}

async function commitCalendarBlockDrag(
  editable: EditableCalendarEvent,
  gateway: CalendarDragGateway
): Promise<void> {
  const block = gateway.calendarBlocks.find((item) => item.id === editable.entityId);
  if (!block) {
    return;
  }

  await gateway.updateCalendarBlock({
    ...block,
    startMinutes: editable.startMinutes,
    endMinutes: editable.endMinutes,
  });
}
