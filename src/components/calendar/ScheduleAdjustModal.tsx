import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheetDragHandle } from '../common/BottomSheetDragHandle';
import { modalAnimation } from '../common/modalAnimation';
import { useBottomSheetDismiss } from '../common/useBottomSheetDismiss';
import { Theme, useThemedStyles } from '../../theme';

export type ScheduleAdjustRecommendation = 'shift' | 'full' | null;

interface ScheduleAdjustModalProps {
  isOpen: boolean;
  isLoading: boolean;
  canShiftFromNow: boolean;
  cloudAiAvailable: boolean;
  recommended?: ScheduleAdjustRecommendation;
  onClose: () => void;
  onShiftFromNow: () => void;
  onFullReplan: () => void;
  onFullReplanUnavailable?: () => void;
}

export function ScheduleAdjustModal({
  isOpen,
  isLoading,
  canShiftFromNow,
  cloudAiAvailable,
  recommended = null,
  onClose,
  onShiftFromNow,
  onFullReplan,
  onFullReplanUnavailable,
}: ScheduleAdjustModalProps) {
  const styles = useThemedStyles(makeStyles);
  const tryClose = () => {
    if (isLoading) return;
    onClose();
  };
  const { translateY, panHandlers } = useBottomSheetDismiss(isOpen, tryClose, isLoading);

  return (
    <Modal visible={isOpen} animationType={modalAnimation('slide')} transparent onRequestClose={tryClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={tryClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <SafeAreaView edges={['bottom']} style={styles.sheetInner}>
            <BottomSheetDragHandle panHandlers={panHandlers}>
              <Text style={styles.title}>今日の予定を調整</Text>
              <Text style={styles.subtitle}>
                無理のない方法を選んでください。適用前に内容を確認できます。
              </Text>
            </BottomSheetDragHandle>

          <View style={styles.options}>
            {canShiftFromNow && (
              <TouchableOpacity
                style={[styles.option, recommended === 'shift' && styles.optionRecommended]}
                onPress={onShiftFromNow}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <View style={styles.optionTop}>
                  <Text style={styles.optionTitle}>今から順に並べる</Text>
                  <Text style={styles.badgeMuted}>AI不要 · すぐ反映</Text>
                </View>
                {recommended === 'shift' && (
                  <Text style={styles.recommendedTag}>まずはこちら</Text>
                )}
                <Text style={styles.optionDesc}>
                  今日やるタスクはそのまま。残りだけを「今」から、無理のない順番に並べ替えます。
                </Text>
                <Text style={styles.optionExample}>
                  例：10時の英語が未着手 → 今から英語 → その次にプログラミング…
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.option,
                cloudAiAvailable &&
                  (recommended === 'full' || !canShiftFromNow) &&
                  styles.optionRecommended,
                !cloudAiAvailable && styles.optionDisabled,
              ]}
              onPress={() => {
                if (!cloudAiAvailable) {
                  onFullReplanUnavailable?.();
                  return;
                }
                onFullReplan();
              }}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <View style={styles.optionTop}>
                <Text
                  style={[styles.optionTitle, !cloudAiAvailable && styles.optionTitleDisabled]}
                >
                  今日の予定をAIで作り直す
                </Text>
                <Text style={[styles.badgeAi, !cloudAiAvailable && styles.badgeAiDisabled]}>
                  AI
                </Text>
              </View>
              {!canShiftFromNow && cloudAiAvailable && (
                <Text style={styles.recommendedTag}>まずはこちら</Text>
              )}
              <Text style={styles.optionDesc}>
                {cloudAiAvailable
                  ? '空き時間や優先度をAIが見直し、今日の時間配分を一から計算し直します。'
                  : 'Orbit Looper AI の設定後、締切・優先度・空き時間を踏まえて一から組み直せます。'}
              </Text>
              {cloudAiAvailable && (
                <Text style={styles.optionExample}>
                  例：締切が近いタスクを午前へ移動、量を調整、順番を入れ替え…
                </Text>
              )}
            </TouchableOpacity>

            {isLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>調整中…</Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
          </SafeAreaView>
        </Animated.View>
      </View>
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
      overflow: 'hidden',
    },
    sheetInner: {
      paddingHorizontal: 20,
      paddingBottom: 4,
    },
    title: { fontSize: 18, fontWeight: '800', color: theme.text },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
      marginBottom: 16,
      lineHeight: 19,
    },
    options: { gap: 10 },
    option: {
      backgroundColor: theme.bg,
      borderRadius: theme.radius.md,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.separator,
    },
    optionRecommended: {
      borderColor: theme.accentSoft,
    },
    optionDisabled: {
      opacity: 0.72,
    },
    optionTitleDisabled: {
      color: theme.textSecondary,
    },
    optionTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    optionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.text },
    badgeMuted: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      backgroundColor: theme.secondary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    badgeAi: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.accent,
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    badgeAiDisabled: {
      color: theme.textSecondary,
      backgroundColor: theme.secondary,
    },
    recommendedTag: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      marginTop: 6,
      letterSpacing: 0.3,
    },
    optionDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 8, lineHeight: 18 },
    optionExample: {
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: 6,
      lineHeight: 16,
      fontStyle: 'italic',
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    loadingText: { fontSize: 13, color: theme.textSecondary },
    footer: {
      marginTop: 12,
      marginHorizontal: -20,
      paddingHorizontal: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.separator,
    },
    cancelBtn: {
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: { fontSize: 16, color: theme.textSecondary, fontWeight: '600' },
  });
