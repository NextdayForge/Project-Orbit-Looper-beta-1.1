import {
  decisionLogRepository,
  reflectionRepository,
  sessionRepository,
  taskRepository,
  userModelRepository,
} from '../../repositories';
import { DecisionLog } from '../../types/decisionLog';
import { generateId, toDateKey } from '../../utils/time';
import { extract } from './DailyFeatureExtractor';
import { selectLatestPlannerEvaluation } from './plannerEvaluationReader';
import { LearningPipelineResult } from './types';
import { update } from './UserModelUpdater';

/**
 * Nightly learning: Session history → DailyFeatures → UserModel.
 * Incorporates planner_evaluation DecisionLogs for buffer / estimation / AI confidence tuning.
 * Only this module may read past Session history (Architecture v1.1).
 * Does not regenerate DayPlan.
 */
export class LearningPipeline {
  async run(date?: string): Promise<LearningPipelineResult> {
    const targetDate = date ?? toDateKey(new Date());

    const [sessions, reflection, userModel, decisionLogs, tasks] = await Promise.all([
      sessionRepository.getAll(),
      reflectionRepository.getByDate(targetDate),
      userModelRepository.get(),
      decisionLogRepository.getByDate(targetDate),
      taskRepository.getAll(),
    ]);

    const features = extract(targetDate, sessions, reflection, tasks);
    const plannerEvaluation = selectLatestPlannerEvaluation(decisionLogs);
    const updatedUserModel = update(userModel, features, plannerEvaluation);
    const savedUserModel = await userModelRepository.save(updatedUserModel);

    const decisionLog: DecisionLog = {
      id: generateId(),
      date: targetDate,
      type: 'learning_update',
      decision: {
        estimationFactor: savedUserModel.estimationFactor,
        energyCurve: savedUserModel.energyCurve,
        bufferNeed: savedUserModel.bufferNeed,
        procrastinationIndex: savedUserModel.procrastinationIndex,
      },
      reasonTags: ['nightly_learning'],
      inputSnapshot: { features },
      outputSnapshot: {
        version: savedUserModel.version,
        lastDailySnapshot: savedUserModel.lastDailySnapshot,
      },
      createdAt: new Date().toISOString(),
    };

    const savedLog = await decisionLogRepository.append(decisionLog);

    return {
      userModel: savedUserModel,
      features,
      decisionLog: savedLog,
    };
  }
}

export const learningPipeline = new LearningPipeline();
