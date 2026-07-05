import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { DayPlan } from '../../types/dayPlan';
import { AppSettings } from '../../types/schedule';
import { Task } from '../../types/task';
import { useCoach } from '../../hooks/useCoach';
import {
  ApplyCoachScheduleDeps,
  CoachReplySource,
  CoachScheduleAction,
} from '../../intelligence/coach/types';
import { BottomSheetDragHandle } from '../common/BottomSheetDragHandle';
import { modalAnimation } from '../common/modalAnimation';
import { useBottomSheetDismiss } from '../common/useBottomSheetDismiss';
import { Theme, useTheme, useThemedStyles } from '../../theme';

interface CoachModalProps {
  isOpen: boolean;
  plan: DayPlan | null;
  tasks: Task[];
  scheduleDeps: ApplyCoachScheduleDeps;
  settings: AppSettings | null;
  onClose: () => void;
  onScheduleApplied?: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  source?: CoachReplySource;
  action?: CoachScheduleAction;
}

const SUGGESTIONS = [
  '英語の勉強を登録して',
  '片付け、何から始めればいい？',
  '今日は疲れてる',
];

export function CoachModal({
  isOpen,
  plan,
  tasks,
  scheduleDeps,
  settings,
  onClose,
  onScheduleApplied,
}: CoachModalProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { aiEnabled, explain, consult, applyScheduleAction } = useCoach(scheduleDeps, settings);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<CoachScheduleAction | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInput('');
      setLoading(false);
      setPendingAction(null);
      return;
    }

    if (!aiEnabled) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    explain(plan, tasks)
      .then((reply) => {
        if (!cancelled) {
          setMessages([{ role: 'assistant', text: reply.text, source: reply.source }]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const appendAssistant = (text: string, action?: CoachScheduleAction, source?: CoachReplySource) => {
    setMessages((prev) => [...prev, { role: 'assistant', text, action, source }]);
  };

  const runScheduleAction = async (action: CoachScheduleAction) => {
    setLoading(true);
    try {
      const result = await applyScheduleAction(action);
      setPendingAction(null);
      appendAssistant(result.message, undefined, 'local');
      if (result.result === 'applied') {
        onScheduleApplied?.();
      }
    } catch {
      appendAssistant('予定への組み込みに失敗しました。もう一度お試しください。', undefined, 'local');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (reply: Awaited<ReturnType<typeof consult>>) => {
    appendAssistant(reply.text, reply.action, reply.source);

    if (!reply.action) {
      return;
    }

    if (reply.action.autoApply) {
      await runScheduleAction(reply.action);
      return;
    }

    setPendingAction(reply.action);
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) {
      return;
    }

    const history = messages.map(({ role, text: body }) => ({ role, text: body }));
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const reply = await consult(text, history, plan, tasks, pendingAction ?? undefined);
      if (reply.action?.autoApply) {
        setPendingAction(null);
      } else if (!reply.action && pendingAction && /見送|組み込みは/.test(reply.text)) {
        setPendingAction(null);
      }
      await handleReply(reply);
    } finally {
      setLoading(false);
    }
  };

  const { translateY, panHandlers } = useBottomSheetDismiss(isOpen, onClose);

  return (
    <Modal visible={isOpen} animationType={modalAnimation('slide')} transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <BottomSheetDragHandle panHandlers={panHandlers} onClose={onClose}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>AIコーチ</Text>
                <Text style={styles.subtitle}>
                  {aiEnabled
                    ? '相談・タスク登録・予定への組み込み'
                    : 'Orbit Looper AI 未設定'}
                </Text>
              </View>
              <View style={[styles.badge, aiEnabled ? styles.badgeOn : styles.badgeOff]}>
                <Text style={[styles.badgeText, aiEnabled ? styles.badgeTextOn : styles.badgeTextOff]}>
                  {aiEnabled ? 'AI' : '未設定'}
                </Text>
              </View>
            </View>
          </BottomSheetDragHandle>

          {!aiEnabled ? (
            <View style={styles.unavailableBody}>
              <Text style={styles.unavailableText}>
                Cloud AI プロキシまたは開発用 API キーを設定すると、AIコーチを利用できます。
              </Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeText}>閉じる</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((message, index) => (
              <View key={index}>
                <View
                  style={[
                    styles.bubble,
                    message.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      message.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
              </View>
            ))}

            {loading && (
              <View style={[styles.bubble, styles.bubbleAssistant]}>
                <ActivityIndicator color={theme.textSecondary} />
              </View>
            )}
          </ScrollView>

          <View style={styles.suggestionRow}>
            {SUGGESTIONS.map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                style={styles.suggestion}
                onPress={() => void send(suggestion)}
                disabled={loading}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="例: レポート執筆を登録して / 何から始めれば？"
              placeholderTextColor={theme.textTertiary}
              editable={!loading}
              onSubmitEditing={() => void send(input)}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (loading || !input.trim()) && styles.sendBtnDisabled]}
              onPress={() => void send(input)}
              disabled={loading || !input.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.sendText}>送信</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>閉じる</Text>
          </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      width: '100%',
      backgroundColor: theme.elevated,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      paddingHorizontal: 20,
      paddingBottom: 24,
      height: '86%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    headerText: { flex: 1, paddingRight: 12 },
    title: { fontSize: 20, fontWeight: '700', color: theme.text },
    subtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    badgeOn: { backgroundColor: theme.accentSoft },
    badgeOff: { backgroundColor: theme.secondary },
    badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    badgeTextOn: { color: theme.accent },
    badgeTextOff: { color: theme.textSecondary },
    unavailableBody: { paddingVertical: 24, paddingHorizontal: 4 },
    unavailableText: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 16,
    },
    messages: { flex: 1 },
    messagesContent: { paddingVertical: 8, gap: 10 },
    bubble: {
      maxWidth: '92%',
      borderRadius: theme.radius.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleAssistant: { alignSelf: 'flex-start', backgroundColor: theme.bg },
    bubbleUser: { alignSelf: 'flex-end', backgroundColor: theme.accent },
    bubbleText: { fontSize: 14, lineHeight: 21 },
    bubbleTextAssistant: { color: theme.text },
    bubbleTextUser: { color: theme.onAccent },
    suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
    suggestion: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.separator,
      backgroundColor: theme.bg,
    },
    suggestionText: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: {
      flex: 1,
      backgroundColor: theme.bg,
      borderRadius: theme.radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
    },
    sendBtn: {
      backgroundColor: theme.accent,
      borderRadius: theme.radius.sm,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    sendBtnDisabled: { opacity: 0.5 },
    sendText: { color: theme.onAccent, fontWeight: '700', fontSize: 14 },
    closeBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
    closeText: { color: theme.textSecondary, fontSize: 15, fontWeight: '500' },
  });
