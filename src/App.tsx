import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Modal, StyleSheet, View, Alert } from 'react-native';

import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { FullScreenSafeArea } from './components/common/FullScreenSafeArea';

import { ErrorBoundary } from './components/ErrorBoundary';
import { LooperBootScreen } from './components/boot/LooperBootScreen';

import { BottomNav } from './components/BottomNav';

import { CalendarView } from './components/CalendarView';

import { SettingsView } from './components/SettingsView';

import { TodayView } from './components/today/TodayView';

import { InsightsView } from './components/insights/InsightsView';

import { RoutineSettingsView } from './components/routines/RoutineSettingsView';

import { FocusMode, FocusBrief } from './components/focus/FocusMode';
import { ReplanProposalModal } from './components/replan/ReplanProposalModal';
import { buildAiReplanProposal, buildReplanProposal, ReplanProposal } from './intelligence/planner/replanDiff';
import { buildEveningReflectionQuestion } from './intelligence/reflection/eveningQuestion';
import { MiddayAdjustmentResult } from './types/dayPlan';

import { ReflectionModal } from './components/reflection/ReflectionModal';

import { CoachModal } from './components/coach/CoachModal';

import { OnboardingModal } from './components/onboarding/OnboardingModal';

import { useCalendarUiState } from './hooks/useCalendarUiState';

import { useDayOrchestrator } from './hooks/useDayOrchestrator';

import {

  buildCalendarViewModel,

  buildDisplayEventCountByDate,

  CalendarEditorGateway,

} from './presentation/calendar';

import { toDateKey, getMonthGrid } from './utils/time';

import { expandRoutinesForDates } from './intelligence/planner/routineExpansion';

import { resolveMorningReplanTaskIds } from './intelligence/planner/morningTaskSelector';

import { reasonTagsToSentences } from './presentation/explain/reasonLabels';
import { buildRolloverNotice } from './presentation/calendar/placementRollover';
import { PlanApplyOutcome } from './presentation/calendar/CalendarPlannerAdapter';
import { useSessionNotifications } from './hooks/useSessionNotifications';
import { ScheduleNotice } from './components/DayTaskList';

import { Session, isMutableScheduleSession } from './types/session';

import { isGeminiConfigured } from './infrastructure/gemini/resolveGeminiConfig';
import {
  getCloudAiUnavailableMessage,
  getCloudAiUnavailableTitle,
} from './intelligence/ai/aiCapabilities';
import { userModelRepository } from './repositories';
import { UserModel } from './types/userModel';
import { buildLearningNotes } from './presentation/learning/learningNotes';
import { Theme, ThemeContext, resolveTheme, lightTheme } from './theme';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may be unavailable on some web/dev setups.
});



function AppContent() {

  const {
    scheduleActions,
    plannerGateway,
    previewReplan,
    applyReplanPreview,
    previewFullReplan,
    applyFullReplanPreview,
    isPlannerRunning,
    saveReflection,
    completeSession,
    dayPlan: dayPlanHook,
  } = useDayOrchestrator();

  const ui = useCalendarUiState();



  const {

    ready,

    tasks,

    sessions,

    calendarBlocks,

    reflections,

    routines,

    saveRoutine,

    deleteRoutine,

    createTask,

    createSession,

    createCalendarBlock,

    updateSession,

    deleteSession,

    updateCalendarBlock,

    deleteCalendarBlock,

    updateTask,

    deleteTask,

    reloadFromRepository,

    exportAppData,

    resetAllData,

  } = scheduleActions;


  const activeTheme = useMemo(
    () => resolveTheme(ui.settings?.themeMode ?? 'light'),
    [ui.settings?.themeMode]
  );

  const geminiConfigured = useMemo(
    () => isGeminiConfigured(ui.settings ?? undefined),
    [ui.settings]
  );

  const showCloudAiUnavailableAlert = useCallback(() => {
    Alert.alert(
      getCloudAiUnavailableTitle(),
      getCloudAiUnavailableMessage(ui.settings ?? undefined)
    );
  }, [ui.settings]);

  const handleOpenCoach = useCallback(() => {
    if (!geminiConfigured) {
      showCloudAiUnavailableAlert();
      return;
    }
    ui.openCoachModal();
  }, [geminiConfigured, showCloudAiUnavailableAlert, ui]);

  const handleOpenAiModal = useCallback(() => {
    if (!geminiConfigured) {
      showCloudAiUnavailableAlert();
      return;
    }
    ui.openAiModal();
  }, [geminiConfigured, showCloudAiUnavailableAlert, ui]);

  const styles = useMemo(() => makeStyles(activeTheme), [activeTheme]);

  const routineDisplayBlocks = useMemo(() => {
    const dateKeys = new Set<string>();
    for (const day of getMonthGrid(ui.viewMonth, ui.settings?.weekStartsOn ?? 0)) {
      dateKeys.add(toDateKey(day));
    }
    dateKeys.add(toDateKey(ui.selectedDate));
    dateKeys.add(toDateKey(new Date()));
    return expandRoutinesForDates(routines, dateKeys);
  }, [routines, ui.viewMonth, ui.selectedDate, ui.settings?.weekStartsOn]);

  const todayRoutineBlocks = useMemo(
    () => expandRoutinesForDates(routines, [toDateKey(new Date())]),
    [routines]
  );

  const calendarViewModel = useMemo(
    () =>
      buildCalendarViewModel({
        tasks,
        sessions,
        calendarBlocks,
        readonlyBlocks: routineDisplayBlocks,
      }),
    [tasks, sessions, calendarBlocks, routineDisplayBlocks]
  );



  const selectedDateKey = useMemo(() => toDateKey(ui.selectedDate), [ui.selectedDate]);



  const displayEvents = useMemo(

    () => calendarViewModel.eventsForDate(selectedDateKey),

    [calendarViewModel, selectedDateKey]

  );



  const displayEventCountByDate = useMemo(

    () => buildDisplayEventCountByDate(calendarViewModel.allEvents),

    [calendarViewModel.allEvents]

  );



  const editorGateway = useMemo<CalendarEditorGateway>(

    () => ({

      sessions,

      calendarBlocks,

      tasks,

      createTask,

      createSession,

      createCalendarBlock,

      updateSession,

      deleteSession,

      updateCalendarBlock,

      deleteCalendarBlock,

      updateTask,

      deleteTask,

      toggleSessionCompleted: completeSession,

    }),

    [

      sessions,

      calendarBlocks,

      tasks,

      createTask,

      createSession,

      createCalendarBlock,

      updateSession,

      deleteSession,

      updateCalendarBlock,

      deleteCalendarBlock,

      updateTask,

      deleteTask,

      completeSession,

    ]

  );



  const coachScheduleDeps = useMemo(
    () => ({
      defaultDurationMinutes: ui.settings?.defaultDurationMinutes ?? 30,
      editorGateway,
      plannerGateway,
    }),
    [editorGateway, plannerGateway, ui.settings?.defaultDurationMinutes]
  );

  const todayKey = toDateKey(new Date());
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const focusSession = (() => {
    const todays = sessions
      .filter(
        (session) =>
          session.date === todayKey && isMutableScheduleSession(session)
      )
      .sort((a, b) => a.startMinutes - b.startMinutes);

    const active = todays.find(
      (session) => nowMinutes >= session.startMinutes && nowMinutes < session.endMinutes
    );
    if (active) return active;

    const upcoming = todays.find((session) => session.startMinutes >= nowMinutes);
    if (upcoming) return upcoming;

    return todays[0] ?? null;
  })();

  const focusTaskTitle = focusSession?.taskId
    ? tasks.find((task) => task.id === focusSession.taskId)?.title ?? 'Session'
    : 'Session';

  const todayReflection = reflections.find((reflection) => reflection.date === todayKey) ?? null;

  const focusBrief: FocusBrief | null =
    dayPlanHook.dayPlan && dayPlanHook.dayPlan.date === todayKey
      ? {
          dayType: dayPlanHook.dayPlan.dayType,
          reasons: reasonTagsToSentences(dayPlanHook.dayPlan.reasonTags),
        }
      : null;

  const { dayPlan: currentDayPlan, ensureDayPlanSnapshot } = dayPlanHook;

  const todayPlan =
    currentDayPlan && currentDayPlan.date === todayKey ? currentDayPlan : null;

  const todaySessions = useMemo(
    () => sessions.filter((session) => session.date === todayKey),
    [sessions, todayKey]
  );

  const morningReplanTaskCount = useMemo(
    () => resolveMorningReplanTaskIds(tasks, sessions, todayKey).length,
    [tasks, sessions, todayKey]
  );

  useSessionNotifications(sessions, tasks, todayKey, ready && ui.ready);

  const scheduleNeedsReplan = useMemo(
    () => hasOverdueIncompleteSessions(todaySessions, nowMinutes),
    [todaySessions, nowMinutes]
  );

  const [isBriefLoading, setIsBriefLoading] = useState(false);
  const [todayPlanNotice, setTodayPlanNotice] = useState<ScheduleNotice | null>(null);
  const [userModel, setUserModel] = useState<UserModel | null>(null);
  const [replanOpen, setReplanOpen] = useState(false);
  const [replanPreview, setReplanPreview] = useState<MiddayAdjustmentResult | null>(null);
  const [replanProposal, setReplanProposal] = useState<ReplanProposal | null>(null);
  const [replanTargetDate, setReplanTargetDate] = useState(() => new Date());
  const [replanPreviewKind, setReplanPreviewKind] = useState<'shift' | 'full'>('shift');
  const autoPlanDateRef = useRef<string | null>(null);
  const autoPlanInFlightRef = useRef(false);

  const todayLearningNotes = useMemo(() => buildLearningNotes(userModel), [userModel]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;
    void userModelRepository.get().then((model) => {
      if (!cancelled) {
        setUserModel(model);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, reflections, sessions, todayReflection]);

  useEffect(() => {
    if (ready && ui.ready && ui.settings) {
      void SplashScreen.hideAsync();
    }
  }, [ready, ui.ready, ui.settings]);

  useEffect(() => {
    if (autoPlanDateRef.current && autoPlanDateRef.current !== todayKey) {
      autoPlanDateRef.current = null;
      setTodayPlanNotice(null);
    }
  }, [todayKey]);

  useEffect(() => {
    if (ui.activeTab !== 'today' || !ready) {
      return;
    }
    if (isPlannerRunning || autoPlanInFlightRef.current) {
      return;
    }
    if (autoPlanDateRef.current === todayKey) {
      return;
    }

    const hasTodaySessions = todaySessions.some(isMutableScheduleSession);
    const hasTodayPlan = currentDayPlan?.date === todayKey;
    const needsSnapshot = hasTodaySessions && !hasTodayPlan;
    const needsGenerate = !hasTodaySessions && morningReplanTaskCount > 0;

    if (!needsSnapshot && !needsGenerate) {
      return;
    }

    autoPlanDateRef.current = todayKey;
    autoPlanInFlightRef.current = true;
    setIsBriefLoading(true);

    const run = needsGenerate
      ? plannerGateway.generateDayPlan(new Date())
      : ensureDayPlanSnapshot(todayKey);

    void Promise.resolve(run)
      .then((result) => {
        if (!needsGenerate || !result || typeof result !== 'object' || !('result' in result)) {
          return;
        }
        const outcome = result as PlanApplyOutcome;
        if (outcome.result === 'skipped_empty') {
          setTodayPlanNotice({
            tone: 'warning',
            text: 'スケジュールを配置する場所がありませんでした。タスクは登録済みですが、今日の予定には入っていません。',
          });
          return;
        }
        const rollover = buildRolloverNotice(outcome);
        if (rollover) {
          setTodayPlanNotice({ tone: 'info', text: rollover });
        }
      })
      .finally(() => {
        autoPlanInFlightRef.current = false;
        setIsBriefLoading(false);
      });
  }, [
    ui.activeTab,
    ready,
    isPlannerRunning,
    todayKey,
    todaySessions,
    currentDayPlan,
    morningReplanTaskCount,
    plannerGateway,
    ensureDayPlanSnapshot,
  ]);

  const beginFocusSession = useCallback(async () => {
    if (
      focusSession &&
      !focusSession.actualStart &&
      focusSession.status !== 'completed' &&
      focusSession.status !== 'rescheduled'
    ) {
      await updateSession({
        ...focusSession,
        actualStart: new Date().toISOString(),
        status: 'active',
      });
    }
    ui.openFocus();
  }, [focusSession, updateSession, ui]);

  const handleJumpIntoLooper = useCallback(async () => {
    await beginFocusSession();
  }, [beginFocusSession]);

  const eveningQuestion = useMemo(
    () => buildEveningReflectionQuestion(todayPlan, sessions, todayKey),
    [todayPlan, sessions, todayKey]
  );

  const openReplanProposal = useCallback(async (date: Date = new Date()) => {
    const preview = await previewReplan(date);
    if (!preview) {
      return;
    }
    const dateKey = toDateKey(date);
    const dateSessions = sessions.filter((session) => session.date === dateKey);
    setReplanTargetDate(date);
    setReplanPreviewKind('shift');
    setReplanPreview(preview);
    setReplanProposal(buildReplanProposal(tasks, dateSessions, preview.plan));
    setReplanOpen(true);
  }, [previewReplan, sessions, tasks]);

  const openFullReplanProposal = useCallback(async (date: Date = new Date()) => {
    if (!geminiConfigured) {
      showCloudAiUnavailableAlert();
      return;
    }
    setIsBriefLoading(true);
    try {
      const preview = await previewFullReplan(date);
      if (!preview) {
        return;
      }
      const dateKey = toDateKey(date);
      const dateSessions = sessions.filter((session) => session.date === dateKey);
      setReplanTargetDate(date);
      setReplanPreviewKind('full');
      setReplanPreview(preview);
      setReplanProposal(
        buildAiReplanProposal(tasks, dateSessions, preview.plan, preview.replanTaskIds)
      );
      setReplanOpen(true);
    } finally {
      setIsBriefLoading(false);
    }
  }, [geminiConfigured, previewFullReplan, sessions, showCloudAiUnavailableAlert, tasks]);

  const closeReplanProposal = useCallback(() => {
    if (isPlannerRunning) {
      return;
    }
    setReplanOpen(false);
    setReplanPreview(null);
    setReplanProposal(null);
    setReplanPreviewKind('shift');
    void dayPlanHook.ensureDayPlanSnapshot(toDateKey(replanTargetDate));
  }, [dayPlanHook, isPlannerRunning, replanTargetDate]);

  const approveReplanProposal = useCallback(async () => {
    if (!replanPreview) {
      return;
    }
    if (replanPreviewKind === 'full') {
      await applyFullReplanPreview(replanPreview, replanTargetDate);
    } else {
      await applyReplanPreview(replanPreview, replanTargetDate);
    }
    setReplanOpen(false);
    setReplanPreview(null);
    setReplanProposal(null);
    setReplanPreviewKind('shift');
  }, [
    applyFullReplanPreview,
    applyReplanPreview,
    replanPreview,
    replanPreviewKind,
    replanTargetDate,
  ]);

  const handleExportData = useCallback(async () => {
    await exportAppData();
  }, [exportAppData]);

  const handleResetData = useCallback(async () => {
    await resetAllData();
    dayPlanHook.clearDayPlan();
    setUserModel(null);
    setTodayPlanNotice(null);
    autoPlanDateRef.current = null;
    await ui.reloadSettings();
    ui.setActiveTab('today');
  }, [dayPlanHook, resetAllData, ui]);

  if (!ready || !ui.ready || !ui.settings) {

    return (

      <ThemeContext.Provider value={lightTheme}>
        <FullScreenSafeArea style={{ backgroundColor: lightTheme.bg }}>
          <LooperBootScreen />
        </FullScreenSafeArea>
      </ThemeContext.Provider>

    );

  }



  return (

    <ThemeContext.Provider value={activeTheme}>

    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

      <StatusBar style={activeTheme.mode === 'dark' ? 'light' : 'dark'} />

      <View style={styles.main}>

        {ui.activeTab === 'today' ? (

          <TodayView
            date={new Date()}
            plan={todayPlan}
            sessions={todaySessions}
            fixedBlocks={todayRoutineBlocks}
            tasks={tasks}
            reflectionDone={Boolean(todayReflection)}
            isPlannerRunning={isPlannerRunning}
            isBriefLoading={isBriefLoading}
            scheduleNeedsReplan={scheduleNeedsReplan}
            hasPlacableTasks={morningReplanTaskCount > 0}
            planNotice={todayPlanNotice}
            learningNotes={todayLearningNotes}
            onDismissPlanNotice={() => setTodayPlanNotice(null)}
            onOpenInsights={() => ui.setActiveTab('insights')}
            onJumpIntoLooper={() => {
              void handleJumpIntoLooper();
            }}
            onGenerate={() => {
              void plannerGateway.generateDayPlan(new Date());
            }}
            onShiftFromNow={() => {
              void openReplanProposal();
            }}
            onFullReplan={() => {
              void openFullReplanProposal(new Date());
            }}
            onFullReplanUnavailable={showCloudAiUnavailableAlert}
            onReflect={ui.openReflectionModal}
            onOpenCoach={handleOpenCoach}
            cloudAiAvailable={geminiConfigured}
            onCompleteSession={(sessionId) => {
              void completeSession(sessionId);
            }}
          />

        ) : ui.activeTab === 'calendar' ? (

          <CalendarView

            calendarMode={ui.calendarMode}

            selectedDate={ui.selectedDate}

            viewMonth={ui.viewMonth}

            setViewMonth={ui.setViewMonth}

            displayEvents={displayEvents}

            displayEventCountByDate={displayEventCountByDate}

            settings={ui.settings}

            editorGateway={editorGateway}

            plannerGateway={plannerGateway}

            isAiModalOpen={ui.isAiModalOpen}

            isAiGenerating={isPlannerRunning}

            openDayView={ui.openDayView}

            closeDayView={ui.closeDayView}

            goToPrevDay={ui.goToPrevDay}

            goToNextDay={ui.goToNextDay}

            goToToday={ui.goToToday}

            openAiModal={handleOpenAiModal}
            cloudAiAvailable={geminiConfigured}

            closeAiModal={ui.closeAiModal}

            onAdjustFromNow={(date) => {
              void openReplanProposal(date);
            }}

            onFullReplan={(date) => {
              void openFullReplanProposal(date);
            }}
            onFullReplanUnavailable={showCloudAiUnavailableAlert}

          />

        ) : ui.activeTab === 'insights' ? (

          <InsightsView sessions={sessions} reflections={reflections} />

        ) : (

          <SettingsView
            settings={ui.settings}
            onUpdate={ui.updateSettings}
            onOpenRoutines={ui.openRoutineEditor}
            onShowOnboarding={ui.openOnboarding}
            onExportData={handleExportData}
            onResetData={handleResetData}
          />

        )}

      </View>

      <BottomNav activeTab={ui.activeTab} onTabChange={ui.setActiveTab} />

      <OnboardingModal
        isOpen={ui.isOnboardingOpen}
        onComplete={() => {
          void ui.completeOnboarding();
        }}
      />

      <ReflectionModal
        isOpen={ui.isReflectionModalOpen}
        date={new Date()}
        existing={todayReflection}
        eveningQuestion={eveningQuestion}
        onSave={async (input) => {
          await saveReflection(input);
        }}
        onClose={ui.closeReflectionModal}
      />

      <CoachModal
        isOpen={ui.isCoachModalOpen}
        plan={todayPlan}
        tasks={tasks}
        scheduleDeps={coachScheduleDeps}
        settings={ui.settings}
        onScheduleApplied={() => {
          void reloadFromRepository();
        }}
        onClose={ui.closeCoachModal}
      />

      <RoutineSettingsView
        isOpen={ui.isRoutineEditorOpen}
        settings={ui.settings}
        routines={routines}
        onUpdateSettings={ui.updateSettings}
        onSaveRoutine={(input) => {
          void saveRoutine(input);
        }}
        onDeleteRoutine={(id) => {
          void deleteRoutine(id);
        }}
        onClose={ui.closeRoutineEditor}
      />

      <Modal
        visible={ui.isFocusOpen}
        animationType="slide"
        onRequestClose={ui.closeFocus}
        presentationStyle="fullScreen"
      >
        <FullScreenSafeArea style={styles.safe}>
          <FocusMode
            session={focusSession}
            taskTitle={focusTaskTitle}
            brief={focusBrief}
            onComplete={() => {
              if (focusSession) {
                void completeSession(focusSession.id);
              }
            }}
            onClose={ui.closeFocus}
          />
        </FullScreenSafeArea>
      </Modal>

      <ReplanProposalModal
        isOpen={replanOpen}
        proposal={replanProposal}
        isApplying={isPlannerRunning}
        kicker={
          replanPreviewKind === 'full'
            ? 'AIが今日の予定を組み直しました'
            : '今日の流れを、今のペースに合わせました'
        }
        onApprove={() => {
          void approveReplanProposal();
        }}
        onClose={closeReplanProposal}
      />

    </SafeAreaView>

    </ThemeContext.Provider>

  );

}



export default function App() {

  return (

    <ErrorBoundary>

      <SafeAreaProvider>

        <AppContent />

      </SafeAreaProvider>

    </ErrorBoundary>

  );

}



function hasOverdueIncompleteSessions(sessions: Session[], nowMinutes: number): boolean {
  return sessions.some(
    (session) =>
      isMutableScheduleSession(session) && session.endMinutes <= nowMinutes
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({

  safe: { flex: 1, backgroundColor: theme.bg },

  main: { flex: 1 },

  });

