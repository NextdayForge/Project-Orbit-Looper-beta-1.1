import { looperDataStore, looperDecisionsStore } from '../storage';

import {
  CalendarBlockRepository,
  DecisionLogRepository,
  ReflectionRepository,
  RoutineRepository,
  SessionRepository,
  SettingsRepository,
  TaskRepository,
  UserModelRepository,
} from './implementations';

export const calendarBlockRepository = new CalendarBlockRepository(looperDataStore);
export const taskRepository = new TaskRepository(looperDataStore);
export const sessionRepository = new SessionRepository(looperDataStore);
export const reflectionRepository = new ReflectionRepository(looperDataStore);
export const routineRepository = new RoutineRepository(looperDataStore);
export const userModelRepository = new UserModelRepository(looperDataStore);
export const settingsRepository = new SettingsRepository(looperDataStore);
export const decisionLogRepository = new DecisionLogRepository(looperDecisionsStore);

/**
 * Flushes pending debounced writes for all looper-data entities.
 */
export async function flushLooperData(): Promise<void> {
  await looperDataStore.flush();
}

export type {
  ICalendarBlockRepository,
  ITaskRepository,
  ISessionRepository,
  IReflectionRepository,
  IRoutineRepository,
  IUserModelRepository,
  ISettingsRepository,
  IDecisionLogRepository,
} from './interfaces';

export {
  CalendarBlockRepository,
  TaskRepository,
  SessionRepository,
  ReflectionRepository,
  RoutineRepository,
  UserModelRepository,
  SettingsRepository,
  DecisionLogRepository,
} from './implementations';
