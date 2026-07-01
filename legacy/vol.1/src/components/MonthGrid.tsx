import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppSettings } from '../types/schedule';
import { addMonths, getMonthGrid, isSameDay, toDateKey } from '../utils/time';
import { theme } from '../theme';

interface MonthGridProps {
  viewMonth: Date;
  selectedDate: Date;
  eventCountByDate: Map<string, number>;
  settings: AppSettings;
  onOpenDay: (date: Date) => void;
  onChangeMonth: (date: Date) => void;
  onGoToday: () => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function MonthGrid({
  viewMonth,
  selectedDate,
  eventCountByDate,
  settings,
  onOpenDay,
  onChangeMonth,
  onGoToday,
}: MonthGridProps) {
  const grid = getMonthGrid(viewMonth, settings.weekStartsOn);
  const today = new Date();
  const monthLabel = viewMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
  const weekdays =
    settings.weekStartsOn === 1 ? [...WEEKDAYS.slice(1), WEEKDAYS[0]] : WEEKDAYS;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.navBtn} onPress={() => onChangeMonth(addMonths(viewMonth, -1))}>
          <Text style={styles.navText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{monthLabel}</Text>
          <TouchableOpacity style={styles.todayBtn} onPress={onGoToday}>
            <Text style={styles.todayText}>今日</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={() => onChangeMonth(addMonths(viewMonth, 1))}>
          <Text style={styles.navText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekdays}>
        {weekdays.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.days}>
        {grid.map((date) => {
          const key = toDateKey(date);
          const inMonth = date.getMonth() === viewMonth.getMonth();
          const selected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);
          const count = eventCountByDate.get(key) ?? 0;

          return (
            <TouchableOpacity
              key={key}
              style={[styles.day, selected && styles.daySelected]}
              onPress={() => onOpenDay(date)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dayNum,
                  !inMonth && styles.dayOutside,
                  isToday && !selected && styles.dayToday,
                  selected && styles.dayNumSelected,
                ]}
              >
                {date.getDate()}
              </Text>
              {count > 0 && (
                <View style={styles.dots}>
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <View key={i} style={[styles.dot, selected && styles.dotSelected]} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.elevated,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 28, color: theme.accent, fontWeight: '300' },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: theme.text },
  todayBtn: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.accentSoft,
  },
  todayText: { fontSize: 13, fontWeight: '600', color: theme.accent },
  weekdays: { flexDirection: 'row', marginBottom: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
    paddingVertical: 4,
  },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  day: {
    width: '14.2857%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 6,
  },
  daySelected: { backgroundColor: theme.accent },
  dayNum: { fontSize: 16, fontWeight: '500', color: theme.text },
  dayOutside: { color: theme.textTertiary },
  dayToday: { color: theme.accent, fontWeight: '700' },
  dayNumSelected: { color: '#fff', fontWeight: '700' },
  dots: { flexDirection: 'row', marginTop: 3, height: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.accent, marginHorizontal: 1 },
  dotSelected: { backgroundColor: '#fff' },
});
