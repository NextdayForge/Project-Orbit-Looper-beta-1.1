export const PLACEMENT_RESULT_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    sessions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          startMinutes: { type: 'integer' },
          endMinutes: { type: 'integer' },
          reasonTags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['taskId', 'startMinutes', 'endMinutes'],
      },
    },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          startMinutes: { type: 'integer' },
          endMinutes: { type: 'integer' },
          type: {
            type: 'string',
            enum: ['buffer', 'break', 'power_nap'],
          },
        },
        required: ['title', 'startMinutes', 'endMinutes', 'type'],
      },
    },
    reasonTags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['sessions', 'blocks', 'reasonTags'],
};

export const PLACEMENT_SYSTEM_INSTRUCTION = `You are a calendar placement engine for Orbit Looper.
Your job is to produce a PlacementResult JSON object for the Actual Input in the user message.
Follow the Planner Rules exactly. Use the few-shot example as a pattern for pacing and reasonTags.
Use startMinutes and endMinutes as minutes from midnight (0-1440).
Return ONLY valid JSON matching the response schema — no markdown, no commentary.`;
