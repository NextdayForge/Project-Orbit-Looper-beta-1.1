export const COACH_CONSULT_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    reply: {
      type: 'STRING',
      description: 'ユーザーへの自然な日本語返答。2〜5文。箇条書き記号は使わない。',
    },
    intent: {
      type: 'STRING',
      enum: ['emotional', 'advice', 'register_tasks', 'register_fixed_event', 'plan_question', 'general'],
    },
    proposedTasks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          priority: { type: 'INTEGER' },
          estimatedMinutes: { type: 'INTEGER' },
          rationale: { type: 'STRING' },
        },
        required: ['title'],
      },
    },
    proposedFixedEvents: {
      type: 'ARRAY',
      description: '時刻が明示された固定予定（起床・就寝・通院など）。Task化しない。',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          startMinutes: { type: 'INTEGER', description: '0時からの経過分（0〜1440）' },
          endMinutes: { type: 'INTEGER', description: '0時からの経過分（0〜1440）' },
        },
        required: ['title', 'startMinutes', 'endMinutes'],
      },
    },
    offerSchedule: {
      type: 'BOOLEAN',
      description: '今日の予定への組み込みを提案するか',
    },
    autoSchedule: {
      type: 'BOOLEAN',
      description: 'register_tasks のとき true。即座に組み込む意図。',
    },
  },
  required: ['reply', 'intent', 'proposedTasks', 'offerSchedule', 'autoSchedule'],
};

export interface CoachConsultStructuredDto {
  reply: string;
  intent: 'emotional' | 'advice' | 'register_tasks' | 'register_fixed_event' | 'plan_question' | 'general';
  proposedTasks: {
    title: string;
    priority?: number;
    estimatedMinutes?: number;
    rationale?: string;
  }[];
  proposedFixedEvents?: {
    title: string;
    startMinutes: number;
    endMinutes: number;
  }[];
  offerSchedule: boolean;
  autoSchedule: boolean;
}
