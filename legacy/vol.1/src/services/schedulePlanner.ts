import { AiScheduleItem, EventColor, ScheduleEvent, DEFAULT_PRIORITY, TaskPriority } from '../types/schedule';
import { addDays, generateId, parseDateKey, snapToMinutes, timeToMinutes, toDateKey, isValidMinutes, clampMinutes } from '../utils/time';
import { buildOptimizedSchedule, getFreeSlots, ParsedTask } from './scheduleOptimizer';

export { DEFAULT_PRIORITY };

const AUXILIARY_TITLES = new Set(['バッファ（切り替え）', '休憩']);

export function isAuxiliaryEvent(event: ScheduleEvent): boolean {
  return event.isAuxiliary === true || AUXILIARY_TITLES.has(event.title);
}

export function isLockedEvent(event: ScheduleEvent): boolean {
  return event.locked === true;
}

export interface RescheduleResult {
  events: ScheduleEvent[];
  shiftedCount: number;
  overflowCount: number;
  carriedToDates: string[];
  /** 過去日から今日へ移したタスク数 */
  pastShiftedCount?: number;
}

function eventDuration(event: ScheduleEvent): number {
  return event.endMinutes - event.startMinutes;
}

function inferCategoryFromTitle(title: string): string {
  if (/数学|英語|勉強|過去問|微積|理科|国語|社会|課題|宿題/.test(title)) return 'study';
  if (/ベース|ギター|ピアノ|音楽|練習/.test(title)) return 'music';
  if (/運動|ストレッチ|ジム|ランニング|健康/.test(title)) return 'health';
  if (/片付け|掃除|買い物|洗濯|料理/.test(title)) return 'life';
  if (/会議|ミーティング|打ち合わせ|仕事/.test(title)) return 'work';
  if (/パワーナップ|昼寝|ナップ/.test(title)) return 'rest';
  return 'general';
}

export function eventToParsedTask(event: ScheduleEvent): ParsedTask {
  const category =
    event.note && event.note !== 'general' ? event.note : inferCategoryFromTitle(event.title);
  return {
    id: event.id,
    title: event.title,
    minutes: eventDuration(event),
    category,
    type: event.title.includes('パワーナップ') ? 'power_nap' : 'task',
    priority: event.priority ?? DEFAULT_PRIORITY,
    color: event.color,
  };
}

function parseTime(t: string): number {
  return timeToMinutes(t);
}

function itemToEvent(
  item: AiScheduleItem,
  dateKey: string,
  meta: ParsedTask | undefined,
  isAux: boolean
): ScheduleEvent | null {
  let start = parseTime(item.startTime);
  let end = parseTime(item.endTime);
  if (!isValidMinutes(start) && isValidMinutes(end) && item.durationMinutes) {
    start = end - item.durationMinutes;
  }
  if (!isValidMinutes(end) && isValidMinutes(start) && item.durationMinutes) {
    end = start + item.durationMinutes;
  }
  if (!isValidMinutes(start) || !isValidMinutes(end) || end <= start) return null;

  return {
    id: meta?.id ?? generateId(),
    date: dateKey,
    title: item.title,
    startMinutes: start,
    endMinutes: end,
    color: (isAux ? 'teal' : meta?.color ?? 'blue') as EventColor,
    priority: meta?.priority ?? item.priority ?? DEFAULT_PRIORITY,
    note: isAux ? item.category : meta?.category !== 'general' ? meta?.category : undefined,
    isAuxiliary: isAux,
    completed: false,
  };
}

function resolveTaskMeta(
  item: AiScheduleItem,
  parsedTasks: ParsedTask[],
  usedIds: Set<string>
): ParsedTask | undefined {
  if (item.sourceTaskId) {
    const byId = parsedTasks.find((t) => t.id === item.sourceTaskId);
    if (byId) return byId;
  }
  const byTitle = parsedTasks.find((t) => t.title === item.title && t.id && !usedIds.has(t.id));
  if (byTitle) return byTitle;
  return parsedTasks.find((t) => t.id && !usedIds.has(t.id));
}

function itemsToEvents(items: AiScheduleItem[], dateKey: string, parsedTasks: ParsedTask[]): ScheduleEvent[] {
  const usedIds = new Set<string>();
  const result: ScheduleEvent[] = [];

  for (const item of items) {
    const isAux = item.type === 'buffer' || item.type === 'break';
    const meta = !isAux ? resolveTaskMeta(item, parsedTasks, usedIds) : undefined;
    if (meta?.id) usedIds.add(meta.id);
    const ev = itemToEvent(item, dateKey, meta, isAux);
    if (ev) result.push(ev);
  }

  return result;
}

function sortByPriorityAndTime(a: ScheduleEvent, b: ScheduleEvent): number {
  const pa = a.priority ?? DEFAULT_PRIORITY;
  const pb = b.priority ?? DEFAULT_PRIORITY;
  if (pa !== pb) return pa - pb;
  return a.startMinutes - b.startMinutes;
}

export function smartPlaceNewTask(
  draft: {
    title: string;
    startMinutes: number;
    endMinutes: number;
    color: EventColor;
    note?: string;
    priority?: TaskPriority;
  },
  dateKey: string,
  allEvents: ScheduleEvent[],
  bufferMinutes: number,
  now = new Date()
): ScheduleEvent[] {
  const duration = draft.endMinutes - draft.startMinutes;
  const taskId = generateId();
  const task: ParsedTask = {
    id: taskId,
    title: draft.title,
    minutes: duration,
    category: draft.note ?? 'general',
    type: 'task',
    priority: draft.priority ?? DEFAULT_PRIORITY,
    color: draft.color,
  };

  const dayExisting = allEvents.filter((e) => e.date === dateKey);
  const anchored = dayExisting.filter((e) => (e.completed || isLockedEvent(e)) && !isAuxiliaryEvent(e));

  const items = buildOptimizedSchedule([task], dateKey, anchored, bufferMinutes, now);
  return itemsToEvents(items, dateKey, [task]);
}

export function rescheduleDay(
  allEvents: ScheduleEvent[],
  dateKey: string,
  bufferMinutes: number,
  now = new Date()
): RescheduleResult {
  const todayKey = toDateKey(now);
  const nowMinutes = snapToMinutes(now.getHours() * 60 + now.getMinutes() + bufferMinutes, 5);

  const otherDays = allEvents.filter((e) => e.date !== dateKey);
  const dayEvents = allEvents.filter((e) => e.date === dateKey);
  const anchoredClean = dayEvents.filter((e) => e.completed || isLockedEvent(e));

  const movable = dayEvents
    .filter((e) => !e.completed && !isLockedEvent(e) && !isAuxiliaryEvent(e))
    .sort(sortByPriorityAndTime);

  const hasOverdue = dateKey === todayKey && movable.some((e) => e.endMinutes <= nowMinutes);

  if (movable.length === 0) {
    return { events: [...otherDays, ...anchoredClean], shiftedCount: 0, overflowCount: 0, carriedToDates: [] };
  }

  if (dateKey === todayKey && !hasOverdue) {
    return { events: allEvents, shiftedCount: 0, overflowCount: 0, carriedToDates: [] };
  }

  const parsedTasks: ParsedTask[] = movable.map((e) => {
    const t = eventToParsedTask(e);
    return { ...t, id: e.id };
  });

  const items = buildOptimizedSchedule(parsedTasks, dateKey, anchoredClean, bufferMinutes, now);
  const placed = itemsToEvents(items, dateKey, parsedTasks);
  const placedTaskCount = placed.filter((e) => !e.isAuxiliary).length;

  if (placedTaskCount === 0 && movable.length > 0) {
    return { events: allEvents, shiftedCount: 0, overflowCount: 0, carriedToDates: [] };
  }

  const placedIds = new Set(placed.filter((e) => !e.isAuxiliary).map((e) => e.id));
  const overflowTasks = parsedTasks.filter((t) => t.id && !placedIds.has(t.id));

  let result = [...otherDays, ...anchoredClean, ...placed];
  const carriedToDates: string[] = [];

  if (overflowTasks.length > 0) {
    const carry = carryOverTasks(result, overflowTasks, dateKey, bufferMinutes, now);
    result = carry.events;
    carriedToDates.push(...carry.dates);
  }

  return {
    events: result,
    shiftedCount: movable.length,
    overflowCount: overflowTasks.length,
    carriedToDates,
  };
}

function carryOverTasks(
  events: ScheduleEvent[],
  overflowTasks: ParsedTask[],
  fromDateKey: string,
  bufferMinutes: number,
  now: Date,
  maxDays = 7
): { events: ScheduleEvent[]; dates: string[] } {
  let current = [...events];
  let remaining = [...overflowTasks].sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3));
  const dates: string[] = [];
  let dayOffset = 1;

  while (remaining.length > 0 && dayOffset <= maxDays) {
    const targetDate = addDays(parseDateKey(fromDateKey), dayOffset);
    const targetKey = toDateKey(targetDate);
    const dayExisting = current.filter((e) => e.date === targetKey && !isAuxiliaryEvent(e));
    const anchored = dayExisting.filter((e) => e.completed || isLockedEvent(e));
    const refNow = targetKey === toDateKey(now) ? now : undefined;

    const freeSlots = getFreeSlots(targetKey, anchored, bufferMinutes, refNow);
    const freeTotal = freeSlots.reduce((sum, s) => sum + (s.end - s.start), 0);

    const batch: ParsedTask[] = [];
    let usedMinutes = 0;
    for (const task of remaining) {
      const need = task.minutes + bufferMinutes;
      if (usedMinutes + need <= freeTotal) {
        batch.push(task);
        usedMinutes += need;
      }
    }

    if (batch.length === 0) {
      dayOffset++;
      continue;
    }

    const batchWithIds = batch.map((t) => ({ ...t, id: t.id ?? generateId() }));
    const items = buildOptimizedSchedule(batchWithIds, targetKey, anchored, bufferMinutes, refNow);
    current = [...current, ...itemsToEvents(items, targetKey, batchWithIds)];
    remaining = remaining.filter((t) => !batch.some((b) => b.id === t.id));
    dates.push(targetKey);
    dayOffset++;
  }

  return { events: current, dates };
}

export function carryOverFromTasks(
  baseEvents: ScheduleEvent[],
  overflowTasks: ParsedTask[],
  fromDateKey: string,
  bufferMinutes: number,
  now: Date
): ScheduleEvent[] {
  if (overflowTasks.length === 0) return baseEvents;
  return carryOverTasks(baseEvents, overflowTasks, fromDateKey, bufferMinutes, now).events;
}

export function rescheduleAllDelayed(
  allEvents: ScheduleEvent[],
  bufferMinutes: number,
  now = new Date()
): RescheduleResult {
  const todayKey = toDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const hasOverdue = allEvents.some(
    (e) =>
      e.date === todayKey &&
      !e.completed &&
      !isLockedEvent(e) &&
      !isAuxiliaryEvent(e) &&
      e.endMinutes <= nowMinutes
  );

  if (!hasOverdue) {
    return { events: allEvents, shiftedCount: 0, overflowCount: 0, carriedToDates: [] };
  }

  return rescheduleDay(allEvents, todayKey, bufferMinutes, now);
}

export function forceRescheduleDay(
  allEvents: ScheduleEvent[],
  dateKey: string,
  bufferMinutes: number,
  now = new Date()
): RescheduleResult {
  const otherDays = allEvents.filter((e) => e.date !== dateKey);
  const dayEvents = allEvents.filter((e) => e.date === dateKey);
  const anchoredClean = dayEvents.filter((e) => e.completed || isLockedEvent(e));
  const movable = dayEvents
    .filter((e) => !e.completed && !isLockedEvent(e) && !isAuxiliaryEvent(e))
    .sort(sortByPriorityAndTime);

  if (movable.length === 0) {
    return { events: allEvents, shiftedCount: 0, overflowCount: 0, carriedToDates: [] };
  }

  const parsedTasks = movable.map((e) => {
    const t = eventToParsedTask(e);
    return { ...t, id: e.id };
  });

  const items = buildOptimizedSchedule(parsedTasks, dateKey, anchoredClean, bufferMinutes, now);
  const placed = itemsToEvents(items, dateKey, parsedTasks);
  const placedTaskCount = placed.filter((e) => !e.isAuxiliary).length;

  if (placedTaskCount === 0 && movable.length > 0) {
    return { events: allEvents, shiftedCount: 0, overflowCount: 0, carriedToDates: [] };
  }

  const placedIds = new Set(placed.filter((e) => !e.isAuxiliary).map((e) => e.id));
  const overflowTasks = parsedTasks.filter((t) => t.id && !placedIds.has(t.id));

  let result = [...otherDays, ...anchoredClean, ...placed];
  const carriedToDates: string[] = [];

  if (overflowTasks.length > 0) {
    const carry = carryOverTasks(result, overflowTasks, dateKey, bufferMinutes, now);
    result = carry.events;
    carriedToDates.push(...carry.dates);
  }

  return {
    events: result,
    shiftedCount: movable.length,
    overflowCount: overflowTasks.length,
    carriedToDates,
  };
}

const SCHEDULE_DAY_END = 22 * 60;

function mergeBusyBlocks(blocks: { start: number; end: number }[]): { start: number; end: number }[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const block of sorted) {
    const last = merged[merged.length - 1];
    if (!last || block.start > last.end) {
      merged.push({ ...block });
    } else {
      last.end = Math.max(last.end, block.end);
    }
  }
  return merged;
}

function findSequentialSlot(
  cursor: number,
  totalNeed: number,
  taskMinutes: number,
  needBuffer: boolean,
  bufferMinutes: number,
  busy: { start: number; end: number }[]
): number | null {
  let c = cursor;
  const merged = mergeBusyBlocks(busy);
  for (let i = 0; i < 200; i++) {
    const taskStart = c + (needBuffer ? bufferMinutes : 0);
    const taskEnd = taskStart + taskMinutes;
    if (taskEnd > SCHEDULE_DAY_END) return null;

    const blockEnd = c + totalNeed;
    const overlap = merged.find((b) => c < b.end && blockEnd > b.start);
    if (!overlap) return c;
    c = snapToMinutes(overlap.end, 5);
  }
  return null;
}

/** 未完了タスクを現在時刻から順番に詰め直す（過去日の未完了も今日へ集約） */
export function shiftIncompleteFromNow(
  allEvents: ScheduleEvent[],
  dateKey: string,
  bufferMinutes: number,
  now = new Date()
): RescheduleResult {
  const todayKey = toDateKey(now);

  const pastMovable = allEvents
    .filter((e) => e.date < dateKey && !e.completed && !isLockedEvent(e) && !isAuxiliaryEvent(e))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes);

  const todayEvents = allEvents.filter((e) => e.date === dateKey);
  const todayMovable = todayEvents
    .filter((e) => !e.completed && !isLockedEvent(e) && !isAuxiliaryEvent(e))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const movable = [...pastMovable, ...todayMovable];

  if (movable.length === 0) {
    return { events: allEvents, shiftedCount: 0, overflowCount: 0, carriedToDates: [] };
  }

  const futureEvents = allEvents.filter((e) => e.date > dateKey);
  const pastKept = allEvents.filter(
    (e) => e.date < dateKey && (e.completed || isLockedEvent(e))
  );
  const anchored = todayEvents.filter((e) => e.completed || isLockedEvent(e));

  const busy = anchored.map((e) => ({ start: e.startMinutes, end: e.endMinutes }));
  let cursor =
    dateKey === todayKey
      ? snapToMinutes(now.getHours() * 60 + now.getMinutes() + bufferMinutes, 5)
      : snapToMinutes(7 * 60 + bufferMinutes, 5);

  const placed: ScheduleEvent[] = [];
  const unplaced: ParsedTask[] = [];

  for (const event of movable) {
    const task = { ...eventToParsedTask(event), id: event.id };
    const needBuffer = task.type !== 'power_nap' && bufferMinutes > 0;
    const totalNeed = task.minutes + (needBuffer ? bufferMinutes : 0);
    const slot = findSequentialSlot(cursor, totalNeed, task.minutes, needBuffer, bufferMinutes, busy);

    if (slot === null) {
      unplaced.push(task);
      continue;
    }

    let taskStart = slot;
    if (needBuffer) {
      placed.push({
        id: generateId(),
        date: dateKey,
        title: 'バッファ（切り替え）',
        startMinutes: slot,
        endMinutes: slot + bufferMinutes,
        color: 'teal',
        isAuxiliary: true,
        note: 'buffer',
      });
      taskStart = slot + bufferMinutes;
    }

    const taskEnd = taskStart + task.minutes;
    placed.push({
      id: event.id,
      date: dateKey,
      title: event.title,
      startMinutes: taskStart,
      endMinutes: taskEnd,
      color: event.color,
      note: event.note,
      priority: event.priority,
      completed: false,
      locked: false,
    });

    busy.push({ start: slot, end: taskEnd });
    cursor = snapToMinutes(taskEnd + (needBuffer ? bufferMinutes : 0), 5);
  }

  let result = [...futureEvents, ...pastKept, ...anchored, ...placed];
  const carriedToDates: string[] = [];

  if (unplaced.length > 0) {
    const carry = carryOverTasks(result, unplaced, dateKey, bufferMinutes, now);
    result = carry.events;
    carriedToDates.push(...carry.dates);
  }

  return {
    events: result,
    shiftedCount: movable.length,
    overflowCount: unplaced.length,
    carriedToDates,
    pastShiftedCount: pastMovable.length,
  };
}

/** 新規イベントを追加するだけ（既存予定は削除しない） */
export function appendScheduleEvents(prev: ScheduleEvent[], incoming: ScheduleEvent[]): ScheduleEvent[] {
  const validIncoming = incoming.filter(
    (e) => e.title && isValidMinutes(e.startMinutes) && isValidMinutes(e.endMinutes) && e.endMinutes > e.startMinutes
  );
  return [...prev, ...validIncoming];
}

/** 明示的な全削除コマンドのみ true */
export function isExplicitDeleteAllCommand(text: string): boolean {
  const t = text.trim();
  return /^(全削除|すべて削除|全予定削除|予定をすべて削除|スケジュール全削除|【全削除】)/.test(t);
}

export function clearDayEventsExceptAnchored(
  prev: ScheduleEvent[],
  dateKey: string
): ScheduleEvent[] {
  return prev.filter((e) => e.date !== dateKey || e.completed || e.locked);
}

export function parsePriorityFromText(text: string): { clean: string; priority: TaskPriority } {
  const patterns: [RegExp, TaskPriority][] = [
    [/\[最高\]|【最高】/, 1],
    [/\[高\]|【高\]|!$/, 2],
    [/\[普通\]|【普通\]/, 3],
    [/\[低\]|【低\]/, 4],
    [/\[最低\]|【最低\]/, 5],
  ];
  let priority = DEFAULT_PRIORITY;
  let clean = text.trim();
  for (const [re, p] of patterns) {
    if (re.test(clean)) {
      priority = p;
      clean = clean.replace(re, '').trim();
      break;
    }
  }
  return { clean, priority };
}

const MIN_TASK_DURATION = 5;
const DAY_MAX_MINUTES = 1440;

export interface ResizeTaskResult {
  events: ScheduleEvent[];
  deltaMinutes: number;
  overflowCount: number;
}

/** タスクの所要時間を変更し、以降の同日予定を差分だけずらす */
export function resizeTaskDuration(
  allEvents: ScheduleEvent[],
  eventId: string,
  newDurationMinutes: number
): ResizeTaskResult {
  const target = allEvents.find((e) => e.id === eventId);
  if (!target) {
    return { events: allEvents, deltaMinutes: 0, overflowCount: 0 };
  }

  const duration = Math.max(MIN_TASK_DURATION, snapToMinutes(newDurationMinutes, 5));
  const oldEnd = target.endMinutes;
  const newEnd = clampMinutes(snapToMinutes(target.startMinutes + duration, 5));
  const delta = newEnd - oldEnd;

  if (delta === 0) {
    return { events: allEvents, deltaMinutes: 0, overflowCount: 0 };
  }

  let overflowCount = 0;
  const events = allEvents.map((e) => {
    if (e.id === eventId) {
      return { ...e, endMinutes: newEnd };
    }
    if (e.date !== target.date || e.startMinutes < oldEnd) {
      return e;
    }

    const eventDuration = e.endMinutes - e.startMinutes;
    let start = clampMinutes(snapToMinutes(e.startMinutes + delta, 5));
    let end = start + eventDuration;

    if (end > DAY_MAX_MINUTES) {
      overflowCount += 1;
      end = DAY_MAX_MINUTES;
      start = Math.max(0, end - eventDuration);
    }

    return { ...e, startMinutes: start, endMinutes: end };
  });

  return { events, deltaMinutes: delta, overflowCount };
}
