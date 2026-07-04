import React, { useEffect, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  EVENT_COLORS,
  EventColor,
  PRIORITY_LABELS,
  TaskPriority,
} from '../types/schedule';
import { EditableCalendarEvent } from '../presentation/calendar';
import { durationLabel, minutesToTime } from '../utils/time';
import { LooperDatePickerField, LooperDurationPickerField, LooperTimePickerField } from './pickers';
import { BottomSheetDragHandle } from './common/BottomSheetDragHandle';
import { modalAnimation } from './common/modalAnimation';
import { useBottomSheetDismiss } from './common/useBottomSheetDismiss';
import { Theme, useTheme, useThemedStyles } from '../theme';

interface EventEditorProps {
  isOpen: boolean;
  event: EditableCalendarEvent | null;
  onSave: (event: EditableCalendarEvent) => void;
  onDelete?: (event: EditableCalendarEvent) => void;
  onClose: () => void;
}

export function EventEditor({
  isOpen,
  event,
  onSave,
  onDelete,
  onClose,
}: EventEditorProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startMinutes, setStartMinutes] = useState(9 * 60);
  const [endMinutes, setEndMinutes] = useState(9 * 60 + 30);
  const [color, setColor] = useState<EventColor>('blue');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(3);
  const [locked, setLocked] = useState(false);
  const { translateY, panHandlers } = useBottomSheetDismiss(isOpen, onClose);
  const isNew = event?.isNew ?? false;
  const isEditing = event != null && !isNew;
  const canEdit = event?.editable ?? true;

  useEffect(() => {
    if (!isOpen || !event) return;
    setTitle(event.title);
    setDate(event.date);
    setStartMinutes(event.startMinutes);
    setEndMinutes(event.endMinutes);
    setColor(event.color);
    setNote(event.note ?? '');
    setPriority(event.priority ?? 3);
    setLocked(event.locked ?? false);
  }, [isOpen, event]);

  const handleSave = () => {
    if (!event) return;
    if (!title.trim() || endMinutes <= startMinutes) {
      return;
    }
    onSave({
      ...event,
      date,
      title: title.trim(),
      startMinutes,
      endMinutes,
      color,
      note: note.trim() || undefined,
      priority,
      locked,
    });
  };

  const durationMinutes = endMinutes > startMinutes ? endMinutes - startMinutes : 30;
  const maxDurationMinutes = Math.max(5, 1440 - startMinutes);

  const handleStartChange = (nextStart: number) => {
    const duration = Math.max(5, endMinutes - startMinutes);
    setStartMinutes(nextStart);
    setEndMinutes(Math.min(1440, nextStart + duration));
  };

  const handleDurationChange = (nextDuration: number) => {
    setEndMinutes(Math.min(1440, startMinutes + nextDuration));
  };

  return (
    <Modal visible={isOpen} animationType={modalAnimation('slide')} transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panHandlers}>
          <BottomSheetDragHandle />
          <View style={styles.sheetBody}>
            <Text style={styles.sheetTitle}>{isEditing ? '予定を編集' : '新しい予定'}</Text>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>タイトル</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="予定名"
              placeholderTextColor={theme.textTertiary}
              editable={canEdit}
            />

            <Text style={styles.label}>日付</Text>
            <LooperDatePickerField
              label="実行日"
              value={date}
              variant="fill"
              disabled={!canEdit}
              onChange={setDate}
            />

            <Text style={styles.label}>時間</Text>
            <View style={styles.pickerStack}>
              <View style={styles.timeRow}>
                <View style={styles.half}>
                  <LooperTimePickerField
                    label="開始"
                    value={startMinutes}
                    minuteInterval={5}
                    disabled={!canEdit}
                    variant="fill"
                    onChange={handleStartChange}
                  />
                </View>
                <View style={styles.half}>
                  <LooperTimePickerField
                    label="終了"
                    value={endMinutes}
                    minuteInterval={5}
                    disabled={!canEdit}
                    variant="fill"
                    onChange={setEndMinutes}
                  />
                </View>
              </View>
              <LooperDurationPickerField
                label="所要時間"
                value={durationMinutes}
                minuteInterval={5}
                minMinutes={5}
                maxMinutes={maxDurationMinutes}
                disabled={!canEdit}
                onChange={handleDurationChange}
              />
            </View>

            {endMinutes > startMinutes && (
              <Text style={styles.durationEnd}>
                終了 {minutesToTime(endMinutes)}（{durationLabel(startMinutes, endMinutes)}）
              </Text>
            )}

            <Text style={styles.label}>カラー</Text>
            <View style={styles.colors}>
              {EVENT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: theme.eventColors[c].border },
                    color === c && styles.colorDotActive,
                    !canEdit && styles.colorDotDisabled,
                  ]}
                  onPress={() => canEdit && setColor(c)}
                  disabled={!canEdit}
                />
              ))}
            </View>

            <Text style={styles.label}>優先度</Text>
            <View style={styles.priorityRow}>
              {([1, 2, 3, 4, 5] as TaskPriority[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityChip, priority === p && styles.priorityChipActive, !canEdit && styles.priorityChipDisabled]}
                  onPress={() => canEdit && setPriority(p)}
                  disabled={!canEdit}
                >
                  <Text style={[styles.priorityChipText, priority === p && styles.priorityChipTextActive]}>
                    {PRIORITY_LABELS[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.lockRow}>
              <View>
                <Text style={styles.lockLabel}>固定予定</Text>
                <Text style={styles.lockDesc}>再配置で動かさない</Text>
              </View>
              <Switch
                value={locked}
                onValueChange={setLocked}
                disabled={!canEdit}
                trackColor={{ false: theme.secondary, true: theme.accent }}
              />
            </View>

            {!isEditing && (
              <Text style={styles.autoHint}>新規タスクは空き時間に自動配置されます</Text>
            )}

            <Text style={styles.label}>メモ（任意）</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={note}
              onChangeText={setNote}
              placeholder="詳細..."
              multiline
              placeholderTextColor={theme.textTertiary}
              editable={canEdit}
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, !canEdit && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!canEdit}
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnText}>保存</Text>
            </TouchableOpacity>

            <View style={styles.footerRow}>
              {isEditing && event && event.deletable && onDelete ? (
                <TouchableOpacity onPress={() => onDelete(event)} hitSlop={8}>
                  <Text style={styles.deleteText}>削除</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} hitSlop={8}>
                <Text style={styles.cancelBtnText}>キャンセル</Text>
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'stretch' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: theme.elevated,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    maxHeight: '90%',
    width: '100%',
    alignSelf: 'stretch',
  },
  sheetBody: {
    paddingHorizontal: 20,
    // Must be able to shrink within the sheet's maxHeight (90%) so the inner
    // ScrollView gets a bounded height and actually scrolls — without this the
    // body grows to its full content height and the footer (削除/キャンセル/保存)
    // overflows off-screen and becomes unreachable.
    flexShrink: 1,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    color: theme.text,
  },
  formScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  formContent: {
    paddingBottom: 8,
  },
  pickerStack: {
    gap: 10,
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  durationEnd: { textAlign: 'center', color: theme.accent, fontWeight: '600', marginVertical: 8 },
  label: { fontSize: 13, fontWeight: '500', color: theme.textSecondary, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: theme.bg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.text,
  },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  colors: { flexDirection: 'row', marginBottom: 8 },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'transparent',
    marginRight: 10,
  },
  colorDotActive: { borderColor: theme.text },
  colorDotDisabled: { opacity: 0.45 },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  priorityChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.bg,
  },
  priorityChipActive: { backgroundColor: theme.accent },
  priorityChipDisabled: { opacity: 0.45 },
  priorityChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  priorityChipTextActive: { color: theme.onAccent },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4,
  },
  lockLabel: { fontSize: 16, color: theme.text, fontWeight: '500' },
  lockDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  autoHint: {
    fontSize: 12,
    color: theme.accent,
    marginBottom: 8,
    backgroundColor: theme.accentSoft,
    padding: 10,
    borderRadius: theme.radius.sm,
  },
  footer: {
    flexShrink: 0,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.separator,
    gap: 10,
  },
  saveBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: theme.onAccent },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  deleteText: { color: theme.destructive, fontWeight: '600', fontSize: 15 },
  cancelBtn: {
    marginLeft: 'auto',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cancelBtnText: { color: theme.textSecondary, fontWeight: '600', fontSize: 15 },
  });
