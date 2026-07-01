import { loadGeminiClient } from '../../infrastructure/gemini';
import { buildReflectionExtractPrompt } from './reflectionPrompts';
import { localExtractReflection, parseExtractedReflectionJson } from './localReflectionExtract';
import { ReflectionExtractInput, ReflectionExtractResult } from './types';

/**
 * Extracts structured Reflection fields from free-form journal text.
 * Gemini when configured; keyword heuristics otherwise (Architecture v1 Sprint 5).
 */
export class ReflectionExtractor {
  async isAiEnabled(): Promise<boolean> {
    return (await loadGeminiClient()).isConfigured();
  }

  async extract(input: ReflectionExtractInput): Promise<ReflectionExtractResult> {
    const journal = input.journal.trim();
    if (journal.length === 0) {
      return localExtractReflection({ ...input, journal: '' });
    }

    const client = await loadGeminiClient();
    if (!client.isConfigured()) {
      return localExtractReflection(input);
    }

    const prompt = buildReflectionExtractPrompt(input);
    const { text } = await client.generateStructuredJson({
      systemInstruction: prompt.systemInstruction,
      userContent: prompt.userContent,
      responseSchema: prompt.responseSchema,
      temperature: prompt.temperature,
    });

    if (!text) {
      return localExtractReflection(input);
    }

    const parsed = parseExtractedReflectionJson(text);
    if (!parsed) {
      return localExtractReflection(input);
    }

    return { data: parsed, source: 'gemini' };
  }
}

export const reflectionExtractor = new ReflectionExtractor();
