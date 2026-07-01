export interface GeminiSessionDto {
  taskId: string;
  startMinutes: number;
  endMinutes: number;
  reasonTags?: string[];
}

export interface GeminiBlockDto {
  title: string;
  startMinutes: number;
  endMinutes: number;
  type: 'buffer' | 'break' | 'power_nap';
}

export interface GeminiPlacementResultDto {
  sessions: GeminiSessionDto[];
  blocks: GeminiBlockDto[];
  reasonTags: string[];
}

export interface GeminiStructuredPrompt {
  systemInstruction: string;
  userContent: string;
  responseSchema: Record<string, unknown>;
  temperature?: number;
}

export interface GeminiPlacementPrompt extends GeminiStructuredPrompt {}

export interface GeminiTextPrompt {
  systemInstruction: string;
  userContent: string;
  /** Sampling temperature; defaults to a conversational 0.6. */
  temperature?: number;
}

export interface GeminiClientOptions {
  apiKey?: string;
  proxyUrl?: string;
  proxyToken?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
}

export interface GeminiGenerateResult {
  text: string | null;
  retryCount: number;
}
