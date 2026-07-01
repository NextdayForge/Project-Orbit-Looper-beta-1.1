import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppSettings, ScheduleEvent } from '../types/schedule';
import {
  clampMinutes,
  formatDateHeader,
  isSameDay,
  layoutDayEvents,
  snapToMinutes,
} from '../utils/time';
import { TimelineCanvas } from './EventBlock';
import { DayTaskList } from './DayTaskList';
import { theme } from '../theme';

interface DayTimelineProps {
  date: Date;
  events: ScheduleEvent[];
  settings: AppSettings;
  onBack: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onCreateSlot: (startMinutes: number, endMinutes: number) => void;
  onEditEvent: (event: ScheduleEvent) => void;
  onToggleComplete: (id: string) => void;
  onForceReschedule: () => void;
  onShiftFromNow: () => void;
  canShiftFromNow: boolean;
  onDismissNotice: () => void;
  rescheduleNotice?: string | null;
  onAiSchedule: () => void;
}

export function DayTimeline({
  date,
  events,
  settings,
  onBack,
  onPrevDay,
  onNextDay,
  onCreateSlot,
  onEditEvent,
  onToggleComplete,
  onForceReschedule,
  onShiftFromNow,
  canShiftFromNow,
  onDismissNotice,
  rescheduleNotice,
  onAiSchedule,
}: DayTimelineProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const { pxPerMinute, minEventHeightPx, use24Hour } = settings;
  const totalHeight = 24 * 60 * pxPerMinute;
  const layouts = layoutDayEvents(events, pxPerMinute, minEventHeightPx);
  const isToday = isSameDay(date, new Date());
  const dayLabel = date.toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  useEffect(() => {
    if (!timelineOpen) return;
    const y = isToday
      ? Math.max(0, (new Date().getHours() * 60 + new Date().getMinutes()) * pxPerMinute - 120)
      : events.length > 0
        ? Math.max(0, events[0].startMinutes * pxPerMinute - 60)
        : 8 * 60 * pxPerMinute;
    setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 100);
  }, [date, isToday, pxPerMinute, events, timelineOpen]);

  const handleTimelinePress = (locationY: number) => {
    const minutes = clampMinutes(snapToMinutes(locationY / pxPerMinute, 5));
    onCreateSlot(minutes, minutes + settings.defaultDurationMinutes);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backIcon}>{'<'}</Text>
          <Text style={styles.backText}>カレンダー</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.aiBtn} onPress={onAiSchedule}>
          <Text style={styles.aiBtnText}>✨ AI</Text>
        </TouchableOpacity>
        <View style={styles.dateNav}>
          <TouchableOpacity style={styles.arrowBtn} onPress={onPrevDay}>
            <Text style={styles.arrow}>{'<'}</Text>
          </TouchableOpacity>
          <View style={styles.dateCenter}>
            <Text style={styles.dateTitle}>{dayLabel}</Text>
            {isToday && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeText}>今日</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.arrowBtn} onPress={onNextDay}>
            <Text style={styles.arrow}>{'>'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <DayTaskList
        events={events}
        settings={settings}
        isToday={isToday}
        notice={rescheduleNotice}
        onToggleComplete={onToggleComplete}
        onEditEvent={onEditEvent}
        onForceReschedule={onForceReschedule}
        onShiftFromNow={onShiftFromNow}
        canShiftFromNow={canShiftFromNow}
        onDismissNotice={onDismissNotice}
      />

      <TouchableOpacity
        style={styles.timelineToggle}
        onPress={() => setTimelineOpen((v) => !v)}
        activeOpacity={0.8}
      >
        <Text style={styles.timelineToggleText}>タイムライン</Text>
        <Text style={styles.timelineToggleSub}>{formatDateHeader(date)}</Text>
        <Text style={styles.timelineChevron}>{timelineOpen ? '▼' : '▲'}</Text>
      </TouchableOpacity>

      {timelineOpen && (
        <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator>
          <View style={[styles.grid, { height: totalHeight }]}>
            <View style={styles.hoursCol}>
              {hours.map((h) => (
                <Text key={h} style={[styles.hourLabel, { top: h * 60 * pxPerMinute }]}>
                  {use24Hour
                    ? `${String(h).padStart(2, '0')}:00`
                    : `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`}
                </Text>
              ))}
            </View>

            <TimelineCanvas
              totalHeight={totalHeight}
              pxPerMinute={pxPerMinute}
              use24Hour={use24Hour}
              isToday={isToday}
              layouts={layouts}
              onCanvasLayout={() => {}}
              onCanvasPress={handleTimelinePress}
              onEditEvent={onEditEvent}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  navBar: {
    backgroundColor: theme.elevated,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, marginBottom: 8 },
  aiBtn: {
    position: 'absolute',
    right: 12,
    top: 8,
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  aiBtnText: { fontSize: 13, fontWeight: '700', color: theme.accent },
  backIcon: { fontSize: 20, color: theme.accent, fontWeight: '600', marginRight: 4 },
  backText: { fontSize: 16, color: theme.accent, fontWeight: '500' },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrowBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 20, color: theme.accent, fontWeight: '600' },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  todayBadge: {
    marginTop: 4,
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  todayBadgeText: { fontSize: 11, fontWeight: '600', color: theme.accent },
  timelineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.separator,
  },
  timelineToggleText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  timelineToggleSub: { flex: 1, fontSize: 12, color: theme.textTertiary, marginLeft: 8 },
  timelineChevron: { fontSize: 11, color: theme.textTertiary },
  scroll: { flex: 1, maxHeight: 280 },
  grid: { flexDirection: 'row', paddingBottom: 24 },
  hoursCol: { width: 52 },
  hourLabel: {
    position: 'absolute',
    right: 8,
    fontSize: 11,
    fontWeight: '500',
    color: theme.textSecondary,
  },
});
