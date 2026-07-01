import { CapacityPlan } from '../../types/capacityPlan';
import { DayType } from '../../types/dayPlan';
import { hashText } from '../../utils/hash';
import { GeminiPlacementPrompt } from '../../infrastructure/gemini/types';
import { resolveDayTypeFromCapacity } from './placementFewShots';
import { AiPlacementAudit, PlacementInput, PlacementResult } from './types';

export type AiPlacementFallbackReason =
  | 'api_key_not_configured'
  | 'api_failure'
  | 'validation_failure'
  | 'low_ai_confidence'
  | null;

export async function hashPlacementPrompt(prompt: GeminiPlacementPrompt): Promise<string> {
  return hashText(`${prompt.systemInstruction}\n---\n${prompt.userContent}`);
}

function capacityMetadata(capacity: CapacityPlan): AiPlacementAudit['capacity'] {
  return {
    availableMinutes: capacity.availableMinutes,
    targetFocusMinutes: capacity.targetFocusMinutes,
    targetSessionCount: capacity.targetSessionCount,
    bufferMinutes: capacity.bufferMinutes,
    breakMinutes: capacity.breakMinutes,
  };
}

export function buildAiPlacementAudit(
  input: PlacementInput,
  result: PlacementResult,
  options: {
    modelName: string;
    usedGemini: boolean;
    fellBackToLocal: boolean;
    fallbackReason: AiPlacementFallbackReason;
    retryCount: number;
    promptHash: string;
    responseHash: string | null;
    generatedAt: string;
  }
): AiPlacementAudit {
  const dayType: DayType = resolveDayTypeFromCapacity(input.capacity.reasonTags);

  return {
    modelName: options.modelName,
    usedGemini: options.usedGemini,
    fellBackToLocal: options.fellBackToLocal,
    fallbackReason: options.fallbackReason,
    retryCount: options.retryCount,
    promptHash: options.promptHash,
    responseHash: options.responseHash,
    dayType,
    capacity: capacityMetadata(input.capacity),
    sessionCount: result.sessions.length,
    reasonTags: [...result.reasonTags],
    generatedAt: options.generatedAt,
  };
}
