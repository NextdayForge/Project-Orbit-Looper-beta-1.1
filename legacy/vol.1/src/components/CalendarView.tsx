import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MonthGrid } from './MonthGrid';
import { DayTimeline } from './DayTimeline';
import { EventEditor } from './EventEditor';
import { AiScheduleModal } from './AiScheduleModal';
import { AppSettings, CalendarMode, EventColor, ScheduleEvent, TaskPriority } from '../types/schedule';
import { formatDateHeader, toDateKey } from '../utils/time';
import { theme } from '../theme';

interface CalendarViewProps {
  calendarMode: CalendarMode;
  selectedDate: Date;
  viewMonth: Date;
  setViewMonth: (date: Date) => void;
  dayEvents: ScheduleEvent[];
  eventCountByDate: Map<string, number>;
  settings: AppSettings;
  editingEvent: ScheduleEvent | null;
  draftSlot: { startMinutes: number; endMinutes: number } | null;
  isEditorOpen: boolean;
  isAiModalOpen: boolean;
  isAiGenerating: boolean;
  openDayView: (date: Date) => void;
  closeDayView: () => void;
  goToPrevDay: () => void;
  goToNextDay: () => void;
  openNewEvent: (startMinutes: number, endMinutes?: number) => void;
  openEditEvent: (event: ScheduleEvent) => void;
  closeEditor: () => void;
  saveEvent: (data: {
    title: string;
    startMinutes: number;
    endMinutes: number;
    color: EventColor;
    note?: string;
    priority?: TaskPriority;
    locked?: boolean;
  }) => void;
  deleteEvent: (id: string) => void;
  toggleEventComplete: (id: string) => void;
  forceReschedule: () => void;
  shiftFromNow: () => void;
  canShiftFromNow: boolean;
  rescheduleNotice: string | null;
  clearRescheduleNotice: () => void;
  goToToday: () => void;
  openAiModal: () => void;
  closeAiModal: () => void;
  runAiSchedule: (tasks: AiTaskInput[]) => void;
}

export function CalendarView(props: CalendarViewProps) {
  const {
    calendarMode,
    selectedDate,
    viewMonth,
    setViewMonth,
    dayEvents,
    eventCountByDate,
    settings,
    editingEvent,
    draftSlot,
    isEditorOpen,
    isAiModalOpen,
    isAiGenerating,
    openDayView,
    closeDayView,
    goToPrevDay,
    goToNextDay,
    openNewEvent,
    openEditEvent,
    closeEditor,
    saveEvent,
    deleteEvent,
    toggleEventComplete,
    forceReschedule,
    shiftFromNow,
    canShiftFromNow,
    rescheduleNotice,
    clearRescheduleNotice,
    goToToday,
    openAiModal,
    closeAiModal,
    runAiSchedule,
  } = props;

  const isDayView = calendarMode === 'day';
  const today = new Date();

  return (
    <View style={styles.container}>
      {!isDayView ? (
        <ScrollView style={styles.monthScroll} contentContainerStyle={styles.monthContent}>
          <MonthGrid
            viewMonth={viewMonth}
            selectedDate={selectedDate}
            eventCountByDate={eventCountByDate}
            settings={settings}
            onOpenDay={openDayView}
            onChangeMonth={setViewMonth}
            onGoToday={goToToday}
          />

          <View style={styles.preview}>
            <TouchableOpacity style={styles.aiCard} onPress={openAiModal} activeOpacity={0.85}>
              <Text style={styles.aiCardIcon}>✨</Text>
              <View style={styles.aiCardBody}>
                <Text style={styles.aiCardTitle}>AIでスケジュール作成</Text>
                <Text style={styles.aiCardSub}>
                  {formatDateHeader(selectedDate)} にタスクを自動配置
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <Text style={styles.hint}>日付をタップすると、その日のスケジュール画面に移動します</Text>

            <TouchableOpacity style={styles.todayCard} onPress={() => openDayView(today)} activeOpacity={0.8}>
              <Text style={styles.todayLabel}>今日の予定</Text>
              <View style={styles.todayRow}>
                <Text style={styles.todayDate}>{formatDateHeader(today)}</Text>
                <Text style={styles.todayCount}>{eventCountByDate.get(toDateKey(today)) ?? 0}件</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <DayTimeline
          date={selectedDate}
          events={dayEvents}
          settings={settings}
          onBack={closeDayView}
          onPrevDay={goToPrevDay}
          onNextDay={goToNextDay}
          onCreateSlot={(start, end) => openNewEvent(start, end)}
          onEditEvent={openEditEvent}
          onToggleComplete={toggleEventComplete}
          onForceReschedule={forceReschedule}
          onShiftFromNow={shiftFromNow}
          canShiftFromNow={canShiftFromNow}
          onDismissNotice={clearRescheduleNotice}
          rescheduleNotice={rescheduleNotice}
          onAiSchedule={openAiModal}
        />
      )}

      {isDayView && (
        <View style={styles.fabRow}>
          <TouchableOpacity style={styles.fabAi} onPress={openAiModal} activeOpacity={0.85}>
            <Text style={styles.fabAiText}>✨</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fab} onPress={() => openNewEvent(9 * 60)} activeOpacity={0.85}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      <EventEditor
        isOpen={isEditorOpen}
        event={editingEvent}
        draftStart={draftSlot?.startMinutes}
        draftEnd={draftSlot?.endMinutes}
        onSave={saveEvent}
        onDelete={editingEvent ? deleteEvent : undefined}
        onClose={closeEditor}
      />

      <AiScheduleModal
        isOpen={isAiModalOpen}
        targetDate={selectedDate}
        isLoading={isAiGenerating}
        onClose={closeAiModal}
        onGenerate={runAiSchedule}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  aiCardIcon: { fontSize: 28, marginRight: 12 },
  aiCardBody: { flex: 1 },
  aiCardTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
  aiCardSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
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
  fabAiText: { fontSize: 22 },
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
  fabText: { fontSize: 28, color: '#fff', fontWeight: '300', marginTop: -2 },
});
