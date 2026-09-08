import { TaskPriority } from '../../types/schedule';
import { formatTime } from '../../utils/time';
import { CoachConsultStructuredDto } from './coachResponseSchema';
import {
  CoachProposedFixedEvent,
  CoachProposedTask,
  CoachScheduleAction,
  CoachScheduleFixedEventsAction,
} from './types';

const AFFIRMATIVE = /^(はい|うん|ok|okay|お願い|組み込|入れて|追加|やって|それで|いいよ|大丈夫)/i;
const NEGATIVE = /^(いいえ|やめ|不要|結構|いらない|キャンセル)/i;

const REGISTER_HINTS = /登録|追加|組み込|入れて|タスクに|予定に|スケジュール|配置/;
const ADVICE_HINTS = /何をすれば|どうすれば|どうしたら|方法|手順|コツ|進め方|何から|わからない|分からない/;

/** Gate for local fixed-event detection: requires an explicit scheduling verb, not just any clock time mention. */
const FIXED_EVENT_HINTS = /予定|スケジュール|登録|追加|組み込|入れて|立てて|作って/;

const MINUTES_PER_DAY = 24 * 60;
/**
 * Default block length when the user gave no end time. Deliberately short and uniform:
 * a longer sleep-specific default would routinely cross midnight for realistic bedtimes
 * (22:00+ start), which this local fallback does not support — see "day boundary" clamp
 * below. Gemini's prompt (coachPrompts.ts) makes the smarter per-topic judgment instead;
 * this heuristic only needs to produce a reasonable marker block.
 */
const DEFAULT_FIXED_EVENT_MINUTES = 60;

export function isAffirmativeReply(message: string): boolean {
  const trimmed = message.trim();
  return AFFIRMATIVE.test(trimmed) || /組み込んで|予定に入れて|お願いします/.test(trimmed);
}

export function isNegativeReply(message: string): boolean {
  return NEGATIVE.test(trimmedMessage(message));
}

function trimmedMessage(message: string): string {
  return message.trim();
}

function clampPriority(value: number | undefined): TaskPriority {
  if (value == null || !Number.isFinite(value)) {
    return 3;
  }
  return Math.min(5, Math.max(1, Math.round(value))) as TaskPriority;
}

function uniqueTasks(tasks: CoachProposedTask[]): CoachProposedTask[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = task.title.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function extractRegisterTasks(message: string): CoachProposedTask[] {
  const tasks: CoachProposedTask[] = [];
  const patterns = [
    /「([^」]+)」/g,
    /『([^』]+)』/g,
    /(.+?)を(?:タスクに|予定に)?(?:登録|追加|組み込)/,
    /(?:登録|追加|組み込)[：:]\s*(.+)/,
    /タスク[：:]\s*(.+)/,
  ];

  for (const pattern of patterns) {
    if (pattern.global) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(message)) !== null) {
        const title = match[1]?.trim();
        if (title && title.length <= 80) {
          tasks.push({ title, priority: 3 });
        }
      }
    } else {
      const match = message.match(pattern);
      const title = match?.[1]?.trim();
      if (title && title.length <= 80) {
        tasks.push({ title, priority: 3 });
      }
    }
  }

  if (tasks.length === 0 && REGISTER_HINTS.test(message)) {
    const stripped = message
      .replace(/この|その|を|に|して|ください|お願い|タスク|登録|追加|組み込|予定|スケジュール|配置/g, '')
      .trim();
    if (stripped.length >= 2 && stripped.length <= 60) {
      tasks.push({ title: stripped, priority: 3 });
    }
  }

  return uniqueTasks(tasks);
}

export interface ParsedTimeExpression {
  /** Minutes since midnight (0–1439). */
  minutes: number;
  /** The substring that was matched, so callers can strip it from the title. */
  matchedText: string;
}

/**
 * Ordered most-specific-first: a plain "N時" pattern would otherwise swallow
 * the digits inside "午後10時" or "10時半" before those patterns get a chance.
 */
const TIME_PATTERNS: { regex: RegExp; toMinutes: (m: RegExpMatchArray) => number }[] = [
  {
    // 10pm / 10:30pm / 10 PM — checked before the bare HH:MM pattern below, otherwise
    // "10:30pm" would match "10:30" as 24-hour time and the "pm" would never be seen.
    regex: /(\d{1,2})(?::([0-5]\d))?\s*([ap]m)/i,
    toMinutes: (m) => {
      const hour = (Number(m[1]) % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0);
      return hour * 60 + (m[2] ? Number(m[2]) : 0);
    },
  },
  {
    // 22:00 / 9:05
    regex: /([01]?\d|2[0-3]):([0-5]\d)/,
    toMinutes: (m) => Number(m[1]) * 60 + Number(m[2]),
  },
  {
    // 午後10時30分 / 午前7時5分
    regex: /(午前|午後)(\d{1,2})時(\d{1,2})分/,
    toMinutes: (m) => {
      const hour = (Number(m[2]) % 12) + (m[1] === '午後' ? 12 : 0);
      return hour * 60 + Number(m[3]);
    },
  },
  {
    // 午後10時半
    regex: /(午前|午後)(\d{1,2})時半/,
    toMinutes: (m) => {
      const hour = (Number(m[2]) % 12) + (m[1] === '午後' ? 12 : 0);
      return hour * 60 + 30;
    },
  },
  {
    // 午後10時
    regex: /(午前|午後)(\d{1,2})時/,
    toMinutes: (m) => {
      const hour = (Number(m[2]) % 12) + (m[1] === '午後' ? 12 : 0);
      return hour * 60;
    },
  },
  {
    // 22時30分
    regex: /(\d{1,2})時(\d{1,2})分/,
    toMinutes: (m) => Number(m[1]) * 60 + Number(m[2]),
  },
  {
    // 22時半
    regex: /(\d{1,2})時半/,
    toMinutes: (m) => Number(m[1]) * 60 + 30,
  },
  {
    // 22時
    regex: /(\d{1,2})時/,
    toMinutes: (m) => Number(m[1]) * 60,
  },
];

/** Pure parser for Japanese/English clock-time expressions. No side effects, no i18n framework. */
export function parseTimeExpression(text: string): ParsedTimeExpression | null {
  for (const { regex, toMinutes } of TIME_PATTERNS) {
    const match = text.match(regex);
    if (!match) {
      continue;
    }
    const minutes = toMinutes(match);
    if (Number.isFinite(minutes) && minutes >= 0 && minutes < MINUTES_PER_DAY) {
      return { minutes, matchedText: match[0] };
    }
  }
  return null;
}

const FIXED_EVENT_TRAILING_PATTERNS = [
  /の予定$/,
  /予定$/,
  /を立てて$/,
  /に立てて$/,
  /を入れて$/,
  /に入れて$/,
  /を組んで$/,
  /に組んで$/,
  /を組み込んで$/,
  /に組み込んで$/,
  /を登録して$/,
  /に登録して$/,
  /を追加して$/,
  /に追加して$/,
  /でお願いします$/,
  /お願いします$/,
  /お願い$/,
  /してください$/,
  /して$/,
  /を$/,
  /に$/,
];

/** Repeatedly strips one trailing request phrase at a time (e.g. "…予定を立てて" → "…予定" → ""). */
function stripFixedEventTrailers(text: string): string {
  let result = text;
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of FIXED_EVENT_TRAILING_PATTERNS) {
      const next = result.replace(pattern, '');
      if (next !== result) {
        result = next;
        changed = true;
      }
    }
  }
  return result;
}

function extractFixedEventTitle(message: string, matchedTimeText: string): string {
  const withoutTime = message.replace(matchedTimeText, '');
  const withoutLeadingParticle = withoutTime.replace(/^(に|から)/, '');
  const withoutTrailers = stripFixedEventTrailers(withoutLeadingParticle);
  return withoutTrailers.replace(/[、。！!?？]+$/, '').trim();
}

/**
 * Detects an explicit-time scheduling request ("22時に寝る予定を立てて") and turns it into a
 * CalendarBlock proposal — never a Task, per design principle 1 (Task has no way to pin a clock time).
 * Gated on FIXED_EVENT_HINTS so an incidental time mention in unrelated chat doesn't misfire.
 */
export function extractFixedEvents(message: string): CoachProposedFixedEvent[] {
  if (!FIXED_EVENT_HINTS.test(message)) {
    return [];
  }

  const parsed = parseTimeExpression(message);
  if (!parsed) {
    return [];
  }

  const title = extractFixedEventTitle(message, parsed.matchedText);
  if (!title) {
    return [];
  }

  const startMinutes = parsed.minutes;
  const endMinutes = Math.min(MINUTES_PER_DAY, startMinutes + DEFAULT_FIXED_EVENT_MINUTES);
  if (endMinutes <= startMinutes) {
    return [];
  }

  return [{ title, startMinutes, endMinutes }];
}

export function extractGoalTopic(message: string): string {
  return message
    .replace(/[？?].*$/, '')
    .replace(/(.+?)したい.*/, '$1')
    .replace(/(.+?)たい.*/, '$1')
    .replace(/何をすればいい|どうすればいい|どうしたらいい|方法|手順|コツ/g, '')
    .replace(/[、。！!]/g, '')
    .trim();
}

export function buildAdviceTasks(goal: string): CoachProposedTask[] {
  const topic = goal || 'やりたいこと';

  if (/片付|整理|掃除|クリーン|ルーム/.test(topic)) {
    return [
      { title: '5分だけゴミ・不用品を捨てる', estimatedMinutes: 5, priority: 3 },
      { title: '15分で一箇所だけ分類する', estimatedMinutes: 15, priority: 3 },
      { title: '25分集中で仕上げる', estimatedMinutes: 25, priority: 3 },
    ];
  }

  if (/勉強|学習|英語|数学|試験|課題|レポート/.test(topic)) {
    return [
      { title: '教材とゴールを10分で確認する', estimatedMinutes: 10, priority: 2 },
      { title: '25分集中で核心部分に取り組む', estimatedMinutes: 25, priority: 2 },
      { title: '5分で理解度をメモする', estimatedMinutes: 5, priority: 3 },
    ];
  }

  if (/運動|筋トレ|散歩|健康/.test(topic)) {
    return [
      { title: '着替えと準備（5分）', estimatedMinutes: 5, priority: 3 },
      { title: '20分のメイン運動', estimatedMinutes: 20, priority: 3 },
      { title: 'ストレッチと水分（5分）', estimatedMinutes: 5, priority: 4 },
    ];
  }

  return [
    { title: `${topic}の準備（10分）`, estimatedMinutes: 10, priority: 3 },
    { title: `${topic}に25分集中する`, estimatedMinutes: 25, priority: 3 },
    { title: '進捗をメモする（5分）', estimatedMinutes: 5, priority: 4 },
  ];
}

export function buildScheduleAction(
  tasks: CoachProposedTask[],
  options: { autoApply: boolean; summary?: string }
): CoachScheduleAction | undefined {
  const normalized = uniqueTasks(tasks.filter((task) => task.title.trim().length > 0));
  if (normalized.length === 0) {
    return undefined;
  }

  return {
    kind: 'schedule_tasks',
    tasks: normalized.map((task) => ({
      ...task,
      priority: clampPriority(task.priority),
    })),
    autoApply: options.autoApply,
    summary: options.summary,
  };
}

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(MINUTES_PER_DAY, Math.max(0, Math.round(value)));
}

export function buildFixedEventScheduleAction(
  events: CoachProposedFixedEvent[],
  options: { autoApply: boolean; summary?: string }
): CoachScheduleFixedEventsAction | undefined {
  const normalized = events
    .filter((event) => event.title.trim().length > 0)
    .map((event) => ({
      title: event.title.trim(),
      startMinutes: clampMinutes(event.startMinutes),
      endMinutes: clampMinutes(event.endMinutes),
    }))
    .filter((event) => event.endMinutes > event.startMinutes);

  if (normalized.length === 0) {
    return undefined;
  }

  return {
    kind: 'schedule_fixed_events',
    events: normalized,
    autoApply: options.autoApply,
    summary: options.summary,
  };
}

export function dtoToCoachReply(dto: CoachConsultStructuredDto): {
  text: string;
  action?: CoachScheduleAction;
} {
  if (dto.intent === 'register_fixed_event') {
    const events = dto.proposedFixedEvents ?? [];
    const autoApply = Boolean(dto.autoSchedule) && events.length > 0;
    return {
      text: dto.reply.trim(),
      action: buildFixedEventScheduleAction(events, { autoApply, summary: dto.reply }),
    };
  }

  const tasks: CoachProposedTask[] = (dto.proposedTasks ?? [])
    .filter((task) => task.title?.trim())
    .map((task) => ({
      title: task.title.trim(),
      priority: clampPriority(task.priority),
      estimatedMinutes: task.estimatedMinutes,
      note: task.rationale,
    }));

  const shouldOffer =
    dto.offerSchedule && tasks.length > 0 && dto.intent !== 'emotional';

  const autoApply = dto.autoSchedule && dto.intent === 'register_tasks' && tasks.length > 0;

  return {
    text: dto.reply.trim(),
    action: shouldOffer || autoApply
      ? buildScheduleAction(tasks, { autoApply, summary: dto.reply })
      : undefined,
  };
}

export function detectLocalConsultIntent(message: string): CoachConsultStructuredDto | null {
  const text = trimmedMessage(message);

  if (isAffirmativeReply(text) || isNegativeReply(text)) {
    return null;
  }

  const fixedEvents = extractFixedEvents(text);
  if (fixedEvents.length > 0) {
    const [event] = fixedEvents;
    return {
      reply: `了解です。「${event.title}」を${formatTime(event.startMinutes, true)}から今日の予定に固定で入れます。`,
      intent: 'register_fixed_event',
      proposedTasks: [],
      proposedFixedEvents: fixedEvents,
      offerSchedule: true,
      autoSchedule: true,
    };
  }

  const registerTasks = extractRegisterTasks(text);
  if (registerTasks.length > 0 || (REGISTER_HINTS.test(text) && text.length < 80)) {
    const tasks = registerTasks.length > 0 ? registerTasks : extractRegisterTasks(`${text}を登録`);
    if (tasks.length > 0) {
      const titles = tasks.map((task) => task.title).join('、');
      return {
        reply: `了解です。「${titles}」をタスク化して、空き時間に最適化して今日の予定へ組み込みます。`,
        intent: 'register_tasks',
        proposedTasks: tasks,
        offerSchedule: true,
        autoSchedule: true,
      };
    }
  }

  if (ADVICE_HINTS.test(text) || /したい/.test(text)) {
    const goal = extractGoalTopic(text);
    const steps = buildAdviceTasks(goal);
    const stepText = steps.map((step, index) => `${index + 1}. ${step.title}`).join(' ');
    return {
      reply: `${goal || 'その目標'}なら、まず小さく分けるのが近道です。${stepText} この流れを今日の予定に組み込みますか？`,
      intent: 'advice',
      proposedTasks: steps,
      offerSchedule: true,
      autoSchedule: false,
    };
  }

  return null;
}
