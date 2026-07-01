export type {
  GeminiBlockDto,
  GeminiClientOptions,
  GeminiPlacementPrompt,
  GeminiPlacementResultDto,
  GeminiSessionDto,
  GeminiStructuredPrompt,
  GeminiTextPrompt,
} from './types';
export { GeminiClient } from './GeminiClient';
export {
  createGeminiClient,
  isGeminiConfigured,
  loadGeminiClient,
  maskGeminiApiKey,
  resolveGeminiApiKey,
} from './resolveGeminiConfig';
export { canUseCloudAi, isLooperDevClient, looperPlanLabel, resolveLooperPlan } from '../../config/aiEntitlement';
