import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FocusNudgeReason } from '../../hooks/useFocusMotionGuard';
import { Theme, useThemedStyles } from '../../theme';

interface FocusMotionNudgeProps {
  visible: boolean;
  reason: FocusNudgeReason;
  onDismiss: () => void;
  onCompleteAndExit: () => void;
  onExitWithoutComplete: () => void;
}

function messageForReason(reason: FocusNudgeReason): { title: string; body: string } {
  if (reason === 'background_return') {
    return {
      title: '作業に戻りましょう',
      body: 'スマホを触っていたようです。いまの作業に意識を戻してください。',
    };
  }

  return {
    title: '作業に戻りましょう',
    body: 'スマホが動きました。触れてしまったかもしれません。深呼吸して、いまの作業に集中してください。',
  };
}

export function FocusMotionNudge({
  visible,
  reason,
  onDismiss,
  onCompleteAndExit,
  onExitWithoutComplete,
}: FocusMotionNudgeProps) {
  const styles = useThemedStyles(makeStyles);

  if (!visible || !reason) {
    return null;
  }

  const copy = messageForReason(reason);

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>FOCUS GUARD</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onDismiss} activeOpacity={0.88}>
            <Text style={styles.primaryText}>作業に戻る</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onCompleteAndExit}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryText}>タスクを完了してホームへ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tertiaryBtn}
            onPress={onExitWithoutComplete}
            activeOpacity={0.88}
          >
            <Text style={styles.tertiaryText}>タスクを完了せずにホームへ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      zIndex: 30,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: theme.elevated,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 24,
      paddingVertical: 28,
      borderWidth: 2,
      borderColor: theme.accent,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.accent,
      letterSpacing: 2,
      marginBottom: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.text,
      lineHeight: 32,
    },
    body: {
      fontSize: 15,
      color: theme.textSecondary,
      marginTop: 12,
      lineHeight: 24,
    },
    actions: {
      marginTop: 24,
      gap: 10,
    },
    primaryBtn: {
      backgroundColor: theme.accent,
      borderRadius: theme.radius.md,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryText: {
      color: theme.onAccent,
      fontSize: 15,
      fontWeight: '700',
    },
    secondaryBtn: {
      borderRadius: theme.radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.separator,
      backgroundColor: theme.bg,
    },
    secondaryText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    tertiaryBtn: {
      borderRadius: theme.radius.md,
      paddingVertical: 12,
      alignItems: 'center',
    },
    tertiaryText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
  });
