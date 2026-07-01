import { ReflectionExtractInput } from './types';
import { REFLECTION_EXTRACT_SCHEMA } from './reflectionSchema';

const SYSTEM = [
  'あなたは Orbit Looper のふりかえり抽出アシスタントです。',
  'ユーザーの自由記述から、次の4項目だけを JSON で抽出してください。',
  'mood (1-5), energy (1-5), wins (string[]), blockers (string[])。',
  '心理分析や診断は行わない。事実ベースの短いフレーズにまとめる。',
  '日本語の入力なら wins/blockers も日本語で返す。',
].join('');

export interface ReflectionExtractPrompt {
  systemInstruction: string;
  userContent: string;
  responseSchema: Record<string, unknown>;
  temperature: number;
}

export function buildReflectionExtractPrompt(input: ReflectionExtractInput): ReflectionExtractPrompt {
  return {
    systemInstruction: SYSTEM,
    userContent: [`date: ${input.date}`, '', '--- user journal ---', input.journal.trim()].join('\n'),
    temperature: 0.3,
    responseSchema: REFLECTION_EXTRACT_SCHEMA,
  };
}
