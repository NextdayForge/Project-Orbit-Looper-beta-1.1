import { AppSettings, DEFAULT_SETTINGS } from './schedule';
import { CalendarBlock } from './calendarBlock';
import { Reflection } from './reflection';
import { RoutineTemplate } from './routine';
import { Session } from './session';
import { Task } from './task';
import { UserModel, createDefaultUserModel } from './userModel';

export const LOOPER_DATA_VERSION = 3;

export interface LooperDataV3 {
  version: typeof LOOPER_DATA_VERSION;
  tasks: Task[];
  sessions: Session[];
  calendarBlocks: CalendarBlock[];
  reflections: Reflection[];
  routines: RoutineTemplate[];
  userModel: UserModel;
  settings: AppSettings;
}

export interface LooperDecisionsV3 {
  version: typeof LOOPER_DATA_VERSION;
  decisionLogs: import('./decisionLog').DecisionLog[];
}

export function createEmptyLooperData(settings: AppSettings = DEFAULT_SETTINGS): LooperDataV3 {
  return {
    version: LOOPER_DATA_VERSION,
    tasks: [],
    sessions: [],
    calendarBlocks: [],
    reflections: [],
    routines: [],
    userModel: createDefaultUserModel(),
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}
