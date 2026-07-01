import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Session, plannedDurationMinutes } from '../../types/session';
import { DayType } from '../../types/dayPlan';
import { DAY_TYPE_LABELS } from '../../presentation/explain/reasonLabels';
import { useFocusMotionGuard } from '../../hooks/useFocusMotionGuard';
import { Theme, useTheme, useThemedStyles } from '../../theme';
import { FocusMotionNudge } from './FocusMotionNudge';
import { FocusCountdown } from './FocusCountdown';

export interface FocusBrief {
  dayType: DayType;
  reasons: string[];
}

interface FocusModeProps {
  session: Session | null;
  taskTitle: string;
  brief?: FocusBrief | null;
  onComplete: () => void;
  onClose?: () => void;
}

const ARC_SIZE = 280;
const ARC_STROKE = 2;
const ARC_RADIUS = (ARC_SIZE - ARC_STROKE) / 2;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nowSeconds(): number {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

function resolveRemainingSeconds(session: Session, totalSeconds: number): number {
  const now = nowSeconds();
  const startSeconds = session.startMinutes * 60;
  const endSeconds = session.endMinutes * 60;

  if (now < startSeconds) {
    return totalSeconds;
  }
  return clamp(endSeconds - now, 0, totalSeconds);
}

export function FocusMode({
  session,
  taskTitle,
  brief,
  onComplete,
  onClose,
}: FocusModeProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [, setTick] = useState(0);

  const totalSeconds = session ? Math.max(60, plannedDurationMinutes(session) * 60) : 0;
  const remainingSeconds = session ? resolveRemainingSeconds(session, totalSeconds) : 0;
  const motionGuardEnabled = session !== null && remainingSeconds > 0;

  const motionGuard = useFocusMotionGuard({ enabled: motionGuardEnabled });

  const handleCompleteAndExit = () => {
    motionGuard.dismissNudge();
    onComplete();
    onClose?.();
  };

  const handleExitWithoutComplete = () => {
    motionGuard.dismissNudge();
    onClose?.();
  };

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 60), 1000);
    return () => clearInterval(id);
  }, []);

  const renderBrief = () => {
    if (!brief) return null;
    const label = DAY_TYPE_LABELS[brief.dayType];
    return (
      <View style={styles.brief}>
        <View style={styles.briefHeader}>
          <Text style={styles.briefType}>{label.title}</Text>
          <Text style={styles.briefTagline}>{label.tagline}</Text>
        </View>
        {brief.reasons.slice(0, 2).map((reason) => (
          <Text key={reason} style={styles.briefReason} numberOfLines={2}>
            ・{reason}
          </Text>
        ))}
      </View>
    );
  };

  const renderCenter = () => {
    if (!session) {
      return (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>いま集中するセッションはありません</Text>
          <Text style={styles.emptySub}>一日の終わりに、今日をふりかえりましょう</Text>
        </View>
      );
    }

    const elapsedSeconds = clamp(totalSeconds - remainingSeconds, 0, totalSeconds);
    const elapsedFraction = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;
    const dashOffset = ARC_CIRCUMFERENCE * elapsedFraction;

    return (
      <View style={styles.center}>
        <View style={styles.arcWrap}>
          <Svg width={ARC_SIZE} height={ARC_SIZE}>
            <Circle
              cx={ARC_SIZE / 2}
              cy={ARC_SIZE / 2}
              r={ARC_RADIUS}
              stroke={theme.separator}
              strokeWidth={ARC_STROKE}
              fill="none"
            />
            <Circle
              cx={ARC_SIZE / 2}
              cy={ARC_SIZE / 2}
              r={ARC_RADIUS}
              stroke={theme.accent}
              strokeWidth={ARC_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={ARC_CIRCUMFERENCE}
              strokeDashoffset={-dashOffset}
              transform={`rotate(-90 ${ARC_SIZE / 2} ${ARC_SIZE / 2})`}
            />
          </Svg>

          <View style={styles.timeOverlay} pointerEvents="none">
            <FocusCountdown remainingSeconds={remainingSeconds} />
          </View>
        </View>

        <View style={styles.taskBlock}>
          <Text style={styles.taskLabel}>現在のタスク</Text>
          <Text style={styles.taskTitle} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.85}>
            {taskTitle}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        {onClose ? (
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Text style={styles.closeText}>‹ 戻る</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.closeBtn} />
        )}
        <Text style={styles.brand}>FOCUS MODE</Text>
        <View style={styles.closeBtn} />
      </View>

      {renderBrief()}
      {renderCenter()}

      {session && motionGuardEnabled && motionGuard.supported && !motionGuard.calibrating && (
        <Text style={styles.motionHint}>スマホを触ると、すぐに作業へ戻る声かけを表示します</Text>
      )}

      <FocusMotionNudge
        visible={motionGuard.nudgeVisible}
        reason={motionGuard.nudgeReason}
        onDismiss={motionGuard.dismissNudgeToResume}
        onCompleteAndExit={handleCompleteAndExit}
        onExitWithoutComplete={handleExitWithoutComplete}
      />

      <View style={styles.actions}>
        {session && (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={handleCompleteAndExit}
            activeOpacity={0.85}
          >
            <Text style={styles.completeText}>タスクを完了してホームへ</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
      paddingHorizontal: 28,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
    },
    closeBtn: { minWidth: 56 },
    closeText: { color: theme.textSecondary, fontSize: 15, fontWeight: '600' },
    brand: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 3,
    },
    brief: {
      backgroundColor: theme.elevated,
      borderRadius: theme.radius.md,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: theme.separator,
    },
    briefHeader: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
    briefType: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: 0.5,
      marginRight: 8,
    },
    briefTagline: { fontSize: 13, color: theme.textSecondary },
    briefReason: { fontSize: 12, color: theme.textSecondary, marginTop: 6, lineHeight: 17 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    taskBlock: {
      width: '100%',
      alignItems: 'center',
      marginTop: 28,
      paddingHorizontal: 4,
    },
    taskLabel: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 2,
      marginBottom: 10,
    },
    taskTitle: {
      color: theme.text,
      fontSize: 30,
      fontWeight: '800',
      textAlign: 'center',
      lineHeight: 38,
      letterSpacing: 0.3,
      width: '100%',
    },
    arcWrap: {
      width: ARC_SIZE,
      height: ARC_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
    },
    emptySub: {
      color: theme.textSecondary,
      fontSize: 14,
      marginTop: 10,
      textAlign: 'center',
    },
    motionHint: {
      color: theme.textTertiary,
      fontSize: 11,
      textAlign: 'center',
      marginBottom: 8,
      lineHeight: 16,
    },
    actions: {
      paddingBottom: 20,
    },
    completeBtn: {
      backgroundColor: theme.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },
    completeText: {
      color: theme.onAccent,
      fontSize: 15,
      fontWeight: '700',
    },
  });
