import React, { useMemo } from 'react';

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppSettings, PRIORITY_SHORT } from '../types/schedule';
import { CalendarDisplayEvent } from '../presentation/calendar/CalendarDisplayEvent';

import { durationLabel, formatTime } from '../utils/time';

import { Theme, useTheme, useThemedStyles } from '../theme';



interface DayTaskListProps {

  events: CalendarDisplayEvent[];

  settings: AppSettings;

  isToday: boolean;

  notice?: ScheduleNotice | null;

  onToggleComplete: (id: string) => void;

  onEditEvent: (event: CalendarDisplayEvent) => void;

  onOpenScheduleAdjust: () => void;

  onDismissNotice: () => void;

}

export type ScheduleNoticeTone = 'info' | 'success' | 'warning' | 'error';

export interface ScheduleNotice {
  text: string;
  tone: ScheduleNoticeTone;
}



function TaskRow({

  event,

  use24Hour,

  isToday,

  partLabel,

  onToggleComplete,

  onEditEvent,

}: {

  event: CalendarDisplayEvent;

  use24Hour: boolean;

  isToday: boolean;

  partLabel?: string | null;

  onToggleComplete: (id: string) => void;

  onEditEvent: (event: CalendarDisplayEvent) => void;

}) {

  const theme = useTheme();

  const styles = useThemedStyles(makeStyles);

  const colors = theme.eventColors[event.color];

  const done = event.completed === true;

  const now = new Date();

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const isActive =

    isToday && !done && nowMinutes >= event.startMinutes && nowMinutes < event.endMinutes;

  const isOverdue = isToday && !done && nowMinutes >= event.endMinutes;

  const durationMinutes = event.endMinutes - event.startMinutes;

  const priority = event.priority ?? 3;



  return (

    <View style={[styles.row, isActive && styles.rowActive]}>

      <View style={styles.timeCol}>

        <Text style={[styles.startTime, isActive && styles.startTimeActive, isOverdue && styles.timeOverdue]}>

          {formatTime(event.startMinutes, use24Hour)}

        </Text>

        <View style={[styles.timeConnector, { backgroundColor: colors.border }]} />

        <Text style={[styles.endTime, done && styles.timeMuted]}>{formatTime(event.endMinutes, use24Hour)}</Text>

      </View>



      <TouchableOpacity

        style={[

          styles.checkBtn,

          { borderColor: done ? colors.border : theme.secondary },

          done && { backgroundColor: colors.border },

        ]}

        onPress={() => onToggleComplete(event.id)}

        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}

        activeOpacity={0.7}

      >

        {done && <Text style={styles.checkMark}>✓</Text>}

      </TouchableOpacity>



      <TouchableOpacity

        style={styles.bodyWrap}

        onPress={() => onEditEvent(event)}

        activeOpacity={0.75}

      >

        <View style={[styles.body, { borderLeftColor: colors.border }]}>

          <View style={styles.bodyTop}>

            <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>

              {event.title}

              {partLabel ? ` (${partLabel})` : ''}

            </Text>

            {isOverdue && (

              <View style={styles.overdueBadge}>

                <Text style={styles.overdueText}>遅延</Text>

              </View>

            )}

            {event.locked && (

              <View style={styles.lockBadge}>

                <Text style={styles.lockText}>固定</Text>

              </View>

            )}

            {isActive && (

              <View style={[styles.liveBadge, { backgroundColor: colors.bg }]}>

                <Text style={[styles.liveBadgeText, { color: colors.text }]}>進行中</Text>

              </View>

            )}

          </View>

          <View style={styles.metaRow}>

            <Text style={[styles.metaChip, { color: colors.text }]}>

              {durationLabel(0, durationMinutes)}

            </Text>

            <Text style={styles.metaDot}>·</Text>

            <Text style={styles.metaChip}>優先度 {PRIORITY_SHORT[priority]}</Text>

            {event.note ? (

              <>

                <Text style={styles.metaDot}>·</Text>

                <Text style={styles.note} numberOfLines={1}>{event.note}</Text>

              </>

            ) : null}

          </View>

        </View>

      </TouchableOpacity>

    </View>

  );

}



export function DayTaskList({

  events,

  settings,

  isToday,

  notice,

  onToggleComplete,

  onEditEvent,

  onOpenScheduleAdjust,

  onDismissNotice,

}: DayTaskListProps) {

  const styles = useThemedStyles(makeStyles);

  const { use24Hour } = settings;

  const taskEvents = events.filter((event) => !event.isAuxiliary);

  const sortedTaskEvents = useMemo(() => {
    const incomplete = taskEvents.filter((event) => !event.completed);
    const completed = taskEvents.filter((event) => event.completed);
    const byStart = (a: CalendarDisplayEvent, b: CalendarDisplayEvent) =>
      a.startMinutes - b.startMinutes || a.id.localeCompare(b.id);

    return [...incomplete.sort(byStart), ...completed.sort(byStart)];
  }, [taskEvents]);

  const partLabels = useMemo(() => {
    const groups = new Map<string, CalendarDisplayEvent[]>();
    for (const event of sortedTaskEvents) {
      const key = event.title.trim().toLowerCase();
      const list = groups.get(key) ?? [];
      list.push(event);
      groups.set(key, list);
    }

    const labels = new Map<string, string>();
    for (const group of groups.values()) {
      if (group.length <= 1) {
        continue;
      }
      group.forEach((event, index) => {
        labels.set(event.id, `分割 ${index + 1}/${group.length}`);
      });
    }
    return labels;
  }, [sortedTaskEvents]);

  const completedCount = taskEvents.filter((e) => e.completed).length;

  const progress = taskEvents.length > 0 ? completedCount / taskEvents.length : 0;

  const overdueCount = isToday

    ? taskEvents.filter((e) => {

        const now = new Date().getHours() * 60 + new Date().getMinutes();

        return !e.completed && e.endMinutes <= now;

      }).length

    : 0;



  if (taskEvents.length === 0) {

    return (

      <View style={styles.empty}>

        <Text style={styles.emptyIcon}>☐</Text>

        <Text style={styles.emptyTitle}>タスクがありません</Text>

        <Text style={styles.emptySub}>AIスケジュール作成または + ボタンで追加</Text>

      </View>

    );

  }



  return (

    <View style={styles.container}>

      <View style={styles.header}>

        <View style={{ flex: 1 }}>

          <Text style={styles.headerTitle}>{isToday ? '今日のタスク' : 'タスク一覧'}</Text>

          <Text style={styles.headerSub}>

            {completedCount} / {taskEvents.length} 完了

            {overdueCount > 0 ? ` · 遅延 ${overdueCount}件` : ''}

          </Text>

        </View>

        <View style={styles.headerActions}>

          <TouchableOpacity style={styles.adjustBtn} onPress={onOpenScheduleAdjust}>

            <Text style={styles.adjustBtnText}>予定を調整</Text>

          </TouchableOpacity>

        </View>

        <Text style={styles.headerPct}>{Math.round(progress * 100)}%</Text>

      </View>



      {notice ? (
        <TouchableOpacity
          style={[
            styles.notice,
            notice.tone === 'warning' && styles.noticeWarning,
            notice.tone === 'error' && styles.noticeError,
            notice.tone === 'success' && styles.noticeSuccess,
            notice.tone === 'info' && styles.noticeInfo,
          ]}
          onPress={onDismissNotice}
          activeOpacity={0.85}
        >
          {(notice.tone === 'warning' || notice.tone === 'error') && (
            <Text style={[styles.noticeKicker, styles.noticeKickerWarning]}>⚠ 予定未配置</Text>
          )}
          <Text
            style={[
              styles.noticeText,
              notice.tone === 'warning' && styles.noticeTextWarning,
              notice.tone === 'error' && styles.noticeTextError,
              notice.tone === 'success' && styles.noticeTextSuccess,
              notice.tone === 'info' && styles.noticeTextInfo,
            ]}
          >
            {notice.text}
          </Text>
          {(notice.tone === 'warning' || notice.tone === 'error') && (
            <Text style={styles.noticeDismissHint}>タップで閉じる</Text>
          )}
        </TouchableOpacity>
      ) : null}

      <View style={styles.progressTrack}>

        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />

      </View>



      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>

        {sortedTaskEvents.map((event, index) => (

          <View key={event.id}>

            <TaskRow

              event={event}

              use24Hour={use24Hour}

              isToday={isToday}

              partLabel={partLabels.get(event.id) ?? null}

              onToggleComplete={onToggleComplete}

              onEditEvent={onEditEvent}

            />

            {index < sortedTaskEvents.length - 1 && <View style={styles.divider} />}

          </View>

        ))}

      </ScrollView>

    </View>

  );

}



const TIME_COL_WIDTH = 58;



const makeStyles = (theme: Theme) =>
  StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: theme.elevated,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: theme.separator,

  },

  header: {

    flexDirection: 'row',

    alignItems: 'flex-end',

    justifyContent: 'space-between',

    paddingHorizontal: 16,

    paddingTop: 14,

    paddingBottom: 8,

    gap: 8,

  },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },

  adjustBtn: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.accent,
  },

  adjustBtnText: { fontSize: 12, fontWeight: '700', color: theme.accent },

  notice: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: theme.accentSoft,
    borderRadius: theme.radius.sm,
    padding: 10,
  },
  noticeWarning: {
    backgroundColor: theme.eventColors.red.bg,
    borderWidth: 1.5,
    borderColor: theme.eventColors.red.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  noticeError: {
    backgroundColor: theme.eventColors.red.bg,
    borderWidth: 1.5,
    borderColor: theme.eventColors.red.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  noticeSuccess: {
    backgroundColor: theme.eventColors.green.bg,
    borderWidth: 1,
    borderColor: theme.eventColors.green.border,
  },
  noticeInfo: {
    backgroundColor: theme.eventColors.orange.bg,
    borderWidth: 1,
    borderColor: theme.eventColors.orange.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  noticeKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  noticeKickerWarning: {
    color: theme.eventColors.red.text,
  },
  noticeText: { fontSize: 12, color: theme.accent, lineHeight: 18 },
  noticeTextWarning: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.eventColors.red.text,
    lineHeight: 21,
  },
  noticeTextError: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.eventColors.red.text,
    lineHeight: 21,
  },
  noticeTextSuccess: {
    color: theme.eventColors.green.text,
    fontWeight: '600',
  },
  noticeTextInfo: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.eventColors.orange.text,
    lineHeight: 20,
  },
  noticeDismissHint: {
    fontSize: 11,
    color: theme.eventColors.red.text,
    opacity: 0.75,
    marginTop: 6,
  },

  headerTitle: { fontSize: 20, fontWeight: '700', color: theme.text },

  headerSub: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },

  headerPct: { fontSize: 28, fontWeight: '700', color: theme.accent, letterSpacing: -0.5 },

  progressTrack: {

    height: 4,

    backgroundColor: theme.secondary,

    marginHorizontal: 16,

    borderRadius: 2,

    marginBottom: 4,

    overflow: 'hidden',

  },

  progressFill: { height: '100%', backgroundColor: theme.accent, borderRadius: 2 },

  list: { flex: 1 },

  listContent: { paddingBottom: 12 },

  row: {

    flexDirection: 'row',

    alignItems: 'flex-start',

    paddingHorizontal: 12,

    paddingVertical: 12,

    minHeight: 72,

  },

  rowActive: { backgroundColor: theme.accentSoft },

  timeCol: {

    width: TIME_COL_WIDTH,

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 8,

  },

  startTime: {

    fontSize: 15,

    fontWeight: '700',

    color: theme.text,

    fontVariant: ['tabular-nums'],

    letterSpacing: -0.3,

  },

  startTimeActive: { color: theme.accent },

  endTime: {

    fontSize: 12,

    fontWeight: '500',

    color: theme.textSecondary,

    fontVariant: ['tabular-nums'],

  },

  timeOverdue: { color: theme.destructive },

  timeMuted: { color: theme.textTertiary },

  timeConnector: {

    width: 2,

    height: 10,

    borderRadius: 1,

    marginVertical: 3,

    opacity: 0.45,

  },

  checkBtn: {

    width: 24,

    height: 24,

    borderRadius: 12,

    borderWidth: 2,

    alignItems: 'center',

    justifyContent: 'center',

    marginHorizontal: 10,

    marginTop: 14,

    backgroundColor: theme.elevated,

  },

  checkMark: { color: '#fff', fontSize: 13, fontWeight: '800', marginTop: -1 },

  bodyWrap: { flex: 1 },

  body: {

    borderLeftWidth: 3,

    paddingLeft: 12,

    paddingVertical: 2,

  },

  bodyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },

  title: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.text, lineHeight: 22 },

  titleDone: {

    color: theme.textTertiary,

    textDecorationLine: 'line-through',

    textDecorationColor: theme.textTertiary,

  },

  liveBadge: {

    paddingHorizontal: 8,

    paddingVertical: 3,

    borderRadius: 999,

  },

  liveBadgeText: { fontSize: 11, fontWeight: '700' },

  overdueBadge: {

    backgroundColor: theme.text,

    paddingHorizontal: 8,

    paddingVertical: 3,

    borderRadius: 999,

  },

  overdueText: { fontSize: 11, fontWeight: '700', color: theme.elevated },

  lockBadge: {

    backgroundColor: theme.secondary,

    paddingHorizontal: 8,

    paddingVertical: 3,

    borderRadius: 999,

  },

  lockText: { fontSize: 11, fontWeight: '600', color: theme.textSecondary },

  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' },

  metaChip: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },

  metaDot: { fontSize: 12, color: theme.textTertiary, marginHorizontal: 4 },

  note: { flex: 1, fontSize: 12, color: theme.textSecondary },

  divider: {

    height: StyleSheet.hairlineWidth,

    backgroundColor: theme.separator,

    marginLeft: TIME_COL_WIDTH + 46,

    marginRight: 16,

  },

  empty: {

    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: theme.elevated,

    padding: 32,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: theme.separator,

  },

  emptyIcon: { fontSize: 36, color: theme.textTertiary, marginBottom: 8 },

  emptyTitle: { fontSize: 17, fontWeight: '600', color: theme.text },

  emptySub: { fontSize: 14, color: theme.textSecondary, marginTop: 6, textAlign: 'center' },

  });


