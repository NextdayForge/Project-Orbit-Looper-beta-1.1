import {
  GeminiClientOptions,
  GeminiGenerateResult,
  GeminiPlacementPrompt,
  GeminiStructuredPrompt,
  GeminiTextPrompt,
} from './types';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

interface GeminiRequestBody {
  systemInstruction: { parts: Array<{ text: string }> };
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  generationConfig: Record<string, unknown>;
}

export class GeminiClient {
  private readonly apiKey: string | undefined;
  private readonly proxyUrl: string | undefined;
  private readonly proxyToken: string | undefined;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(options: GeminiClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.proxyUrl = options.proxyUrl;
    this.proxyToken = options.proxyToken;
    this.model = options.model ?? process.env.EXPO_PUBLIC_GEMINI_MODEL ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  }

  isConfigured(): boolean {
    if (this.proxyUrl && this.proxyToken) {
      return true;
    }
    return Boolean(this.apiKey);
  }

  getModelName(): string {
    return this.model;
  }

  async generatePlacementJson(prompt: GeminiPlacementPrompt): Promise<GeminiGenerateResult> {
    return this.generateStructuredJson({ ...prompt, temperature: 0.3 });
  }

  async generateStructuredJson(prompt: GeminiStructuredPrompt): Promise<GeminiGenerateResult> {
    return this.generateContent({
      systemInstruction: prompt.systemInstruction,
      userContent: prompt.userContent,
      generationConfig: {
        temperature: prompt.temperature ?? 0.3,
        responseMimeType: 'application/json',
        responseSchema: prompt.responseSchema,
      },
    });
  }

  async generateText(prompt: GeminiTextPrompt): Promise<GeminiGenerateResult> {
    return this.generateContent({
      systemInstruction: prompt.systemInstruction,
      userContent: prompt.userContent,
      generationConfig: {
        temperature: prompt.temperature ?? 0.6,
      },
    });
  }

  private async generateContent(input: {
    systemInstruction: string;
    userContent: string;
    generationConfig: Record<string, unknown>;
  }): Promise<GeminiGenerateResult> {
    if (!this.isConfigured()) {
      return { text: null, retryCount: 0 };
    }

    const requestBody: GeminiRequestBody = {
      systemInstruction: { parts: [{ text: input.systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: input.userContent }] }],
      generationConfig: input.generationConfig,
    };

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.postGenerate(requestBody);
        if (!response.ok) {
          if (attempt < this.maxRetries - 1 && isRetryableStatus(response.status)) {
            await sleep(this.baseDelayMs * 2 ** attempt);
            continue;
          }
          return { text: null, retryCount: attempt };
        }

        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return { text: text || null, retryCount: attempt };
      } catch {
        if (attempt < this.maxRetries - 1) {
          await sleep(this.baseDelayMs * 2 ** attempt);
          continue;
        }
        return { text: null, retryCount: attempt };
      }
    }

    return { text: null, retryCount: this.maxRetries - 1 };
  }

  private async postGenerate(requestBody: GeminiRequestBody): Promise<Response> {
    if (this.proxyUrl && this.proxyToken) {
      return this.fetchWithTimeout(`${this.proxyUrl}/v1/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.proxyToken}`,
        },
        body: JSON.stringify({
          model: this.model,
          request: requestBody,
        }),
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    return this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

export type { GeminiClientOptions, GeminiGenerateResult, GeminiPlacementPrompt } from './types';
