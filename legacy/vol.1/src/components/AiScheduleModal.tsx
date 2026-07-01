import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { AiTaskInput, PRIORITY_SHORT, TaskPriority } from '../types/schedule';
import { formatDateHeader } from '../utils/time';
import { theme } from '../theme';

interface TaskDraft {
  id: string;
  title: string;
  priority: TaskPriority;
}

interface AiScheduleModalProps {
  isOpen: boolean;
  targetDate: Date;
  isLoading: boolean;
  onClose: () => void;
  onGenerate: (tasks: AiTaskInput[]) => void;
}

const PRIORITIES: TaskPriority[] = [1, 2, 3, 4, 5];

function emptyTask(): TaskDraft {
  return { id: `draft-${Date.now()}-${Math.random()}`, title: '', priority: 3 };
}

export function AiScheduleModal({
  isOpen,
  targetDate,
  isLoading,
  onClose,
  onGenerate,
}: AiScheduleModalProps) {
  const [tasks, setTasks] = useState<TaskDraft[]>([emptyTask()]);

  useEffect(() => {
    if (!isOpen) setTasks([emptyTask()]);
  }, [isOpen]);

  const updateTask = (id: string, patch: Partial<TaskDraft>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const addTask = () => setTasks((prev) => [...prev, emptyTask()]);

  const removeTask = (id: string) => {
    setTasks((prev) => (prev.length <= 1 ? prev : prev.filter((t) => t.id !== id)));
  };

  const validTasks = tasks.filter((t) => t.title.trim());

  const handleGenerate = () => {
    if (validTasks.length === 0 || isLoading) return;
    onGenerate(validTasks.map((t) => ({ title: t.title.trim(), priority: t.priority })));
  };

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>AIスケジュール作成</Text>
          <Text style={styles.date}>{formatDateHeader(targetDate)}</Text>
          <Text style={styles.desc}>タスクと優先度を入力して、空き時間に自動配置します。</Text>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {tasks.map((task, index) => (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.taskHeader}>
                  <Text style={styles.taskNum}>タスク {index + 1}</Text>
                  {tasks.length > 1 && (
                    <TouchableOpacity onPress={() => removeTask(task.id)} disabled={isLoading}>
                      <Text style={styles.removeText}>削除</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={styles.taskInput}
                  placeholder="例: 英語の過去問"
                  placeholderTextColor={theme.textTertiary}
                  value={task.title}
                  onChangeText={(v) => updateTask(task.id, { title: v })}
                  editable={!isLoading}
                />
                <Text style={styles.priorityLabel}>優先度</Text>
                <View style={styles.priorityRow}>
                  {PRIORITIES.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.priorityBtn, task.priority === p && styles.priorityBtnActive]}
                      onPress={() => updateTask(task.id, { priority: p })}
                      disabled={isLoading}
                    >
                      <Text
                        style={[styles.priorityBtnText, task.priority === p && styles.priorityBtnTextActive]}
                      >
                        {PRIORITY_SHORT[p]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addBtn} onPress={addTask} disabled={isLoading}>
              <Text style={styles.addBtnText}>+ タスクを追加</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              ・既存予定は削除されず、空き時間に追加されます{'\n'}
              ・全削除する場合のみ「全削除」と入力して生成
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.generateBtn, (validTasks.length === 0 || isLoading) && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={validTasks.length === 0 || isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.generateBtnText}>✨ AIでスケジュール作成</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={isLoading}>
            <Text style={styles.cancelBtnText}>キャンセル</Text>
          </TouchableOpacity>
        </View>
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
    maxHeight: '92%',
  },
  handle: {
    width: 36,
    height: 5,
    backgroundColor: theme.secondary,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 4 },
  date: { fontSize: 14, color: theme.accent, fontWeight: '600', marginBottom: 8 },
  desc: { fontSize: 13, color: theme.textSecondary, lineHeight: 20, marginBottom: 12 },
  list: { maxHeight: 340, marginBottom: 12 },
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.text,
    marginBottom: 10,
  },
  priorityLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 6 },
  priorityRow: { flexDirection: 'row', gap: 4 },
  priorityBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.elevated,
    alignItems: 'center',
  },
  priorityBtnActive: { backgroundColor: theme.accent },
  priorityBtnText: { fontSize: 11, fontWeight: '700', color: theme.textSecondary },
  priorityBtnTextActive: { color: '#fff' },
  addBtn: {
    borderWidth: 1,
    borderColor: theme.accentSoft,
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 4,
  },
  addBtnText: { color: theme.accent, fontWeight: '700', fontSize: 14 },
  hintBox: {
    backgroundColor: theme.accentSoft,
    borderRadius: theme.radius.sm,
    padding: 12,
    marginBottom: 16,
  },
  hintText: { fontSize: 12, color: theme.accent, lineHeight: 20 },
  generateBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius.sm,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: theme.textSecondary, fontSize: 15, fontWeight: '500' },
});
