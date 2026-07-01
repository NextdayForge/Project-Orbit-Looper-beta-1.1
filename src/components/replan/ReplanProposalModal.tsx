import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ReplanProposal } from '../../intelligence/planner/replanDiff';
import { Theme, useTheme, useThemedStyles } from '../../theme';

interface ReplanProposalModalProps {
  isOpen: boolean;
  proposal: ReplanProposal | null;
  isApplying: boolean;
  kicker?: string;
  onApprove: () => void;
  onClose: () => void;
}

export function ReplanProposalModal({
  isOpen,
  proposal,
  isApplying,
  kicker = '今日の流れを、今のペースに合わせました',
  onApprove,
  onClose,
}: ReplanProposalModalProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!proposal) {
    return null;
  }

  return (
    <Modal visible={isOpen} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.summary}>{proposal.summary}</Text>

          {proposal.lines.length > 0 && (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {proposal.lines.map((line) => (
                <View key={`${line.title}-${line.fromLabel}`} style={styles.line}>
                  <Text style={styles.lineTitle} numberOfLines={1}>
                    {line.title}
                  </Text>
                  <Text style={styles.lineShift}>
                    {line.fromLabel} → {line.toLabel}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.approveBtn, isApplying && styles.approveBtnDisabled]}
            onPress={onApprove}
            disabled={isApplying}
            activeOpacity={0.85}
          >
            {isApplying ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={styles.approveText}>この軌道で進める</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isApplying}>
            <Text style={styles.cancelText}>あとで</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    card: {
      backgroundColor: theme.elevated,
      borderRadius: theme.radius.lg,
      padding: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.separator,
    },
    kicker: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: theme.accent,
    },
    summary: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      lineHeight: 26,
      marginTop: 12,
    },
    list: {
      maxHeight: 200,
      marginTop: 20,
    },
    line: {
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.separator,
    },
    lineTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    lineShift: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },
    approveBtn: {
      backgroundColor: theme.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    approveBtnDisabled: { opacity: 0.5 },
    approveText: {
      color: theme.onAccent,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    cancelBtn: {
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '600',
    },
  });
