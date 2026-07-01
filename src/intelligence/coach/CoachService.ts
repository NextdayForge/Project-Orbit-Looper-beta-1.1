import { GeminiClient, loadGeminiClient } from '../../infrastructure/gemini';
import { applyCoachScheduleAction } from './coachApply';
import {
  detectLocalConsultIntent,
  dtoToCoachReply,
  isAffirmativeReply,
  isNegativeReply,
} from './coachIntent';
import { buildConsultPrompt, buildExplainPrompt } from './coachPrompts';
import { CoachConsultStructuredDto } from './coachResponseSchema';
import { localConsult, localExplain } from './localCoach';
import {
  ApplyCoachScheduleDeps,
  CoachConsultInput,
  CoachContextInput,
  CoachReply,
  CoachScheduleAction,
} from './types';

function parseConsultDto(raw: string | null): CoachConsultStructuredDto | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as CoachConsultStructuredDto;
    if (!parsed.reply || typeof parsed.reply !== 'string') {
      return null;
    }
    return {
      reply: parsed.reply,
      intent: parsed.intent ?? 'general',
      proposedTasks: Array.isArray(parsed.proposedTasks) ? parsed.proposedTasks : [],
      offerSchedule: Boolean(parsed.offerSchedule),
      autoSchedule: Boolean(parsed.autoSchedule),
    };
  } catch {
    return null;
  }
}

/**
 * AI coach: structured consultations, task proposals, and schedule integration.
 */
export class CoachService {
  constructor(private readonly clientLoader: () => Promise<GeminiClient> = loadGeminiClient) {}

  async isAiEnabled(): Promise<boolean> {
    return (await this.clientLoader()).isConfigured();
  }

  async explainDayPlan(input: CoachContextInput): Promise<CoachReply> {
    const client = await this.clientLoader();
    if (!client.isConfigured()) {
      return localExplain(input);
    }

    const { text } = await client.generateStructuredJson(buildExplainPrompt(input));
    const dto = parseConsultDto(text);
    if (!dto?.reply) {
      return localExplain(input);
    }
    return { source: 'gemini', text: dto.reply.trim() };
  }

  async consult(
    input: CoachConsultInput,
    pendingAction?: CoachScheduleAction
  ): Promise<CoachReply> {
    if (isAffirmativeReply(input.message) && pendingAction) {
      return {
        source: 'local',
        text: '了解です。提案した内容を今日の予定に組み込みます。',
        action: { ...pendingAction, autoApply: true },
      };
    }

    if (isNegativeReply(input.message) && pendingAction) {
      return {
        source: 'local',
        text: 'わかりました。組み込みは見送ります。別の進め方が必要なら教えてください。',
      };
    }

    const client = await this.clientLoader();
    const localStructured = detectLocalConsultIntent(input.message);
    if (localStructured && !client.isConfigured()) {
      const mapped = dtoToCoachReply(localStructured);
      return { source: 'local', text: mapped.text, action: mapped.action };
    }

    if (client.isConfigured()) {
      const { text } = await client.generateStructuredJson(buildConsultPrompt(input));
      const dto = parseConsultDto(text);
      if (dto) {
        const mapped = dtoToCoachReply(dto);
        return { source: 'gemini', text: mapped.text, action: mapped.action };
      }
    }

    if (localStructured) {
      const mapped = dtoToCoachReply(localStructured);
      return { source: 'local', text: mapped.text, action: mapped.action };
    }

    return localConsult(input);
  }

  async applyScheduleAction(
    action: CoachScheduleAction,
    deps: ApplyCoachScheduleDeps
  ) {
    return applyCoachScheduleAction(action, deps);
  }
}

export const coachService = new CoachService();
