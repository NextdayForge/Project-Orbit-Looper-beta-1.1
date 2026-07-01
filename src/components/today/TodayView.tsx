import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { APP_NAME } from '../../config/brand';
import { CalendarBlock } from '../../types/calendarBlock';
import { DayPlan } from '../../types/dayPlan';
import {
  Session,
  plannedDurationMinutes,
  isDayProgressSession,
  isScheduleVisibleSession,
  isSessionCompleted,
  isMutableScheduleSession,
} from '../../types/session';
import { Task } from '../../types/task';
import { DAY_TYPE_LABELS, buildDayStrategy, reasonTagsToSentences } from '../../presentation/explain/reasonLabels';
import { formatDateHeader, minutesToTime } from '../../utils/time';
import { Theme, useTheme, useThemedStyles } from '../../theme';
import { ScheduleAdjustModal } from '../calendar/ScheduleAdjustModal';
import { ScheduleNotice } from '../DayTaskList';

interface TodayViewProps {
  date: Date;
  plan: DayPlan | null;
  sessions: Session[];
  fixedBlocks: CalendarBlock[];
  tasks: Task[];
  reflectionDone: boolean;
  isPlannerRunning: boolean;
  isBriefLoading: boolean;
  scheduleNeedsReplan: boolean;
  hasPlacableTasks: boolean;
  planNotice?: ScheduleNotice | null;
  learningNotes?: string[];
  onDismissPlanNotice?: () => void;
  onJumpIntoLooper: () => void;
  onGenerate: () => void;
  onShiftFromNow: () => void;
  onFullReplan: () => void;
  onFullReplanUnavailable?: () => void;
  onReflect: () => void;
  onOpenCoach: () => void;
  cloudAiAvailable: boolean;
  onOpenInsights?: () => void;
  onCompleteSession: (sessionId: string) => void;
}

function greeting(hour: number): string {
  if (hour < 4) return 'こんばんは';
  if (hour < 11) return 'おはようございます';
  if (hour < 18) return 'こんにちは';
  return 'こんばんは';
}

function isDone(session: Session): boolean {
  return isSessionCompleted(session);
}

export function TodayView({
  date,
  plan,
  sessions,
  fixedBlocks,
  tasks,
  reflectionDone,
  isPlannerRunning,
  isBriefLoading,
  scheduleNeedsReplan,
  hasPlacableTasks,
  planNotice = null,
  learningNotes = [],
  onDismissPlanNotice,
  onJumpIntoLooper,
  onGenerate,
  onShiftFromNow,
  onFullReplan,
  onFullReplanUnavailable,
  onReflect,
  onOpenCoach,
  cloudAiAvailable,
  onOpenInsights,
  onCompleteSession,
}: TodayViewProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [, setTick] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 1440), 30_000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isMorning = now.getHours() < 12;

  const titleById = new Map(tasks.map((task) => [task.id, task.title]));
  const progressSessions = [...sessions]
    .filter(isDayProgressSession)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const scheduleSessions = progressSessions.filter(isScheduleVisibleSession);
  const totalCount = progressSessions.length;
  const completedCount = progressSessions.filter(isDone).length;

  const focusTarget = plan?.capacity.targetFocusMinutes ?? 0;
  const focusDone = progressSessions.filter(isDone).reduce((sum, s) => sum + plannedDurationMinutes(s), 0);
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  const active = scheduleSessions.filter((s) => !isDone(s));

  const overdueCount = scheduleSessions.filter((session) => {
    return !isDone(session) && session.endMinutes <= nowMinutes;
  }).length;

  const canShiftFromNow = sessions.some(isMutableScheduleSession);

  const currentSession =
    active.find((s) => nowMinutes >= s.startMinutes && nowMinutes < s.endMinutes) ?? null;
  const nextSession = currentSession ?? active.find((s) => s.startMinutes >= nowMinutes) ?? active[0] ?? null;

  const reasons = plan ? reasonTagsToSentences(plan.reasonTags) : [];
  const dayLabel = plan ? DAY_TYPE_LABELS[plan.dayType] : null;
  const strategyLine = plan ? buildDayStrategy(plan, reasons) : null;
  const briefReasons = plan ? reasons.slice(0, 3) : [];
  const allDone = totalCount > 0 && completedCount === totalCount;
  const eveningReflect = now.getHours() >= 19 && !reflectionDone && totalCount > 0;
  const showLearningNotes =
    learningNotes.length > 0 && (reflectionDone || eveningReflect);
  const isPreparing = isBriefLoading || isPlannerRunning;

  const canJump = !isPreparing && nextSession != null && !allDone;

  const titleFor = (session: Session) =>
    (session.taskId && titleById.get(session.taskId)) || 'セッション';

  type TimelineItem =
    | { kind: 'session'; start: number; session: Session }
    | { kind: 'fixed'; start: number; block: CalendarBlock };
  const timeline: TimelineItem[] = [
    ...scheduleSessions.map((session): TimelineItem => ({ kind: 'session', start: session.startMinutes, session })),
    ...fixedBlocks.map((block): TimelineItem => ({ kind: 'fixed', start: block.startMinutes, block })),
  ].sort((a, b) => a.start - b.start);
  const hasTimeline = timeline.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting(now.getHours())}</Text>
        <Text style={styles.date}>{formatDateHeader(date)}</Text>
      </View>

      <View style={styles.briefCard}>
        {isPreparing ? (
          <View style={styles.briefLoading}>
            <ActivityIndicator color={theme.accent} />
            <Text style={styles.briefLoadingText}>今日のプランを準備中…</Text>
          </View>
        ) : (
          <>
            {allDone ? (
              <View style={styles.doneInline}>
                <Text style={styles.doneTitle}>今日のセッションは完了しました</Text>
                <Text style={styles.doneSub}>お疲れさまでした。</Text>
              </View>
            ) : nextSession ? (
              <View style={styles.taskHero}>
                <Text style={styles.taskHeroKicker}>
                  {currentSession ? 'いま集中中' : '次のセッション'}
                </Text>
                <Text style={styles.taskHeroTitle} numberOfLines={2}>
                  {titleFor(nextSession)}
                </Text>
                <Text style={styles.taskHeroTime}>
                  {minutesToTime(nextSession.startMinutes)} – {minutesToTime(nextSession.endMinutes)} ・{' '}
                  {plannedDurationMinutes(nextSession)}分
                </Text>
              </View>
            ) : null}

            {totalCount > 0 && (
              <View style={[styles.progressInline, !allDone && !nextSession && styles.progressInlineFirst]}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>今日の進捗</Text>
                  <Text style={styles.progressValue}>
                    {completedCount}/{totalCount} セッション
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
                {focusTarget > 0 && (
                  <Text style={styles.progressSub}>
                    集中 {focusDone}分 / 目標 {focusTarget}分
                  </Text>
                )}
              </View>
            )}

            {!allDone && (
              dayLabel ? (
                <View style={styles.dayBrief}>
                  <Text style={styles.dayBriefType}>{dayLabel.title}</Text>
                  <Text style={styles.dayBriefTagline}>{strategyLine ?? dayLabel.tagline}</Text>
                  {briefReasons.map((reason) => (
                    <Text key={reason} style={styles.briefReasonBullet} numberOfLines={2}>
                      ・{reason}
                    </Text>
                  ))}
                </View>
              ) : (
                <View style={styles.dayBrief}>
                  <Text style={styles.dayBriefType}>今日のプラン</Text>
                  <Text style={styles.briefReason} numberOfLines={2}>
                    {hasPlacableTasks
                      ? 'タスクから最適な一日を自動で組み立てます。'
                      : 'タスクを登録すると、一日を自動で組み立てます。'}
                  </Text>
                </View>
              )
            )}

            {!allDone && (
              <TouchableOpacity
                style={[styles.orbitBtn, !canJump && styles.orbitBtnDisabled]}
                onPress={onJumpIntoLooper}
                activeOpacity={0.85}
                disabled={!canJump}
              >
                {isPreparing ? (
                  <ActivityIndicator color={theme.onAccent} />
                ) : (
                  <Text style={styles.looperText}>{APP_NAME}に入る</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.coachLink, !cloudAiAvailable && styles.coachLinkDisabled]}
              onPress={onOpenCoach}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.coachLinkText, !cloudAiAvailable && styles.coachLinkTextDisabled]}
              >
                {cloudAiAvailable ? '✦ AIコーチに相談' : '✦ AIコーチ（未設定）'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {planNotice && onDismissPlanNotice ? (
        <TouchableOpacity
          style={[
            styles.planNotice,
            planNotice.tone === 'warning' && styles.planNoticeWarning,
            planNotice.tone === 'info' && styles.planNoticeInfo,
            planNotice.tone === 'success' && styles.planNoticeSuccess,
          ]}
          onPress={onDismissPlanNotice}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.planNoticeText,
              planNotice.tone === 'warning' && styles.planNoticeTextWarning,
              planNotice.tone === 'info' && styles.planNoticeTextInfo,
            ]}
          >
            {planNotice.text}
          </Text>
        </TouchableOpacity>
      ) : null}

      {scheduleNeedsReplan && (
        <View style={styles.replanNudge}>
          <Text style={styles.replanNudgeIcon}>✦</Text>
          <View style={styles.replanNudgeBody}>
            <Text style={styles.replanNudgeTitle}>今日のペースが少しずれました</Text>
            <Text style={styles.replanNudgeSub}>
              {overdueCount > 0
                ? `残り${overdueCount}件を、今のあなたに合わせて並べ替えられます。一緒に調整しましょう。`
                : '今のあなたに合わせて並べ替えられます。一緒に調整しましょう。'}
            </Text>
            <TouchableOpacity
              style={styles.replanNudgeBtn}
              onPress={() => {
                if (canShiftFromNow) {
                  onShiftFromNow();
                  return;
                }
                setAdjustOpen(true);
              }}
              activeOpacity={0.85}
              disabled={isPreparing}
            >
              {isPreparing ? (
                <ActivityIndicator color={theme.accent} size="small" />
              ) : (
                <Text style={styles.replanNudgeBtnText}>今日の予定を整える</Text>
              )}
            </TouchableOpacity>
            {canShiftFromNow && (
              <TouchableOpacity
                style={styles.replanAltLink}
                onPress={() => setAdjustOpen(true)}
                disabled={isPreparing}
              >
                <Text style={styles.replanAltLinkText}>別の方法で調整</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {hasTimeline && (
        <View style={styles.timelineHeaderRow}>
          <Text style={[styles.sectionTitle, isMorning && completedCount === 0 && styles.sectionTitleMuted]}>
            今日の流れ
          </Text>
          {totalCount > 0 && !scheduleNeedsReplan && (
            <TouchableOpacity onPress={() => setAdjustOpen(true)} disabled={isPreparing}>
              <Text style={styles.rescheduleLink}>予定を調整</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {timeline.map((item) => {
        if (item.kind === 'fixed') {
          return (
            <View key={`fixed-${item.block.id}`} style={[styles.row, styles.rowFixed]}>
              <View style={styles.fixedIcon}>
                <Text style={styles.fixedIconText}>◆</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.block.title}
                </Text>
                <Text style={styles.rowTime}>
                  {minutesToTime(item.block.startMinutes)} – {minutesToTime(item.block.endMinutes)}
                </Text>
              </View>
              <Text style={styles.fixedBadge}>固定</Text>
            </View>
          );
        }

        const session = item.session;
        const done = isDone(session);
        const isNow = session.id === currentSession?.id;
        return (
          <View key={session.id} style={[styles.row, isNow && styles.rowNow]}>
            <TouchableOpacity
              style={[styles.check, done && styles.checkDone]}
              onPress={() => onCompleteSession(session.id)}
            >
              {done && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, done && styles.rowTitleDone]} numberOfLines={1}>
                {titleFor(session)}
              </Text>
              <Text style={styles.rowTime}>
                {minutesToTime(session.startMinutes)} – {minutesToTime(session.endMinutes)}
              </Text>
            </View>
            {isNow && <Text style={styles.nowBadge}>NOW</Text>}
          </View>
        );
      })}

      {showLearningNotes && (
        <View style={styles.learningCard}>
          <Text style={styles.learningTitle}>最新の学習メモ</Text>
          {learningNotes.slice(0, 2).map((note) => (
            <Text key={note} style={styles.learningNote}>
              {note}
            </Text>
          ))}
          {onOpenInsights ? (
            <TouchableOpacity onPress={onOpenInsights} hitSlop={8}>
              <Text style={styles.learningLink}>くわしく見る</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View style={styles.actions}>
        {totalCount > 0 && (
          <TouchableOpacity onPress={() => setAdjustOpen(true)} disabled={isPreparing}>
            <Text style={[styles.linkAction, isPreparing && styles.linkActionDisabled]}>
              予定を調整
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onReflect}>
          <Text style={[styles.linkAction, eveningReflect && styles.linkActionHighlight]}>
            {reflectionDone ? 'ふりかえりを編集' : '今日をふりかえる'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScheduleAdjustModal
        isOpen={adjustOpen}
        isLoading={isPreparing}
        canShiftFromNow={canShiftFromNow}
        cloudAiAvailable={cloudAiAvailable}
        recommended={scheduleNeedsReplan ? 'shift' : null}
        onClose={() => {
          if (isPreparing) {
            return;
          }
          setAdjustOpen(false);
        }}
        onShiftFromNow={() => {
          setAdjustOpen(false);
          onShiftFromNow();
        }}
        onFullReplan={() => {
          setAdjustOpen(false);
          onFullReplan();
        }}
        onFullReplanUnavailable={onFullReplanUnavailable}
      />
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 20, paddingBottom: 40, gap: 14 },
    header: { marginBottom: 2 },
    greeting: { fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: 0.2 },
    date: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },

    briefCard: {
      backgroundColor: theme.elevated,
      borderRadius: theme.radius.lg,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.separator,
    },
    briefLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    briefLoadingText: { fontSize: 14, color: theme.textSecondary, fontWeight: '600' },

    taskHero: {
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.separator,
    },
    taskHeroKicker: { fontSize: 11, fontWeight: '700', color: theme.accent, letterSpacing: 1 },
    taskHeroTitle: { fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 6, lineHeight: 28 },
    taskHeroTime: { fontSize: 13, color: theme.textSecondary, marginTop: 6 },

    dayBrief: { marginTop: 12 },
    dayBriefType: { fontSize: 13, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.3 },
    dayBriefTagline: { fontSize: 13, color: theme.textTertiary, marginTop: 2, lineHeight: 19 },
    briefReason: { fontSize: 12, color: theme.textTertiary, marginTop: 6, lineHeight: 18 },
    briefReasonBullet: { fontSize: 12, color: theme.textSecondary, marginTop: 4, lineHeight: 18 },

    planNotice: {
      borderRadius: theme.radius.md,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    planNoticeWarning: {
      backgroundColor: theme.eventColors.red.bg,
      borderWidth: 1.5,
      borderColor: theme.eventColors.red.border,
    },
    planNoticeInfo: {
      backgroundColor: theme.eventColors.orange.bg,
      borderWidth: 1,
      borderColor: theme.eventColors.orange.border,
    },
    planNoticeSuccess: {
      backgroundColor: theme.eventColors.green.bg,
      borderWidth: 1,
      borderColor: theme.eventColors.green.border,
    },
    planNoticeText: { fontSize: 13, lineHeight: 20, fontWeight: '600', color: theme.text },
    planNoticeTextWarning: { color: theme.eventColors.red.text },
    planNoticeTextInfo: { color: theme.eventColors.orange.text },

    learningCard: {
      backgroundColor: theme.elevated,
      borderRadius: theme.radius.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.separator,
      gap: 6,
    },
    learningTitle: { fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 2 },
    learningNote: { fontSize: 13, color: theme.textSecondary, lineHeight: 20 },
    learningLink: { fontSize: 13, fontWeight: '700', color: theme.accent, marginTop: 6 },

    replanAltLink: { marginTop: 8, alignSelf: 'flex-start' },
    replanAltLinkText: { fontSize: 12, fontWeight: '600', color: theme.textTertiary },

    progressInline: { marginTop: 14 },
    progressInlineFirst: { marginTop: 0 },

    orbitBtn: {
      backgroundColor: theme.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 14,
    },
    orbitBtnDisabled: { opacity: 0.45 },
    looperText: {
      color: theme.onAccent,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: 1,
    },

    doneInline: { marginBottom: 4 },
    doneTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    doneSub: { fontSize: 14, color: theme.textSecondary, marginTop: 6 },

    coachLink: {
      alignSelf: 'center',
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.accentSoft,
    },
    coachLinkText: { fontSize: 13, fontWeight: '700', color: theme.accent },
    coachLinkDisabled: { backgroundColor: theme.bg, opacity: 0.85 },
    coachLinkTextDisabled: { color: theme.textTertiary },

    replanNudge: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.elevated,
      borderRadius: theme.radius.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.separator,
      gap: 12,
    },
    replanNudgeIcon: { fontSize: 18, color: theme.accent, marginTop: 2, opacity: 0.85 },
    replanNudgeBody: { flex: 1 },
    replanNudgeTitle: { fontSize: 15, fontWeight: '700', color: theme.text, lineHeight: 22 },
    replanNudgeSub: { fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 21 },
    replanNudgeBtn: {
      marginTop: 12,
      backgroundColor: theme.accentSoft,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 16,
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: theme.accentSoft,
    },
    replanNudgeBtnText: { fontSize: 14, fontWeight: '700', color: theme.accent },

    progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
    progressValue: { fontSize: 12, color: theme.textSecondary, fontWeight: '700' },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.secondary,
      marginTop: 8,
      overflow: 'hidden',
    },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: theme.accent },
    progressSub: { fontSize: 11, color: theme.textTertiary, marginTop: 5 },

    timelineHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
    sectionTitleMuted: { color: theme.textSecondary, fontWeight: '600' },
    rescheduleLink: { fontSize: 12, color: theme.textTertiary, fontWeight: '600' },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.elevated,
      borderRadius: theme.radius.md,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: theme.separator,
    },
    rowNow: { borderColor: theme.accent },
    rowFixed: { backgroundColor: theme.secondary, borderColor: theme.separator },
    fixedIcon: {
      width: 26,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    fixedIconText: { color: theme.textTertiary, fontSize: 13 },
    fixedBadge: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 1,
    },
    check: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: theme.textTertiary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    checkDone: { backgroundColor: theme.accent, borderColor: theme.accent },
    checkMark: { color: theme.onAccent, fontSize: 14, fontWeight: '800' },
    rowBody: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
    rowTitleDone: { color: theme.textTertiary, textDecorationLine: 'line-through' },
    rowTime: { fontSize: 12, color: theme.textSecondary, marginTop: 3 },
    nowBadge: { fontSize: 11, fontWeight: '800', color: theme.accent, letterSpacing: 1 },

    actions: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 12 },
    linkAction: { fontSize: 13, color: theme.textTertiary, fontWeight: '600' },
    linkActionDisabled: { opacity: 0.4 },
    linkActionHighlight: { color: theme.accent, fontWeight: '700' },
  });
