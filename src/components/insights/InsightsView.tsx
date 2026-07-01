import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { APP_NAME } from '../../config/brand';
import { userModelRepository } from '../../repositories';
import { UserModel } from '../../types/userModel';
import { Session, isDayProgressSession, isSessionCompleted } from '../../types/session';
import { Reflection } from '../../types/reflection';
import { TaskCategory } from '../../types/task';
import { addDays, toDateKey } from '../../utils/time';
import { Theme, useTheme, useThemedStyles } from '../../theme';
import { energyCurveDiffersFromDefault } from '../../intelligence/learning/energyCurveLearning';
import { buildLearningNotes } from '../../presentation/learning/learningNotes';

interface InsightsViewProps {
  sessions: Session[];
  reflections: Reflection[];
}

const ENERGY_SEGMENTS = ['早朝', '午前', '昼', '午後', '夕方', '夜'];

const CATEGORY_LABELS: Record<string, string> = {
  study: '勉強',
  work: '仕事',
  life: '生活',
  health: '健康',
  general: '一般',
  default: '標準',
};

function procrastinationLabel(pi: number): string {
  if (pi >= 0.6) return '高め';
  if (pi <= 0.3) return '低め';
  return 'ふつう';
}

function isDone(session: Session): boolean {
  return isSessionCompleted(session);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function InsightsView({ sessions, reflections }: InsightsViewProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [userModel, setUserModel] = useState<UserModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    userModelRepository
      .get()
      .then((model) => {
        if (!cancelled) setUserModel(model);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const since = toDateKey(addDays(new Date(), -7));
  const recentSessions = sessions.filter((s) => s.date >= since && isDayProgressSession(s));
  const recentDone = recentSessions.filter(isDone).length;
  const completionRate =
    recentSessions.length > 0 ? Math.round((recentDone / recentSessions.length) * 100) : null;

  const recentReflections = reflections.filter((r) => r.date >= since);
  const avgMood = average(recentReflections.map((r) => r.mood));
  const avgEnergy = average(recentReflections.map((r) => r.energy));

  const hasLearned = Boolean(userModel?.lastDailySnapshot) || reflections.length > 0;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const energyCurve = userModel?.energyCurve ?? [];
  const energyCurveLearned = energyCurveDiffersFromDefault(energyCurve);
  const peakIndex = energyCurve.reduce(
    (best, value, index) => (value > energyCurve[best] ? index : best),
    0
  );
  const estimationEntries = Object.entries(userModel?.estimationFactor ?? {}).filter(
    ([, factor]) => Number.isFinite(factor)
  );
  const learningNotes = buildLearningNotes(userModel);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>学習</Text>
        <Text style={styles.subtitle}>{APP_NAME} は毎日あなたを観察し、少しずつ最適化しています</Text>
      </View>

      {!hasLearned && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>まだ学習データがありません</Text>
          <Text style={styles.emptyText}>
            数日「ふりかえり」を続けると、あなたの集中の傾向やエネルギーの波がここに現れます。
          </Text>
        </View>
      )}

      {/* What AI learned */}
      <Text style={styles.sectionTitle}>AIが学んだあなた</Text>
      <View style={styles.card}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>平均集中時間</Text>
          <Text style={styles.statValue}>約{Math.round(userModel?.focusLength ?? 0)}分</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>先延ばし傾向</Text>
          <Text style={styles.statValue}>
            {procrastinationLabel(userModel?.procrastinationIndex ?? 0.3)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>必要なバッファ</Text>
          <Text style={styles.statValue}>
            見積の{Math.round((userModel?.bufferNeed ?? 0.2) * 100)}%
          </Text>
        </View>
      </View>

      {learningNotes.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>最新の学習メモ</Text>
          <View style={styles.card}>
            {learningNotes.map((note) => (
              <Text key={note} style={styles.learningNote}>
                ・{note}
              </Text>
            ))}
            <Text style={styles.chartNote}>
              この内容は翌朝の DayType 判定と配置に反映されます
            </Text>
          </View>
        </>
      )}

      {/* Energy curve */}
      {energyCurve.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>エネルギーの波</Text>
          <View style={styles.card}>
            <View style={styles.chart}>
              {energyCurve.map((value, index) => (
                <View key={index} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        index === peakIndex ? styles.peakBar : styles.bar,
                        { height: `${Math.max(6, Math.round(value * 100))}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{ENERGY_SEGMENTS[index] ?? index}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.chartNote}>
              {energyCurveLearned
                ? `いちばん調子が出やすいのは「${ENERGY_SEGMENTS[peakIndex] ?? '午前'}」の時間帯です`
                : 'セッションをこなすと、あなたのリズムに合わせて更新されます'}
            </Text>
          </View>
        </>
      )}

      {/* Estimation accuracy */}
      {estimationEntries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>見積もりのクセ</Text>
          <View style={styles.card}>
            {estimationEntries.map(([category, factor], index) => (
              <View key={category}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>
                    {CATEGORY_LABELS[category as TaskCategory] ?? category}
                  </Text>
                  <Text style={styles.statValue}>実際は約{Math.round(factor * 100)}%</Text>
                </View>
              </View>
            ))}
            <Text style={styles.chartNote}>
              100%より大きいほど、見積もりより時間がかかる傾向です
            </Text>
          </View>
        </>
      )}

      {/* Recent results */}
      <Text style={styles.sectionTitle}>この7日間</Text>
      <View style={styles.card}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>達成率</Text>
          <Text style={styles.statValue}>
            {completionRate === null ? '—' : `${completionRate}%`}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>完了セッション</Text>
          <Text style={styles.statValue}>
            {recentDone} / {recentSessions.length}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>平均の気分 / 体力</Text>
          <Text style={styles.statValue}>
            {avgMood === null ? '—' : `${avgMood.toFixed(1)} / ${(avgEnergy ?? 0).toFixed(1)}`}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 20, paddingBottom: 40, gap: 12 },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
    header: { marginBottom: 4 },
    title: { fontSize: 28, fontWeight: '800', color: theme.text },
    subtitle: { fontSize: 14, color: theme.textSecondary, marginTop: 6, lineHeight: 20 },

    emptyCard: {
      backgroundColor: theme.accentSoft,
      borderRadius: theme.radius.md,
      padding: 16,
    },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
    emptyText: { fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 19 },

    sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 8 },
    card: {
      backgroundColor: theme.elevated,
      borderRadius: theme.radius.md,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.separator,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    statLabel: { fontSize: 14, color: theme.textSecondary },
    statValue: { fontSize: 15, fontWeight: '700', color: theme.text },
    learningNote: { fontSize: 13, color: theme.text, lineHeight: 20, marginBottom: 6 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator },

    chart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8 },
    barCol: { flex: 1, alignItems: 'center' },
    barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    bar: { width: '70%', borderRadius: 4, backgroundColor: theme.secondary },
    peakBar: { width: '70%', borderRadius: 4, backgroundColor: theme.accent },
    barLabel: { fontSize: 11, color: theme.textTertiary, marginTop: 6 },
    chartNote: { fontSize: 12, color: theme.textTertiary, marginTop: 12, lineHeight: 18 },
  });
