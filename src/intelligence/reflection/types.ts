export interface ExtractedReflection {
  mood: number;
  energy: number;
  wins: string[];
  blockers: string[];
}

export type ReflectionExtractSource = 'gemini' | 'local';

export interface ReflectionExtractResult {
  data: ExtractedReflection;
  source: ReflectionExtractSource;
}

export interface ReflectionExtractInput {
  journal: string;
  date: string;
}
