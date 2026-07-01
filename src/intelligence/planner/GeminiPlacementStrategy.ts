import { GeminiClient } from '../../infrastructure/gemini/GeminiClient';
import { hashText } from '../../utils/hash';
import { buildAiPlacementAudit, hashPlacementPrompt } from './aiPlacementAudit';
import { LocalPlacementStrategy } from './LocalPlacementStrategy';
import { buildPlacementPrompt } from './PromptBuilder';
import { validateAndMapPlacementResult } from './PlacementResultValidator';
import { PlacementInput, PlacementResult } from './types';
import { PlacementStrategy } from './PlacementStrategy';

const GEMINI_MIN_AI_CONFIDENCE = 0.2;

/**
 * Gemini-backed placement strategy (Architecture v1.1 Strategy Pattern).
 * Falls back to LocalPlacementStrategy when API is unavailable or output is invalid.
 * Returns aiAudit metadata for useDayPlan to persist via DecisionLogRepository.
 */
export class GeminiPlacementStrategy implements PlacementStrategy {
  constructor(
    private readonly fallback: PlacementStrategy = new LocalPlacementStrategy(),
    private readonly client: GeminiClient = new GeminiClient()
  ) {}

  async place(input: PlacementInput): Promise<PlacementResult> {
    const generatedAt = new Date().toISOString();
    const modelName = this.client.getModelName();
    const prompt = buildPlacementPrompt(input);
    const promptHash = await hashPlacementPrompt(prompt);

    if (input.context.aiConfidence < GEMINI_MIN_AI_CONFIDENCE) {
      const result = await this.fallback.place(input);
      return {
        ...result,
        aiAudit: buildAiPlacementAudit(input, result, {
          modelName,
          usedGemini: false,
          fellBackToLocal: true,
          fallbackReason: 'low_ai_confidence',
          retryCount: 0,
          promptHash,
          responseHash: null,
          generatedAt,
        }),
      };
    }

    if (!this.client.isConfigured()) {
      const result = await this.fallback.place(input);
      return {
        ...result,
        aiAudit: buildAiPlacementAudit(input, result, {
          modelName,
          usedGemini: false,
          fellBackToLocal: true,
          fallbackReason: 'api_key_not_configured',
          retryCount: 0,
          promptHash,
          responseHash: null,
          generatedAt,
        }),
      };
    }

    const apiResult = await this.client.generatePlacementJson(prompt);
    if (!apiResult.text) {
      const result = await this.fallback.place(input);
      return {
        ...result,
        aiAudit: buildAiPlacementAudit(input, result, {
          modelName,
          usedGemini: true,
          fellBackToLocal: true,
          fallbackReason: 'api_failure',
          retryCount: apiResult.retryCount,
          promptHash,
          responseHash: null,
          generatedAt,
        }),
      };
    }

    const responseHash = await hashText(apiResult.text);
    const validated = validateAndMapPlacementResult(apiResult.text, input);
    if (!validated) {
      const result = await this.fallback.place(input);
      return {
        ...result,
        aiAudit: buildAiPlacementAudit(input, result, {
          modelName,
          usedGemini: true,
          fellBackToLocal: true,
          fallbackReason: 'validation_failure',
          retryCount: apiResult.retryCount,
          promptHash,
          responseHash,
          generatedAt,
        }),
      };
    }

    return {
      ...validated,
      aiAudit: buildAiPlacementAudit(input, validated, {
        modelName,
        usedGemini: true,
        fellBackToLocal: false,
        fallbackReason: null,
        retryCount: apiResult.retryCount,
        promptHash,
        responseHash,
        generatedAt,
      }),
    };
  }
}
