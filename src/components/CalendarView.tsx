import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MonthGrid } from './MonthGrid';
import { DayTimeline } from './DayTimeline';
import { ScheduleNotice } from './DayTaskList';
import { EventEditor } from './EventEditor';
import { AiScheduleModal } from './AiScheduleModal';
import { ScheduleAdjustModal } from './calendar/ScheduleAdjustModal';
import { AppSettings, AiTaskInput, CalendarMode } from '../types/schedule';
import {
  applyDelete,
  applyEdit,
  CalendarDisplayEvent,
  CalendarEditorGateway,
  createEntityFromInput,
  createNewEditableDraft,
  EditableCalendarEvent,
  PlannerGateway,
  runAiDayPlan,
  resolveAiTaskInputs,
  buildRolloverNotice,
  toEditableModel,
  toggleCompleted,
} from '../presentation/calendar';
import { taskRepository, sessionRepository } from '../repositories';
import { formatDateHeader, parseDateKey, toDateKey } from '../utils/time';
import { Theme, useThemedStyles } from '../theme';

interface CalendarViewProps {
  calendarMode: CalendarMode;
  selectedDate: Date;
  viewMonth: Date;
  setViewMonth: (date: Date) => void;
  displayEvents: CalendarDisplayEvent[];
  displayEventCountByDate: Map<string, number>;
  settings: AppSettings;
  editorGateway: CalendarEditorGateway;
  plannerGateway: PlannerGateway;
  isAiModalOpen: boolean;
  isAiGenerating: boolean;
  openDayView: (date: Date) => void;
  closeDayView: () => void;
  goToPrevDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;
  openAiModal: () => void;
  closeAiModal: () => void;
  cloudAiAvailable: boolean;
  onAdjustFromNow: (date: Date) => void;
  onFullReplan: (date: Date) => void;
  onFullReplanUnavailable?: () => void;
}

export function CalendarView(props: CalendarViewProps) {
  const {
    calendarMode,
    selectedDate,
    viewMonth,
    setViewMonth,
    displayEvents,
    displayEventCountByDate,
    settings,
    editorGateway,
    plannerGateway,
    isAiModalOpen,
    isAiGenerating,
    openDayView,
    closeDayView,
    goToPrevDay,
    goToNextDay,
    goToToday,
    openAiModal,
    closeAiModal,
    cloudAiAvailable,
    onAdjustFromNow,
    onFullReplan,
    onFullReplanUnavailable,
  } = props;

  const styles = useThemedStyles(makeStyles);

  const [editingEvent, setEditingEvent] = useState<EditableCalendarEvent | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState<ScheduleNotice | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const isDayView = calendarMode === 'day';
  const today = new Date();
  const monthEventCounts = displayEventCountByDate;

  const canShiftFromNow = useMemo(() => {
    const todayKey = toDateKey(new Date());
    if (toDateKey(selectedDate) !== todayKey) {
      return false;
    }

    return displayEvents.some(
      (event) => !event.completed && !event.locked && !event.isAuxiliary
    );
  }, [selectedDate, displayEvents]);

  const overdueCount = useMemo(() => {
    const todayKey = toDateKey(new Date());
    if (toDateKey(selectedDate) !== todayKey) {
      return 0;
    }
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    return displayEvents.filter(
      (event) =>
        !event.completed &&
        !event.locked &&
        !event.isAuxiliary &&
        event.endMinutes <= nowMinutes
    ).length;
  }, [selectedDate, displayEvents]);

  const adjustRecommended = overdueCount > 0 ? 'shift' as const : null;

  const handleEditDisplayEvent = useCallback(
    (event: CalendarDisplayEvent) => {
      if (!event.editable) {
        return;
      }

      setEditingEvent(toEditableModel(event));
      setEditorOpen(true);
    },
    []
  );

  const handleOpenNewEvent = useCallback(
    (startMinutes: number, endMinutes?: number) => {
      const duration = endMinutes ? endMinutes - startMinutes : settings.defaultDurationMinutes;
      setEditingEvent(
        createNewEditableDraft(
          toDateKey(selectedDate),
          startMinutes,
          startMinutes + duration
        )
      );
      setEditorOpen(true);
    },
    [selectedDate, settings.defaultDurationMinutes]
  );

  const handleEditorClose = useCallback(() => {
    setEditorOpen(false);
    setEditingEvent(null);
  }, []);

  const handleEditorSave = useCallback(
    async (editable: EditableCalendarEvent) => {
      const previousDate = editingEvent?.date;

      if (editable.isNew) {
        await createEntityFromInput(editable, editorGateway, settings.defaultDurationMinutes);
      } else {
        await applyEdit(editable, editorGateway);
      }

      if (
        isDayView &&
        editable.date &&
        previousDate &&
        editable.date !== previousDate
      ) {
        openDayView(parseDateKey(editable.date));
      }

      setEditorOpen(false);
      setEditingEvent(null);
    },
    [editorGateway, editingEvent?.date, isDayView, openDayView, settings.defaultDurationMinutes]
  );

  const handleEditorDelete = useCallback(
    async (editable: EditableCalendarEvent) => {
      await applyDelete(editable, editorGateway);
      setEditorOpen(false);
      setEditingEvent(null);
    },
    [editorGateway]
  );

  const handleToggleComplete = useCallback(
    async (eventId: string) => {
      const displayEvent = displayEvents.find((item) => item.id === eventId);
      if (!displayEvent) {
        return;
      }

      await toggleCompleted(displayEvent, editorGateway);
    },
    [displayEvents, editorGateway]
  );

  const handleFullReplan = useCallback(() => {
    setAdjustOpen(false);
    onFullReplan(selectedDate);
  }, [onFullReplan, selectedDate]);

  const handleShiftFromNow = useCallback(() => {
    setAdjustOpen(false);
    onAdjustFromNow(selectedDate);
  }, [onAdjustFromNow, selectedDate]);

  const handleOpenScheduleAdjust = useCallback(() => {
    setAdjustOpen(true);
  }, []);

  const handleCloseScheduleAdjust = useCallback(() => {
    if (isAiGenerating) {
      return;
    }
    setAdjustOpen(false);
  }, [isAiGenerating]);

  const handleAiGenerate = useCallback(
    async (tasks: AiTaskInput[]) => {
      const scheduleDate = isDayView ? selectedDate : today;
      try {
        const [existingTasks, existingSessions] = await Promise.all([
          taskRepository.getAll(),
          sessionRepository.getAll(),
        ]);
        const dateKey = toDateKey(scheduleDate);
        const { resolved } = await resolveAiTaskInputs(
          tasks,
          dateKey,
          existingTasks,
          existingSessions,
          settings.defaultDurationMinutes,
          editorGateway
        );
        const taskIds = resolved.map((task) => task.id);
        const outcome = await runAiDayPlan(scheduleDate, plannerGateway, { taskIds });
        closeAiModal();
        if (outcome.result === 'skipped_empty') {
          setScheduleNotice({
            tone: 'warning',
            text: 'スケジュールを配置する場所がありませんでした。タスクは登録済みですが、今日の予定には入っていません。',
          });
          if (!isDayView) {
            openDayView(scheduleDate);
          }
        } else {
          const rollover = buildRolloverNotice(outcome);
          setScheduleNotice({
            tone: rollover ? 'info' : 'success',
            text: rollover
              ? `${rollover} Today タブで今日の流れを確認できます。`
              : 'スケジュールを生成しました。Today タブで今日の流れを確認できます。',
          });
          if (!isDayView && rollover) {
            openDayView(scheduleDate);
          }
        }
      } catch {
        setScheduleNotice({
          tone: 'error',
          text: 'スケジュール生成に失敗しました。もう一度お試しください。',
        });
      }
    },
    [closeAiModal, editorGateway, isDayView, openDayView, plannerGateway, selectedDate, settings.defaultDurationMinutes, today]
  );

  const handleDismissNotice = useCallback(() => {
    setScheduleNotice(null);
  }, []);

  const handleCloseAiModal = useCallback(() => {
    if (isAiGenerating) {
      return;
    }
    closeAiModal();
  }, [closeAiModal, isAiGenerating]);

  const aiScheduleDate = isDayView ? selectedDate : today;

  return (
    <View style={styles.container}>
      {!isDayView ? (
        <ScrollView style={styles.monthScroll} contentContainerStyle={styles.monthContent}>
          <MonthGrid
            viewMonth={viewMonth}
            eventCountByDate={monthEventCounts}
            settings={settings}
            onOpenDay={openDayView}
            onChangeMonth={setViewMonth}
            onGoToday={goToToday}
          />

          <View style={styles.preview}>
            <TouchableOpacity
              style={[styles.aiCard, !cloudAiAvailable && styles.aiCardDisabled]}
              onPress={openAiModal}
              activeOpacity={0.85}
            >
              <Text style={[styles.aiCardIcon, !cloudAiAvailable && styles.aiCardIconDisabled]}>✦</Text>
              <View style={styles.aiCardBody}>
                <Text style={[styles.aiCardTitle, !cloudAiAvailable && styles.aiCardTitleDisabled]}>
                  {cloudAiAvailable ? 'AIでスケジュール作成' : 'AIでスケジュール作成（未設定）'}
                </Text>
                <Text style={styles.aiCardSub}>
                  {cloudAiAvailable
                    ? '詳細編集・月表示・他の日の配置'
                    : 'Cloud AI プロキシまたは API キーを設定してください'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
              毎朝の自動配置は Today タブ。ここでは日付をタップして詳細編集・月表示ができます
            </Text>

            <TouchableOpacity style={styles.todayCard} onPress={() => openDayView(today)} activeOpacity={0.8}>
              <Text style={styles.todayLabel}>今日の予定</Text>
              <View style={styles.todayRow}>
                <Text style={styles.todayDate}>{formatDateHeader(today)}</Text>
                <Text style={styles.todayCount}>{monthEventCounts.get(toDateKey(today)) ?? 0}件</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <DayTimeline
          date={selectedDate}
          events={displayEvents}
          displayEvents={displayEvents}
          dragGateway={editorGateway}
          settings={settings}
          onBack={closeDayView}
          onPrevDay={goToPrevDay}
          onNextDay={goToNextDay}
          onCreateSlot={(start, end) => handleOpenNewEvent(start, end)}
          onEditEvent={handleEditDisplayEvent}
          onToggleComplete={handleToggleComplete}
          onOpenScheduleAdjust={handleOpenScheduleAdjust}
          onDismissNotice={handleDismissNotice}
          rescheduleNotice={scheduleNotice}
          onAiSchedule={openAiModal}
          cloudAiAvailable={cloudAiAvailable}
        />
      )}

      {isDayView && (
        <View style={styles.fabRow}>
          <TouchableOpacity
            style={[styles.fabAi, !cloudAiAvailable && styles.fabAiDisabled]}
            onPress={openAiModal}
            activeOpacity={0.85}
          >
            <Text style={[styles.fabAiText, !cloudAiAvailable && styles.fabAiTextDisabled]}>✦</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fab} onPress={() => handleOpenNewEvent(9 * 60)} activeOpacity={0.85}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      <EventEditor
        isOpen={editorOpen}
        event={editingEvent}
        onSave={handleEditorSave}
        onDelete={editingEvent?.deletable ? handleEditorDelete : undefined}
        onClose={handleEditorClose}
      />

      <AiScheduleModal
        isOpen={isAiModalOpen}
        targetDate={aiScheduleDate}
        isLoading={isAiGenerating}
        onClose={handleCloseAiModal}
        onGenerate={handleAiGenerate}
      />

      <ScheduleAdjustModal
        isOpen={adjustOpen}
        isLoading={isAiGenerating}
        canShiftFromNow={canShiftFromNow}
        cloudAiAvailable={cloudAiAvailable}
        recommended={adjustRecommended}
        onClose={handleCloseScheduleAdjust}
        onShiftFromNow={handleShiftFromNow}
        onFullReplan={handleFullReplan}
        onFullReplanUnavailable={onFullReplanUnavailable}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
  container: { flex: 1 },
  monthScroll: { flex: 1 },
  monthContent: { paddingBottom: 24 },
  preview: { paddingHorizontal: 16, paddingTop: 8 },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.elevated,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.accentSoft,
    ...theme.shadow,
  },
  aiCardIcon: { fontSize: 24, marginRight: 12, color: theme.accent },
  aiCardBody: { flex: 1 },
  aiCardTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
  aiCardSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  aiCardDisabled: { borderColor: theme.separator, opacity: 0.85 },
  aiCardIconDisabled: { color: theme.textTertiary },
  aiCardTitleDisabled: { color: theme.textSecondary },
  hint: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  todayCard: {
    backgroundColor: theme.elevated,
    borderRadius: theme.radius.md,
    padding: 14,
    ...theme.shadow,
  },
  todayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.accent,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  todayRow: { flexDirection: 'row', alignItems: 'center' },
  todayDate: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.text },
  todayCount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    backgroundColor: theme.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
  },
  chevron: { fontSize: 22, color: theme.textTertiary, fontWeight: '300' },
  fabRow: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabAi: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.accentSoft,
    ...theme.shadow,
  },
  fabAiText: { fontSize: 20, color: theme.accent },
  fabAiDisabled: { borderColor: theme.separator, opacity: 0.75 },
  fabAiTextDisabled: { color: theme.textTertiary },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 28, color: theme.onAccent, fontWeight: '300', marginTop: -2 },
  });
