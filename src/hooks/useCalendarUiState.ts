import { useCallback, useEffect, useState } from 'react';
import { settingsRepository } from '../repositories';
import { AppSettings, AppTab, CalendarMode } from '../types/schedule';
import { addDays } from '../utils/time';

export function useCalendarUiState() {
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTabState] = useState<AppTab>('today');
  const [isFocusOpen, setIsFocusOpen] = useState(false);
  const [isRoutineEditorOpen, setIsRoutineEditorOpen] = useState(false);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date());
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false);
  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void settingsRepository
      .get()
      .then((loaded) => {
        if (!cancelled) {
          setSettings(loaded);
          if (!loaded.onboardingCompleted) {
            setIsOnboardingOpen(true);
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const saved = await settingsRepository.update(partial);
    setSettings(saved);
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setSelectedDate(now);
    setViewMonth(now);
    setCalendarMode('month');
  }, []);

  const openDayView = useCallback((date: Date) => {
    setSelectedDate(date);
    setViewMonth(date);
    setCalendarMode('day');
  }, []);

  const closeDayView = useCallback(() => setCalendarMode('month'), []);
  const goToPrevDay = useCallback(() => setSelectedDate((prev) => addDays(prev, -1)), []);
  const goToNextDay = useCallback(() => setSelectedDate((prev) => addDays(prev, 1)), []);

  const setActiveTab = useCallback(
    (tab: AppTab) => {
      if (tab === 'calendar' && activeTab === 'calendar' && calendarMode === 'day') {
        setCalendarMode('month');
        return;
      }
      setActiveTabState(tab);
    },
    [activeTab, calendarMode]
  );

  const openAiModal = useCallback(() => setIsAiModalOpen(true), []);
  const closeAiModal = useCallback(() => setIsAiModalOpen(false), []);
  const openReflectionModal = useCallback(() => setIsReflectionModalOpen(true), []);
  const closeReflectionModal = useCallback(() => setIsReflectionModalOpen(false), []);
  const openCoachModal = useCallback(() => setIsCoachModalOpen(true), []);
  const closeCoachModal = useCallback(() => setIsCoachModalOpen(false), []);
  const openFocus = useCallback(() => setIsFocusOpen(true), []);
  const closeFocus = useCallback(() => setIsFocusOpen(false), []);
  const openRoutineEditor = useCallback(() => setIsRoutineEditorOpen(true), []);
  const closeRoutineEditor = useCallback(() => setIsRoutineEditorOpen(false), []);

  const completeOnboarding = useCallback(async () => {
    const saved = await settingsRepository.update({ onboardingCompleted: true });
    setSettings(saved);
    setIsOnboardingOpen(false);
  }, []);

  const openOnboarding = useCallback(() => {
    setIsOnboardingOpen(true);
  }, []);

  const reloadSettings = useCallback(async () => {
    const loaded = await settingsRepository.get();
    setSettings(loaded);
    if (!loaded.onboardingCompleted) {
      setIsOnboardingOpen(true);
    }
  }, []);

  return {
    ready,
    activeTab,
    setActiveTab,
    calendarMode,
    selectedDate,
    viewMonth,
    setViewMonth,
    settings,
    updateSettings,
    isAiModalOpen,
    openAiModal,
    closeAiModal,
    isReflectionModalOpen,
    openReflectionModal,
    closeReflectionModal,
    isCoachModalOpen,
    openCoachModal,
    closeCoachModal,
    isFocusOpen,
    openFocus,
    closeFocus,
    isRoutineEditorOpen,
    openRoutineEditor,
    closeRoutineEditor,
    isOnboardingOpen,
    completeOnboarding,
    openOnboarding,
    reloadSettings,
    goToToday,
    openDayView,
    closeDayView,
    goToPrevDay,
    goToNextDay,
  };
}
