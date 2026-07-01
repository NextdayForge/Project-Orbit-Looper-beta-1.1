import React from 'react';

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppSettings, COLOR_MAP, PRIORITY_SHORT, ScheduleEvent } from '../types/schedule';

import { isAuxiliaryEvent } from '../services/schedulePlanner';

import { durationLabel, formatTime } from '../utils/time';

import { theme } from '../theme';



interface DayTaskListProps {

  events: ScheduleEvent[];

  settings: AppSettings;

  isToday: boolean;

  notice?: string | null;

  onToggleComplete: (id: string) => void;

  onEditEvent: (event: ScheduleEvent) => void;

  onForceReschedule: () => void;

  onShiftFromNow: () => void;

  canShiftFromNow: boolean;

  onDismissNotice: () => void;

}



function TaskRow({

  event,

  use24Hour,

  isToday,

  onToggleComplete,

  onEditEvent,

}: {

  event: ScheduleEvent;

  use24Hour: boolean;

  isToday: boolean;

  onToggleComplete: (id: string) => void;

  onEditEvent: (event: ScheduleEvent) => void;

}) {

  const colors = COLOR_MAP[event.color];

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

  onForceReschedule,

  onShiftFromNow,

  canShiftFromNow,

  onDismissNotice,

}: DayTaskListProps) {

  const { use24Hour } = settings;

  const taskEvents = events.filter((e) => !isAuxiliaryEvent(e));

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

          {isToday && (

            <TouchableOpacity

              style={[styles.shiftBtn, !canShiftFromNow && styles.actionBtnDisabled]}

              onPress={onShiftFromNow}

              disabled={!canShiftFromNow}

            >

              <Text style={styles.shiftBtnText}>▶ 今から</Text>

            </TouchableOpacity>

          )}

          <TouchableOpacity style={styles.rescheduleBtn} onPress={onForceReschedule}>

            <Text style={styles.rescheduleBtnText}>↻ 再配置</Text>

          </TouchableOpacity>

        </View>

        <Text style={styles.headerPct}>{Math.round(progress * 100)}%</Text>

      </View>



      {notice ? (

        <TouchableOpacity style={styles.notice} onPress={onDismissNotice}>

          <Text style={styles.noticeText}>{notice}</Text>

        </TouchableOpacity>

      ) : null}

      <View style={styles.progressTrack}>

        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />

      </View>



      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>

        {taskEvents.map((event, index) => (

          <View key={event.id}>

            <TaskRow

              event={event}

              use24Hour={use24Hour}

              isToday={isToday}

              onToggleComplete={onToggleComplete}

              onEditEvent={onEditEvent}

            />

            {index < taskEvents.length - 1 && <View style={styles.divider} />}

          </View>

        ))}

      </ScrollView>

    </View>

  );

}



const TIME_COL_WIDTH = 58;



const styles = StyleSheet.create({

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

  shiftBtn: {

    backgroundColor: theme.bg,

    paddingHorizontal: 10,

    paddingVertical: 6,

    borderRadius: 999,

    borderWidth: 1,

    borderColor: theme.accentSoft,

  },

  shiftBtnText: { fontSize: 12, fontWeight: '700', color: theme.text },

  actionBtnDisabled: { opacity: 0.4 },

  rescheduleBtn: {

    backgroundColor: theme.accentSoft,

    paddingHorizontal: 10,

    paddingVertical: 6,

    borderRadius: 999,

    marginBottom: 2,

  },

  rescheduleBtnText: { fontSize: 12, fontWeight: '700', color: theme.accent },

  notice: {

    marginHorizontal: 16,

    marginBottom: 8,

    backgroundColor: theme.accentSoft,

    borderRadius: theme.radius.sm,

    padding: 10,

  },

  noticeText: { fontSize: 12, color: theme.accent, lineHeight: 18 },

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

    backgroundColor: 'rgba(255,59,48,0.12)',

    paddingHorizontal: 8,

    paddingVertical: 3,

    borderRadius: 999,

  },

  overdueText: { fontSize: 11, fontWeight: '700', color: theme.destructive },

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


