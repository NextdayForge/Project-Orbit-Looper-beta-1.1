import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppSettings,
  AppTab,
  CalendarMode,
  DEFAULT_SETTINGS,
  EventColor,
  ScheduleEvent,
} from '../types/schedule';
import { loadStoredData, saveStoredData } from '../services/storage';
import { generateAiSchedule } from '../services/aiService';
import {
  appendScheduleEvents,
  clearDayEventsExceptAnchored,
  forceRescheduleDay,
  isAuxiliaryEvent,
  isExplicitDeleteAllCommand,
  rescheduleAllDelayed,
  resizeTaskDuration,
  shiftIncompleteFromNow,
  smartPlaceNewTask,
} from '../services/schedulePlanner';
import { AiTaskInput } from '../types/schedule';
import { addDays, generateId, isSameDay, toDateKey } from '../utils/time';
import { TaskPriority } from '../types/schedule';

function seedDemoEvents(today: string): ScheduleEvent[] {
  return [
    { id: generateId(), date: today, title: '朝のミーティング', startMinutes: 540, endMinutes: 565, color: 'blue', locked: true, priority: 2 },
    { id: generateId(), date: today, title: '集中作業', startMinutes: 630, endMinutes: 720, color: 'green', priority: 2 },
    { id: generateId(), date: today, title: '短い予定（5分）', startMinutes: 735, endMinutes: 740, color: 'orange', priority: 4 },
    { id: generateId(), date: today, title: 'ランチ', startMinutes: 750, endMinutes: 810, color: 'teal', locked: true, priority: 3 },
    { id: generateId(), date: today, title: '重なりA', startMinutes: 840, endMinutes: 930, color: 'purple', priority: 3 },
    { id: generateId(), date: today, title: '重なりB', startMinutes: 870, endMinutes: 960, color: 'red', priority: 3 },
  ];
}

export function useCalendarState() {
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('calendar');
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draftSlot, setDraftSlot] = useState<{ startMinutes: number; endMinutes: number } | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [rescheduleNotice, setRescheduleNotice] = useState<string | null>(null);
  useEffect(() => {
    loadStoredData()
      .then((data) => {
        if (data.events.length === 0) {
          setEvents(seedDemoEvents(toDateKey(new Date())));
        } else {
          setEvents(data.events);
        }
        setSettings(data.settings);
      })
      .catch(() => {
        setEvents(seedDemoEvents(toDateKey(new Date())));
        setSettings(DEFAULT_SETTINGS);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || calendarMode !== 'day' || !isSameDay(selectedDate, new Date())) return;
    setEvents((prev) => {
      const result = rescheduleAllDelayed(prev, settings.defaultBufferMinutes);
      if (result.shiftedCount > 0) {
        const msg =
          result.overflowCount > 0
            ? `${result.shiftedCount}件を再配置し、${result.overflowCount}件を翌日以降へ繰り越しました`
            : `${result.shiftedCount}件の遅延タスクを再配置しました`;
        setRescheduleNotice(msg);
        return result.events;
      }
      return prev;
    });
  }, [ready, calendarMode, selectedDate, settings.defaultBufferMinutes]);

  useEffect(() => {
    if (!ready) return;
    saveStoredData(events, settings);
  }, [events, settings, ready]);

  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);

  const dayEvents = useMemo(
    () => events.filter((e) => e.date === selectedDateKey).sort((a, b) => a.startMinutes - b.startMinutes),
    [events, selectedDateKey]
  );

  const eventCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) map.set(e.date, (map.get(e.date) ?? 0) + 1);
    return map;
  }, [events]);

  const canShiftFromNow = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return events.some(
      (e) =>
        e.date <= todayKey &&
        !e.completed &&
        !e.locked &&
        !isAuxiliaryEvent(e)
    );
  }, [events]);

  const openNewEvent = useCallback(
    (startMinutes: number, endMinutes?: number) => {
      const duration = endMinutes ? endMinutes - startMinutes : settings.defaultDurationMinutes;
      setDraftSlot({ startMinutes, endMinutes: startMinutes + duration });
      setEditingEvent(null);
      setIsEditorOpen(true);
    },
    [settings.defaultDurationMinutes]
  );

  const openEditEvent = useCallback((event: ScheduleEvent) => {
    setEditingEvent(event);
    setDraftSlot(null);
    setIsEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditingEvent(null);
    setDraftSlot(null);
  }, []);

  const saveEvent = useCallback(
    (data: {
      title: string;
      startMinutes: number;
      endMinutes: number;
      color: EventColor;
      note?: string;
      priority?: TaskPriority;
      locked?: boolean;
    }) => {
      if (editingEvent) {
        setEvents((prev) => {
          const sameStart = data.startMinutes === editingEvent.startMinutes;
          const endChanged = data.endMinutes !== editingEvent.endMinutes;
          const fields = {
            title: data.title,
            startMinutes: data.startMinutes,
            endMinutes: data.endMinutes,
            color: data.color,
            note: data.note,
            priority: data.priority ?? editingEvent.priority ?? 3,
            locked: data.locked,
            date: selectedDateKey,
          };

          if (sameStart && endChanged) {
            const newDuration = data.endMinutes - data.startMinutes;
            const resized = resizeTaskDuration(prev, editingEvent.id, newDuration);
            if (resized.overflowCount > 0) {
              setRescheduleNotice(`${resized.overflowCount}件が日の終わりに達したため調整されました`);
            }
            return resized.events.map((e) =>
              e.id === editingEvent.id ? { ...e, ...fields, endMinutes: e.endMinutes } : e
            );
          }

          return prev.map((e) => (e.id === editingEvent.id ? { ...e, ...fields } : e));
        });
      } else {
        setEvents((prev) => {
          const placed = smartPlaceNewTask(
            {
              title: data.title,
              startMinutes: data.startMinutes,
              endMinutes: data.endMinutes,
              color: data.color,
              note: data.note,
              priority: data.priority ?? 3,
            },
            selectedDateKey,
            prev,
            settings.defaultBufferMinutes
          );
          return [
            ...prev,
            ...placed.map((e) =>
              !e.isAuxiliary && e.title === data.title ? { ...e, locked: data.locked ?? false } : e
            ),
          ];
        });
      }
      closeEditor();
    },
    [editingEvent, selectedDateKey, closeEditor, settings.defaultBufferMinutes]
  );

  const deleteEvent = useCallback(
    (id: string) => {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      closeEditor();
    },
    [closeEditor]
  );

  const toggleEventComplete = useCallback((id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e))
    );
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setSelectedDate(now);
    setViewMonth(now);
    setCalendarMode('day');
  }, []);

  const openDayView = useCallback((date: Date) => {
    setSelectedDate(date);
    setViewMonth(date);
    setCalendarMode('day');
  }, []);

  const closeDayView = useCallback(() => setCalendarMode('month'), []);
  const goToPrevDay = useCallback(() => setSelectedDate((prev) => addDays(prev, -1)), []);
  const goToNextDay = useCallback(() => setSelectedDate((prev) => addDays(prev, 1)), []);

  const openAiModal = useCallback(() => setIsAiModalOpen(true), []);

  const closeAiModal = useCallback(() => {
    if (isAiGenerating) return;
    setIsAiModalOpen(false);
  }, [isAiGenerating]);

  const runAiSchedule = useCallback(
    async (taskInputs: AiTaskInput[]) => {
      setIsAiGenerating(true);
      try {
        const dateKey = toDateKey(selectedDate);

        if (taskInputs.length === 1 && isExplicitDeleteAllCommand(taskInputs[0].title)) {
          setEvents((prev) => clearDayEventsExceptAnchored(prev, dateKey));
          setIsAiModalOpen(false);
          return;
        }

        const newEvents = await generateAiSchedule(
          taskInputs,
          selectedDate,
          events,
          settings.defaultBufferMinutes
        );
        setEvents((prev) => appendScheduleEvents(prev, newEvents));
        setViewMonth(selectedDate);
        setCalendarMode('day');
        setIsAiModalOpen(false);
      } finally {
        setIsAiGenerating(false);
      }
    },
    [selectedDate, events, settings.defaultBufferMinutes]
  );

  const forceReschedule = useCallback(() => {
    setEvents((prev) => {
      const result = forceRescheduleDay(prev, selectedDateKey, settings.defaultBufferMinutes);
      if (result.shiftedCount > 0) {
        const msg =
          result.overflowCount > 0
            ? `${result.shiftedCount}件を再配置（${result.overflowCount}件を翌日以降へ）`
            : `${result.shiftedCount}件を優先度順に再配置しました`;
        setRescheduleNotice(msg);
        return result.events;
      }
      setRescheduleNotice('再配置するタスクがありません');
      return prev;
    });
  }, [selectedDateKey, settings.defaultBufferMinutes]);

  const shiftFromNow = useCallback(() => {
    const todayKey = toDateKey(new Date());
    setEvents((prev) => {
      const result = shiftIncompleteFromNow(prev, todayKey, settings.defaultBufferMinutes);
      if (result.shiftedCount > 0) {
        const pastPart =
          (result.pastShiftedCount ?? 0) > 0 ? `（過去 ${result.pastShiftedCount}件を含む）` : '';
        const msg =
          result.overflowCount > 0
            ? `${result.shiftedCount}件を今の時間から再配置${pastPart}（${result.overflowCount}件を翌日以降へ）`
            : `${result.shiftedCount}件を今の時間から順にずらしました${pastPart}`;
        setRescheduleNotice(msg);
        return result.events;
      }
      setRescheduleNotice('ずらす未完了タスクがありません');
      return prev;
    });
    setSelectedDate(new Date());
    setCalendarMode('day');
  }, [settings.defaultBufferMinutes]);

  const clearRescheduleNotice = useCallback(() => setRescheduleNotice(null), []);

  return {
    ready,
    activeTab,
    setActiveTab,
    calendarMode,
    selectedDate,
    viewMonth,
    setViewMonth,
    dayEvents,
    eventCountByDate,
    settings,
    updateSettings,
    editingEvent,
    draftSlot,
    isEditorOpen,
    openNewEvent,
    openEditEvent,
    closeEditor,
    saveEvent,
    deleteEvent,
    toggleEventComplete,
    goToToday,
    openDayView,
    closeDayView,
    goToPrevDay,
    goToNextDay,
    isAiModalOpen,
    isAiGenerating,
    openAiModal,
    closeAiModal,
    runAiSchedule,
    forceReschedule,
    shiftFromNow,
    canShiftFromNow,
    rescheduleNotice,
    clearRescheduleNotice,
  };
}