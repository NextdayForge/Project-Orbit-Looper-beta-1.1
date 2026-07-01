import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BottomNav } from './components/BottomNav';
import { CalendarView } from './components/CalendarView';
import { SettingsView } from './components/SettingsView';
import { useCalendarState } from './hooks/useCalendarState';
import { theme } from './theme';

function AppContent() {
  const state = useCalendarState();

  if (!state.ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.main}>
        {state.activeTab === 'calendar' ? (
          <CalendarView
            calendarMode={state.calendarMode}
            selectedDate={state.selectedDate}
            viewMonth={state.viewMonth}
            setViewMonth={state.setViewMonth}
            dayEvents={state.dayEvents}
            eventCountByDate={state.eventCountByDate}
            settings={state.settings}
            editingEvent={state.editingEvent}
            draftSlot={state.draftSlot}
            isEditorOpen={state.isEditorOpen}
            isAiModalOpen={state.isAiModalOpen}
            isAiGenerating={state.isAiGenerating}
            openDayView={state.openDayView}
            closeDayView={state.closeDayView}
            goToPrevDay={state.goToPrevDay}
            goToNextDay={state.goToNextDay}
            openNewEvent={state.openNewEvent}
            openEditEvent={state.openEditEvent}
            closeEditor={state.closeEditor}
            saveEvent={state.saveEvent}
            deleteEvent={state.deleteEvent}
            toggleEventComplete={state.toggleEventComplete}
            forceReschedule={state.forceReschedule}
            shiftFromNow={state.shiftFromNow}
            canShiftFromNow={state.canShiftFromNow}
            rescheduleNotice={state.rescheduleNotice}
            clearRescheduleNotice={state.clearRescheduleNotice}
            goToToday={state.goToToday}
            openAiModal={state.openAiModal}
            closeAiModal={state.closeAiModal}
            runAiSchedule={state.runAiSchedule}
          />
        ) : (
          <SettingsView settings={state.settings} onUpdate={state.updateSettings} />
        )}
      </View>
      <BottomNav activeTab={state.activeTab} onTabChange={state.setActiveTab} />
    </SafeAreaView>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  main: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
});
