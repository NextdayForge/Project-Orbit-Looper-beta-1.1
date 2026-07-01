import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppSettings } from '../../types/schedule';
import { RoutineTemplate, WEEKDAY_LABELS } from '../../types/routine';
import { SaveRoutineInput } from '../../hooks/useScheduleActions';
import { minutesToTime, toDateKey } from '../../utils/time';
import {
  countSkipDays,
  expandDateRange,
  formatSkipEntryLabel,
  mergeSkipDateKeys,
  mergeSkipDatesForDisplay,
  removeSkipDateRange,
  SkipDateDisplayEntry,
} from '../../utils/skipDates';
import { LooperDatePickerField, LooperTimePickerField } from '../pickers';
import { FullScreenSafeArea } from '../common/FullScreenSafeArea';
import { Theme, useTheme, useThemedStyles } from '../../theme';

interface RoutineSettingsViewProps {
  isOpen: boolean;
  settings: AppSettings;
  routines: RoutineTemplate[];
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onSaveRoutine: (input: SaveRoutineInput) => void;
  onDeleteRoutine: (id: string) => void;
  onClose: () => void;
}

interface RoutineDraft {
  id?: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  weekdays: number[];
  skipDates: string[];
}

function weekdaysLabel(weekdays: number[]): string {
  if (weekdays.length === 0 || weekdays.length === 7) return '毎日';
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join('・');
}

export function RoutineSettingsView({
  isOpen,
  settings,
  routines,
  onUpdateSettings,
  onSaveRoutine,
  onDeleteRoutine,
  onClose,
}: RoutineSettingsViewProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [draft, setDraft] = useState<RoutineDraft | null>(null);
  const [skipRangeStart, setSkipRangeStart] = useState<string>(toDateKey(new Date()));
  const [skipRangeEnd, setSkipRangeEnd] = useState<string>(toDateKey(new Date()));

  const resetSkipPickers = () => {
    const today = toDateKey(new Date());
    setSkipRangeStart(today);
    setSkipRangeEnd(today);
  };

  const startNew = () => {
    resetSkipPickers();
    setDraft({
      title: '',
      startMinutes: 8 * 60,
      endMinutes: 9 * 60,
      weekdays: [1, 2, 3, 4, 5],
      skipDates: [],
    });
  };

  const startEdit = (routine: RoutineTemplate) => {
    resetSkipPickers();
    setDraft({
      id: routine.id,
      title: routine.title,
      startMinutes: routine.startMinutes,
      endMinutes: routine.endMinutes,
      weekdays: routine.weekdays,
      skipDates: routine.skipDates ?? [],
    });
  };

  const toggleWeekday = (day: number) => {
    if (!draft) return;
    const has = draft.weekdays.includes(day);
    setDraft({
      ...draft,
      weekdays: has ? draft.weekdays.filter((d) => d !== day) : [...draft.weekdays, day],
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    const title = draft.title.trim() || '固定予定';
    const endMinutes =
      draft.endMinutes > draft.startMinutes ? draft.endMinutes : draft.startMinutes + 15;
    onSaveRoutine({
      id: draft.id,
      title,
      startMinutes: draft.startMinutes,
      endMinutes,
      weekdays: draft.weekdays,
      skipDates: draft.skipDates,
    });
    setDraft(null);
  };

  const addSkipRange = () => {
    if (!draft) return;
    setDraft({
      ...draft,
      skipDates: mergeSkipDateKeys(draft.skipDates, expandDateRange(skipRangeStart, skipRangeEnd)),
    });
  };

  const removeSkipEntry = (entry: SkipDateDisplayEntry) => {
    if (!draft) return;
    if (entry.kind === 'single') {
      setDraft({ ...draft, skipDates: draft.skipDates.filter((dateKey) => dateKey !== entry.date) });
      return;
    }
    setDraft({
      ...draft,
      skipDates: removeSkipDateRange(draft.skipDates, entry.start, entry.end),
    });
  };

  const skipDisplayEntries = draft ? mergeSkipDatesForDisplay(draft.skipDates) : [];

  const toggleEnabled = (routine: RoutineTemplate) => {
    onSaveRoutine({
      id: routine.id,
      title: routine.title,
      startMinutes: routine.startMinutes,
      endMinutes: routine.endMinutes,
      weekdays: routine.weekdays,
      skipDates: routine.skipDates ?? [],
      enabled: !routine.enabled,
    });
  };

  const removeDraft = () => {
    if (draft?.id) {
      onDeleteRoutine(draft.id);
    }
    setDraft(null);
  };

  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <FullScreenSafeArea style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.headerAction}>‹ 設定</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>生活リズム</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Wake / sleep */}
          <Text style={styles.groupTitle}>起床・就寝</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>起床時刻</Text>
                <Text style={styles.rowDesc}>この時刻より前には予定を組みません</Text>
              </View>
              <LooperTimePickerField
                value={settings.wakeMinutes}
                minuteInterval={5}
                variant="inline"
                onChange={(v) => onUpdateSettings({ wakeMinutes: v })}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>就寝時刻</Text>
                <Text style={styles.rowDesc}>この時刻以降には予定を組みません</Text>
              </View>
              <LooperTimePickerField
                value={settings.sleepMinutes}
                minuteInterval={5}
                variant="inline"
                onChange={(v) => onUpdateSettings({ sleepMinutes: v })}
              />
            </View>
          </View>

          {/* Routines */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.groupTitle}>固定予定</Text>
            {!draft && (
              <TouchableOpacity onPress={startNew}>
                <Text style={styles.addLink}>＋ 追加</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.sectionNote}>
            通勤・授業・昼休みなど、毎週決まった予定を登録するとAIが必ず避けて組みます。
          </Text>

          {draft ? (
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                value={draft.title}
                onChangeText={(t) => setDraft({ ...draft, title: t })}
                placeholder="例: 大学の講義 / 通勤"
                placeholderTextColor={theme.textTertiary}
              />

              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <LooperTimePickerField
                    label="開始"
                    value={draft.startMinutes}
                    minuteInterval={5}
                    variant="fill"
                    onChange={(v) => setDraft({ ...draft, startMinutes: v })}
                  />
                </View>
                <View style={styles.timeCol}>
                  <LooperTimePickerField
                    label="終了"
                    value={draft.endMinutes}
                    minuteInterval={5}
                    variant="fill"
                    onChange={(v) => setDraft({ ...draft, endMinutes: v })}
                  />
                </View>
              </View>

              <View style={styles.weekRow}>
                {WEEKDAY_LABELS.map((label, day) => {
                  const active = draft.weekdays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.weekChip, active && styles.weekChipActive]}
                      onPress={() => toggleWeekday(day)}
                    >
                      <Text style={[styles.weekChipText, active && styles.weekChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.sectionNote}>{weekdaysLabel(draft.weekdays)}に適用</Text>

              <View style={styles.divider} />
              <Text style={styles.rowLabel}>例外日（スキップ）</Text>
              <Text style={styles.sectionNote}>
                日付をタップして選び、1日または期間（例: 6/28〜7/12）をスキップに追加できます。
              </Text>
              <View style={styles.skipPickersRow}>
                <View style={styles.skipDateCol}>
                  <LooperDatePickerField
                    label="開始"
                    value={skipRangeStart}
                    variant="fill"
                    onChange={setSkipRangeStart}
                  />
                </View>
                <Text style={styles.skipRangeSep}>〜</Text>
                <View style={styles.skipDateCol}>
                  <LooperDatePickerField
                    label="終了"
                    value={skipRangeEnd}
                    variant="fill"
                    onChange={setSkipRangeEnd}
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.skipAddBtnFull} onPress={addSkipRange}>
                <Text style={styles.skipAddText}>スキップに追加</Text>
              </TouchableOpacity>

              {skipDisplayEntries.length > 0 && (
                <View style={styles.skipChips}>
                  {skipDisplayEntries.map((entry) => (
                    <TouchableOpacity
                      key={
                        entry.kind === 'single'
                          ? entry.date
                          : `${entry.start}_${entry.end}`
                      }
                      style={styles.skipChip}
                      onPress={() => removeSkipEntry(entry)}
                    >
                      <Text style={styles.skipChipText}>{formatSkipEntryLabel(entry)} ×</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.editActions}>
                {draft.id && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={removeDraft}>
                    <Text style={styles.deleteText}>削除</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setDraft(null)}>
                  <Text style={styles.cancelText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveDraft}>
                  <Text style={styles.saveText}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : routines.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>まだ固定予定がありません。「＋ 追加」から登録できます。</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {routines.map((routine, index) => (
                <View key={routine.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.routineRow}>
                    <TouchableOpacity
                      style={styles.rowInfo}
                      onPress={() => startEdit(routine)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.rowLabel, !routine.enabled && styles.disabledText]}>
                        {routine.title}
                      </Text>
                      <Text style={styles.rowDesc}>
                        {minutesToTime(routine.startMinutes)}–{minutesToTime(routine.endMinutes)} ・{' '}
                        {weekdaysLabel(routine.weekdays)}
                        {(routine.skipDates?.length ?? 0) > 0
                          ? ` ・ 例外${countSkipDays(routine.skipDates ?? [])}日`
                          : ''}
                      </Text>
                    </TouchableOpacity>
                    <Switch
                      value={routine.enabled}
                      onValueChange={() => toggleEnabled(routine)}
                      trackColor={{ true: theme.accent, false: theme.separator }}
                      thumbColor={theme.onAccent}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </FullScreenSafeArea>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    headerAction: { fontSize: 16, color: theme.accent, fontWeight: '600', minWidth: 64 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
    headerSpacer: { minWidth: 64 },
    content: { padding: 16, paddingBottom: 48, gap: 8 },

    groupTitle: { fontSize: 15, fontWeight: '700', color: theme.text, marginTop: 12, marginBottom: 8 },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
    },
    addLink: { fontSize: 15, color: theme.accent, fontWeight: '700' },
    sectionNote: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginBottom: 8 },

    card: {
      backgroundColor: theme.elevated,
      borderRadius: theme.radius.md,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.separator,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      gap: 12,
    },
    rowInfo: { flex: 1, minWidth: 0 },
    rowLabel: { fontSize: 15, fontWeight: '600', color: theme.text },
    rowDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 3 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginVertical: 4 },
    disabledText: { color: theme.textTertiary, textDecorationLine: 'line-through' },

    routineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    chevron: { fontSize: 22, color: theme.textTertiary, fontWeight: '300' },
    emptyText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },

    input: {
      backgroundColor: theme.bg,
      borderRadius: theme.radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.separator,
    },
    timeRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginTop: 14 },
    timeCol: { flex: 1, minWidth: 0 },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
    weekChip: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.separator,
    },
    weekChipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    weekChipText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
    weekChipTextActive: { color: theme.onAccent, fontWeight: '700' },

    skipPickersRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginTop: 8,
    },
    skipDateCol: {
      flex: 1,
      minWidth: 0,
    },
    skipRangeSep: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.textSecondary,
      paddingBottom: 14,
      flexShrink: 0,
      width: 16,
      textAlign: 'center',
    },
    skipAddBtnFull: {
      marginTop: 10,
      alignSelf: 'stretch',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.accentSoft,
      backgroundColor: theme.accentSoft,
      borderRadius: theme.radius.sm,
      paddingVertical: 11,
      paddingHorizontal: 14,
    },
    skipAddText: { color: theme.accent, fontSize: 14, fontWeight: '700' },
    skipChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    skipChip: {
      backgroundColor: theme.bg,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.separator,
    },
    skipChipText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },

    editActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 18 },
    deleteBtn: { paddingVertical: 10, paddingHorizontal: 14, marginRight: 'auto' },
    deleteText: { color: theme.destructive, fontSize: 15, fontWeight: '600' },
    cancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
    cancelText: { color: theme.textSecondary, fontSize: 15, fontWeight: '600' },
    saveBtn: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 22,
    },
    saveText: { color: theme.onAccent, fontSize: 15, fontWeight: '700' },
  });
