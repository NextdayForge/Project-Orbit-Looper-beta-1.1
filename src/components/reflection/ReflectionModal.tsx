import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { Reflection } from '../../types/reflection';
import { SaveReflectionInput } from '../../hooks/useScheduleActions';
import { formatDateHeader, toDateKey } from '../../utils/time';
import { BottomSheetDragHandle } from '../common/BottomSheetDragHandle';
import { modalAnimation } from '../common/modalAnimation';
import { useBottomSheetDismiss } from '../common/useBottomSheetDismiss';
import { Theme, useTheme, useThemedStyles } from '../../theme';

interface ReflectionModalProps {
  isOpen: boolean;
  date: Date;
  existing?: Reflection | null;
  eveningQuestion?: string;
  onSave: (input: SaveReflectionInput) => Promise<void>;
  onClose: () => void;
}

const SCALE = [1, 2, 3, 4, 5];
const MOOD_LABELS = ['つらい', 'いまいち', 'ふつう', '良い', '最高'];
const ENERGY_LABELS = ['ヘトヘト', '低め', 'ふつう', '高め', '絶好調'];

function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Nightly reflection input. Saving runs the full learning chain
 * (persist → planner evaluation → LearningPipeline → UserModel update)
 * via the onSave handler, closing the daily learning loop.
 */
export function ReflectionModal({
  isOpen,
  date,
  existing,
  eveningQuestion,
  onSave,
  onClose,
}: ReflectionModalProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const scrollRef = useRef<ScrollView>(null);
  const fieldOffsets = useRef({ wins: 0, blockers: 0 });
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [wins, setWins] = useState('');
  const [blockers, setBlockers] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setMood(existing?.mood ?? 3);
    setEnergy(existing?.energy ?? 3);
    setWins((existing?.wins ?? []).join('\n'));
    setBlockers((existing?.blockers ?? []).join('\n'));
    setSaving(false);
    setSaved(false);
    setKeyboardInset(0);
  }, [isOpen, existing]);

  const dateKey = useMemo(() => toDateKey(date), [date]);

  const tryClose = () => {
    if (saving) return;
    onClose();
  };
  const { translateY, panHandlers } = useBottomSheetDismiss(isOpen, tryClose, saving);

  const scrollToField = (field: 'wins' | 'blockers') => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, fieldOffsets.current[field] - 24),
        animated: true,
      });
    }, 120);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        id: existing?.id,
        date: dateKey,
        mood,
        energy,
        wins: linesToList(wins),
        blockers: linesToList(blockers),
      });
      setSaved(true);
    } catch {
      // Keep the form open so the user can retry on failure.
    } finally {
      setSaving(false);
    }
  };

  const renderScale = (
    value: number,
    onChange: (n: number) => void,
    labels: string[]
  ) => (
    <View style={styles.scaleRow}>
      {SCALE.map((n) => {
        const active = value === n;
        return (
          <TouchableOpacity
            key={n}
            style={[styles.scaleBtn, active && styles.scaleBtnActive]}
            onPress={() => onChange(n)}
            activeOpacity={0.8}
          >
            <Text style={[styles.scaleNum, active && styles.scaleNumActive]}>{n}</Text>
            <Text
              style={[styles.scaleLabel, active && styles.scaleLabelActive]}
              numberOfLines={1}
            >
              {labels[n - 1]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <Modal visible={isOpen} animationType={modalAnimation('slide')} transparent onRequestClose={tryClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={tryClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
          style={styles.sheetAvoider}
        >
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            <SafeAreaView edges={['bottom']} style={styles.sheetInner}>
              {saved ? (
                <View style={styles.savedWrap}>
                  <BottomSheetDragHandle panHandlers={panHandlers} onClose={tryClose} />
                  <Text style={styles.savedTitle}>ふりかえりを保存しました</Text>
                <Text style={styles.savedSub}>
                  今日の結果を学習し、明日のプランに反映します。
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={onClose} activeOpacity={0.85}>
                  <Text style={styles.primaryBtnText}>閉じる</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <BottomSheetDragHandle panHandlers={panHandlers} onClose={tryClose}>
                  <Text style={styles.title}>今日のふりかえり</Text>
                  <Text style={styles.date}>{formatDateHeader(date)}</Text>
                  {eveningQuestion ? (
                    <View style={styles.questionCard}>
                      <Text style={styles.questionKicker}>今日の問い</Text>
                      <Text style={styles.questionText}>{eveningQuestion}</Text>
                    </View>
                  ) : null}
                </BottomSheetDragHandle>

              <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.scrollContent,
                  keyboardInset > 0 && { paddingBottom: keyboardInset + 24 },
                ]}
              >
                <Text style={styles.label}>気分</Text>
                {renderScale(mood, setMood, MOOD_LABELS)}

                <Text style={styles.label}>エネルギー</Text>
                {renderScale(energy, setEnergy, ENERGY_LABELS)}

                <View
                  onLayout={(event) => {
                    fieldOffsets.current.wins = event.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.label}>うまくいったこと（任意・改行で複数）</Text>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={wins}
                    onChangeText={setWins}
                    onFocus={() => scrollToField('wins')}
                    placeholder="例: 朝の集中が続いた"
                    placeholderTextColor={theme.textTertiary}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <View
                  onLayout={(event) => {
                    fieldOffsets.current.blockers = event.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.label}>つまずいたこと（任意・改行で複数）</Text>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={blockers}
                    onChangeText={setBlockers}
                    onFocus={() => scrollToField('blockers')}
                    placeholder="例: 昼食後に眠くなった"
                    placeholderTextColor={theme.textTertiary}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <Text style={styles.hint}>
                  それぞれの欄に直接入力してください。学習ループ（UserModel 更新）は端末内で行われます。
                </Text>

                <TouchableOpacity
                  style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator color={theme.onAccent} />
                  ) : (
                    <Text style={styles.primaryBtnText}>保存して学習させる</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={tryClose} disabled={saving}>
                  <Text style={styles.cancelBtnText}>キャンセル</Text>
                </TouchableOpacity>
              </ScrollView>
              </>
            )}
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
    sheetAvoider: { maxHeight: '92%' },
    sheet: {
      width: '100%',
      backgroundColor: theme.elevated,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      maxHeight: '100%',
    },
    sheetInner: {
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    scroll: {
      flexGrow: 0,
      flexShrink: 1,
      maxHeight: 360,
    },
    scrollContent: {
      paddingBottom: 16,
    },
    title: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 4 },
    date: { fontSize: 14, color: theme.accent, fontWeight: '600', marginBottom: 12 },
    questionCard: {
      backgroundColor: theme.accentSoft,
      borderRadius: theme.radius.md,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    questionKicker: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.accent,
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    questionText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      lineHeight: 22,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 8,
      marginTop: 12,
    },
    scaleRow: { flexDirection: 'row', gap: 6 },
    scaleBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.bg,
      alignItems: 'center',
    },
    scaleBtnActive: { backgroundColor: theme.accent },
    scaleNum: { fontSize: 16, fontWeight: '700', color: theme.text },
    scaleNumActive: { color: theme.onAccent },
    scaleLabel: { fontSize: 10, color: theme.textTertiary, marginTop: 2 },
    scaleLabelActive: { color: theme.onAccent },
    input: {
      backgroundColor: theme.bg,
      borderRadius: theme.radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
    },
    textarea: { minHeight: 72, textAlignVertical: 'top' },
    hint: { fontSize: 12, color: theme.textTertiary, marginTop: 16, lineHeight: 18 },
    primaryBtn: {
      backgroundColor: theme.accent,
      borderRadius: theme.radius.sm,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 8,
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: { color: theme.onAccent, fontSize: 16, fontWeight: '700' },
    cancelBtn: { paddingVertical: 12, alignItems: 'center' },
    cancelBtnText: { color: theme.textSecondary, fontSize: 15, fontWeight: '500' },
    savedWrap: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 8 },
    savedTitle: { fontSize: 18, fontWeight: '700', color: theme.text, textAlign: 'center' },
    savedSub: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 10,
      marginBottom: 24,
      lineHeight: 20,
    },
  });
