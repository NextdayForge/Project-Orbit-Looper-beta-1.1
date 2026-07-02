import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AiTaskInput, PRIORITY_SHORT, TASK_DURATION_OPTIONS, TaskPriority } from '../types/schedule';
import { parseBulkLines } from '../presentation/calendar/bulkTaskInput';
import { formatDateHeader } from '../utils/time';
import { BottomSheetDragHandle } from './common/BottomSheetDragHandle';
import { useBottomSheetDismiss } from './common/useBottomSheetDismiss';
import { Theme, useTheme, useThemedStyles } from '../theme';

interface TaskDraft {
  id: string;
  title: string;
  priority: TaskPriority;
  showPriority: boolean;
  estimatedMinutes?: number;
  showDuration: boolean;
}

interface AiScheduleModalProps {
  isOpen: boolean;
  targetDate: Date;
  isLoading: boolean;
  onClose: () => void;
  onGenerate: (tasks: AiTaskInput[]) => Promise<void>;
}

const PRIORITIES: TaskPriority[] = [1, 2, 3, 4, 5];

function emptyTask(): TaskDraft {
  return {
    id: `draft-${Date.now()}-${Math.random()}`,
    title: '',
    priority: 3,
    showPriority: false,
    showDuration: false,
  };
}

export function AiScheduleModal({
  isOpen,
  targetDate,
  isLoading,
  onClose,
  onGenerate,
}: AiScheduleModalProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [bulkText, setBulkText] = useState('');
  const [tasks, setTasks] = useState<TaskDraft[]>([emptyTask()]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setBulkText('');
      setTasks([emptyTask()]);
      setShowAdvanced(false);
    }
  }, [isOpen]);

  const updateTask = (id: string, patch: Partial<TaskDraft>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const addTask = () => setTasks((prev) => [...prev, emptyTask()]);

  const removeTask = (id: string) => {
    setTasks((prev) => (prev.length <= 1 ? prev : prev.filter((t) => t.id !== id)));
  };

  const payload = useMemo((): AiTaskInput[] => {
    const fromBulk = parseBulkLines(bulkText);
    if (fromBulk.length > 0) {
      return fromBulk;
    }

    return tasks
      .map((task) => ({
        title: task.title.trim(),
        priority: task.priority,
        ...(task.estimatedMinutes ? { estimatedMinutes: task.estimatedMinutes } : {}),
      }))
      .filter((task) => task.title.length > 0);
  }, [bulkText, tasks]);

  const handleGenerate = () => {
    if (isLoading) {
      return;
    }
    if (payload.length === 0) {
      Alert.alert('タスクを入力してください', '1行に1タスク、または詳細入力でタスク名を追加してください。');
      return;
    }
    Keyboard.dismiss();
    void onGenerate(payload);
  };

  const handleClose = () => {
    if (isLoading) {
      return;
    }
    Keyboard.dismiss();
    onClose();
  };
  const { translateY, panHandlers } = useBottomSheetDismiss(isOpen, handleClose, isLoading);

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
          style={styles.sheetAvoider}
        >
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panHandlers}>
            <SafeAreaView edges={['bottom']} style={styles.sheetInner}>
              <BottomSheetDragHandle>
                <Text style={styles.title}>AIスケジュール作成</Text>
                <Text style={styles.date}>{formatDateHeader(targetDate)}</Text>
                <Text style={styles.desc}>
                  1行に1タスクで入力すると早いです。末尾に「30分」のように書くと所要時間を指定できます（未指定はAIが推定します）。
                </Text>
              </BottomSheetDragHandle>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sectionLabel}>タスクを入力</Text>
              <TextInput
                style={styles.bulkInput}
                placeholder={'例:\n英語の過去問 30分\nプログラミング課題\n買い物'}
                placeholderTextColor={theme.textTertiary}
                value={bulkText}
                onChangeText={setBulkText}
                editable={!isLoading}
                multiline
                textAlignVertical="top"
                blurOnSubmit={false}
              />

              <TouchableOpacity
                style={styles.advancedToggle}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowAdvanced((prev) => !prev);
                }}
                disabled={isLoading}
              >
                <Text style={styles.advancedToggleText}>
                  {showAdvanced ? '詳細入力を閉じる' : 'または1件ずつ詳細設定（優先度）'}
                </Text>
              </TouchableOpacity>

              {showAdvanced &&
                tasks.map((task, index) => (
                  <View key={task.id} style={styles.taskCard}>
                    <View style={styles.taskHeader}>
                      <Text style={styles.taskNum}>詳細 {index + 1}</Text>
                      {tasks.length > 1 && (
                        <TouchableOpacity onPress={() => removeTask(task.id)} disabled={isLoading}>
                          <Text style={styles.removeText}>削除</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={styles.taskInput}
                      placeholder="タスク名"
                      placeholderTextColor={theme.textTertiary}
                      value={task.title}
                      onChangeText={(v) => updateTask(task.id, { title: v })}
                      editable={!isLoading}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      onPress={() => updateTask(task.id, { showPriority: !task.showPriority })}
                      disabled={isLoading}
                    >
                      <Text style={styles.priorityToggle}>
                        {task.showPriority ? '優先度を隠す' : '優先度を設定'}
                      </Text>
                    </TouchableOpacity>
                    {task.showPriority && (
                      <View style={styles.priorityRow}>
                        {PRIORITIES.map((p) => (
                          <TouchableOpacity
                            key={p}
                            style={[styles.priorityBtn, task.priority === p && styles.priorityBtnActive]}
                            onPress={() => updateTask(task.id, { priority: p })}
                            disabled={isLoading}
                          >
                            <Text
                              style={[
                                styles.priorityBtnText,
                                task.priority === p && styles.priorityBtnTextActive,
                              ]}
                            >
                              {PRIORITY_SHORT[p]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => updateTask(task.id, { showDuration: !task.showDuration })}
                      disabled={isLoading}
                    >
                      <Text style={styles.priorityToggle}>
                        {task.showDuration ? '所要時間を隠す' : 'どれくらいかかりそう？'}
                      </Text>
                    </TouchableOpacity>
                    {task.showDuration && (
                      <View style={styles.durationRow}>
                        <TouchableOpacity
                          style={[
                            styles.durationBtn,
                            task.estimatedMinutes == null && styles.durationBtnActive,
                          ]}
                          onPress={() => updateTask(task.id, { estimatedMinutes: undefined })}
                          disabled={isLoading}
                        >
                          <Text
                            style={[
                              styles.durationBtnText,
                              task.estimatedMinutes == null && styles.durationBtnTextActive,
                            ]}
                          >
                            おまかせ
                          </Text>
                        </TouchableOpacity>
                        {TASK_DURATION_OPTIONS.map((minutes) => (
                          <TouchableOpacity
                            key={minutes}
                            style={[
                              styles.durationBtn,
                              task.estimatedMinutes === minutes && styles.durationBtnActive,
                            ]}
                            onPress={() => updateTask(task.id, { estimatedMinutes: minutes })}
                            disabled={isLoading}
                          >
                            <Text
                              style={[
                                styles.durationBtnText,
                                task.estimatedMinutes === minutes && styles.durationBtnTextActive,
                              ]}
                            >
                              {minutes}分
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ))}

              {showAdvanced && (
                <TouchableOpacity style={styles.addBtn} onPress={addTask} disabled={isLoading}>
                  <Text style={styles.addBtnText}>+ 詳細入力を追加</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.generateBtn, isLoading && styles.generateBtnDisabled]}
                onPress={handleGenerate}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.onAccent} />
                ) : (
                  <Text style={styles.generateBtnText}>
                    ✦ 配置する{payload.length > 0 ? `（${payload.length}件）` : ''}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={isLoading}>
                <Text style={styles.cancelBtnText}>キャンセル</Text>
              </TouchableOpacity>
            </View>
            </SafeAreaView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheetAvoider: {
      maxHeight: '92%',
    },
    sheet: {
      backgroundColor: theme.elevated,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      maxHeight: '100%',
    },
    sheetInner: {
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    title: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 4 },
    date: { fontSize: 14, color: theme.accent, fontWeight: '600', marginBottom: 6 },
    desc: { fontSize: 13, color: theme.textSecondary, lineHeight: 20, marginBottom: 12 },
    scroll: {
      flexGrow: 0,
      flexShrink: 1,
      maxHeight: 320,
    },
    scrollContent: { paddingBottom: 12 },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 8 },
    bulkInput: {
      backgroundColor: theme.bg,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.separator,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      minHeight: 140,
      lineHeight: 22,
    },
    advancedToggle: { paddingVertical: 12, alignItems: 'center' },
    advancedToggleText: { fontSize: 12, fontWeight: '600', color: theme.textTertiary },
    taskCard: {
      backgroundColor: theme.bg,
      borderRadius: theme.radius.sm,
      padding: 12,
      marginBottom: 10,
    },
    taskHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    taskNum: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
    removeText: { fontSize: 12, color: theme.destructive, fontWeight: '600' },
    taskInput: {
      backgroundColor: theme.elevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.separator,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.text,
    },
    priorityToggle: { fontSize: 12, fontWeight: '600', color: theme.accent, marginTop: 10 },
    priorityRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
    priorityBtn: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.elevated,
      alignItems: 'center',
    },
    priorityBtnActive: { backgroundColor: theme.accent },
    priorityBtnText: { fontSize: 11, fontWeight: '700', color: theme.textSecondary },
    priorityBtnTextActive: { color: theme.onAccent },
    durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    durationBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
      backgroundColor: theme.elevated,
    },
    durationBtnActive: { backgroundColor: theme.accent },
    durationBtnText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
    durationBtnTextActive: { color: theme.onAccent },
    addBtn: {
      borderWidth: 1,
      borderColor: theme.separator,
      borderRadius: theme.radius.sm,
      paddingVertical: 10,
      alignItems: 'center',
      marginBottom: 4,
    },
    addBtnText: { color: theme.textSecondary, fontWeight: '600', fontSize: 13 },
    footer: { paddingTop: 8, flexShrink: 0 },
    generateBtn: {
      backgroundColor: theme.accent,
      borderRadius: theme.radius.sm,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 6,
    },
    generateBtnDisabled: { opacity: 0.5 },
    generateBtnText: { color: theme.onAccent, fontSize: 16, fontWeight: '700' },
    cancelBtn: { paddingVertical: 10, alignItems: 'center' },
    cancelBtnText: { color: theme.textSecondary, fontSize: 15, fontWeight: '500' },
  });
