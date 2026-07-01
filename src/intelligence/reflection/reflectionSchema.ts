/** JSON schema for Gemini reflection extraction (MVP fields only). */
export const REFLECTION_EXTRACT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    mood: {
      type: 'integer',
      description: 'Overall mood 1=very low … 5=excellent',
    },
    energy: {
      type: 'integer',
      description: 'Energy level 1=exhausted … 5=peak',
    },
    wins: {
      type: 'array',
      items: { type: 'string' },
      description: 'What went well today (short phrases)',
    },
    blockers: {
      type: 'array',
      items: { type: 'string' },
      description: 'What got in the way (short phrases)',
    },
  },
  required: ['mood', 'energy', 'wins', 'blockers'],
};

export function clampScale(value: unknown, fallback = 3): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, 8);
}
