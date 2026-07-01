import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
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
  EventColor,
  EVENT_COLORS,
  PRIORITY_LABELS,
  ScheduleEvent,
  TaskPriority,
  COLOR_MAP,
} from '../types/schedule';
import { durationLabel, minutesToTime, timeToMinutes } from '../utils/time';
import { theme } from '../theme';

interface EventEditorProps {
  isOpen: boolean;
  event: ScheduleEvent | null;
  draftStart?: number;
  draftEnd?: number;
  onSave: (data: {
    title: string;
    startMinutes: number;
    endMinutes: number;
    color: EventColor;
    note?: string;
    priority?: TaskPriority;
    locked?: boolean;
  }) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const DISMISS_DRAG_THRESHOLD = 72;
const DISMISS_VELOCITY = 0.45;

export function EventEditor({
  isOpen,
  event,
  draftStart,
  draftEnd,
  onSave,
  onDelete,
  onClose,
}: EventEditorProps) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:30');
  const [color, setColor] = useState<EventColor>('blue');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(3);
  const [locked, setLocked] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      translateY.setValue(0);
    }
  }, [isOpen, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            translateY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > DISMISS_DRAG_THRESHOLD || gesture.vy > DISMISS_VELOCITY) {
            Animated.timing(translateY, {
              toValue: 320,
              duration: 180,
              useNativeDriver: true,
            }).start(onClose);
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
      }),
    [onClose, translateY]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (event) {
      setTitle(event.title);
      setStartTime(minutesToTime(event.startMinutes));
      setEndTime(minutesToTime(event.endMinutes));
      setColor(event.color);
      setNote(event.note ?? '');
      setPriority(event.priority ?? 3);
      setLocked(event.locked ?? false);
    } else if (draftStart != null) {
      setTitle('');
      setStartTime(minutesToTime(draftStart));
      setEndTime(minutesToTime(draftEnd ?? draftStart + 30));
      setColor('blue');
      setNote('');
      setPriority(3);
      setLocked(false);
    }
  }, [isOpen, event, draftStart, draftEnd]);

  const handleSave = () => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (!title.trim() || endMinutes <= startMinutes) return;
    onSave({
      title: title.trim(),
      startMinutes,
      endMinutes,
      color,
      note: note.trim() || undefined,
      priority,
      locked,
    });
  };

  const startM = timeToMinutes(startTime);
  const endM = timeToMinutes(endTime);
  const durationMinutes = Number.isFinite(startM) && endM > startM ? endM - startM : 30;

  const adjustDuration = (delta: number) => {
    if (!Number.isFinite(startM)) return;
    const next = Math.max(5, durationMinutes + delta);
    setEndTime(minutesToTime(Math.min(1440, startM + next)));
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.dragZone} {...panResponder.panHandlers}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{event ? '予定を編集' : '新しい予定'}</Text>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>タイトル</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="予定名"
              placeholderTextColor={theme.textTertiary}
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>開始 (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="09:00"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>終了 (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="09:30"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <Text style={styles.label}>所要時間</Text>
            <View style={styles.durationRow}>
              <TouchableOpacity
                style={[styles.durationBtn, durationMinutes <= 5 && styles.durationBtnDisabled]}
                onPress={() => adjustDuration(-5)}
                disabled={durationMinutes <= 5}
              >
                <Text style={styles.durationBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.durationValue}>{durationLabel(0, durationMinutes)}</Text>
              <TouchableOpacity
                style={[styles.durationBtn, startM + durationMinutes + 5 > 1440 && styles.durationBtnDisabled]}
                onPress={() => adjustDuration(5)}
                disabled={!Number.isFinite(startM) || startM + durationMinutes + 5 > 1440}
              >
                <Text style={styles.durationBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {event && (
              <Text style={styles.durationHint}>保存すると、この予定以降のスケジュールも連動してずれます</Text>
            )}
            {Number.isFinite(startM) && endM > startM && (
              <Text style={styles.durationEnd}>
                終了 {minutesToTime(endM)}（{durationLabel(startM, endM)}）
              </Text>
            )}

            <Text style={styles.label}>カラー</Text>
            <View style={styles.colors}>
              {EVENT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: COLOR_MAP[c].border },
                    color === c && styles.colorDotActive,
                  ]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>

            <Text style={styles.label}>優先度</Text>
            <View style={styles.priorityRow}>
              {([1, 2, 3, 4, 5] as TaskPriority[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityChip, priority === p && styles.priorityChipActive]}
                  onPress={() => setPriority(p)}
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
              <Switch value={locked} onValueChange={setLocked} trackColor={{ false: theme.secondary, true: theme.accent }} />
            </View>

            {!event && (
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
            />

            <View style={styles.actions}>
              {event && onDelete && (
                <TouchableOpacity onPress={() => onDelete(event.id)}>
                  <Text style={styles.deleteText}>削除</Text>
                </TouchableOpacity>
              )}
              <View style={styles.actionsRight}>
                <TouchableOpacity style={styles.btnSecondary} onPress={onClose}>
                  <Text style={styles.btnSecondaryText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleSave}>
                  <Text style={styles.btnPrimaryText}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: theme.elevated,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  dragZone: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 5,
    backgroundColor: theme.secondary,
    borderRadius: 3,
    marginTop: 12,
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: theme.text, alignSelf: 'stretch' },
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
  row: { flexDirection: 'row' },
  half: { flex: 1, marginRight: 6 },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 4,
  },
  durationBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBtnDisabled: { opacity: 0.35 },
  durationBtnText: { fontSize: 22, fontWeight: '700', color: theme.accent },
  durationValue: { fontSize: 18, fontWeight: '700', color: theme.text, minWidth: 72, textAlign: 'center' },
  durationHint: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  durationEnd: { textAlign: 'center', color: theme.accent, fontWeight: '600', marginVertical: 8 },
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
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  priorityChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.bg,
  },
  priorityChipActive: { backgroundColor: theme.accent },
  priorityChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  priorityChipTextActive: { color: '#fff' },
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
  },
  actionsRight: { flexDirection: 'row', marginLeft: 'auto' },
  deleteText: { color: theme.destructive, fontWeight: '600', fontSize: 15 },
  btnSecondary: {
    backgroundColor: theme.secondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    marginRight: 8,
  },
  btnSecondaryText: { fontWeight: '600', color: theme.text },
  btnPrimary: {
    backgroundColor: theme.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
  },
  btnPrimaryText: { fontWeight: '600', color: '#fff' },
});
