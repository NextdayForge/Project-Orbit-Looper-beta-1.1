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

const FULLWIDTH_DIGIT_OFFSET = '０'.charCodeAt(0) - '0'.charCodeAt(0);

/**
 * Normalizes full-width characters that show up when a schedule is pasted from a
 * Japanese IME or spreadsheet, so the half-width TIME_PATTERNS below can see them:
 * full-width digits ０-９, full-width colon "：", the various dashes used as a
 * range separator ("～" "〜" "ー", plus the already-half-width "-" for symmetry),
 * and full-width space "　". Idempotent — safe to call more than once.
 */
export function normalizeTimeText(text: string): string {
  return text
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - FULLWIDTH_DIGIT_OFFSET))
    .replace(/：/g, ':')
    .replace(/[～〜ー]/g, '-')
    .replace(/　/g, ' ');
}

export interface ParsedTimeExpression {
  /** Minutes since midnight (0–1439) for the start of the expression. */
  minutes: number;
  /** Present when the text expressed a range ("8:30〜9:00"): minutes since midnight for the end. */
  endMinutes?: number;
  /** The full substring that was matched — the whole range when one was found, otherwise just the start time. */
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

/**
 * Scans ALL patterns and keeps the one starting earliest in the string — not just the
 * first pattern (in specificity order) that matches anywhere. Without this, "9時〜12時半"
 * would return "12時半" as the start: the plain "N時" pattern (which would correctly match
 * "9時" at index 0) sits after "N時半" in TIME_PATTERNS, and "N時半" only matches later
 * ("12時半") but still gets tried — and returned — before "N時" ever gets a chance.
 * Ties (same start index, e.g. "22時半" matches both "N時半" and the plain "N時" prefix of
 * it) go to whichever pattern is listed first, preserving the specific-before-generic order.
 */
function matchSingleTime(text: string): { minutes: number; matchedText: string } | null {
  let best: { index: number; priority: number; minutes: number; matchedText: string } | null = null;

  // A plain for-loop, not .forEach(): TS's control-flow narrowing for a `let` reassigned
  // inside a callback doesn't carry back out to the enclosing scope, which otherwise makes
  // `best` look permanently null (and the object branch below unreachable) to the compiler.
  for (let priority = 0; priority < TIME_PATTERNS.length; priority += 1) {
    const { regex, toMinutes } = TIME_PATTERNS[priority];
    const match = text.match(regex);
    if (!match || match.index === undefined) {
      continue;
    }
    const minutes = toMinutes(match);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes >= MINUTES_PER_DAY) {
      continue;
    }
    if (!best || match.index < best.index || (match.index === best.index && priority < best.priority)) {
      best = { index: match.index, priority, minutes, matchedText: match[0] };
    }
  }

  if (!best) {
    return null;
  }
  return { minutes: best.minutes, matchedText: best.matchedText };
}

/** A range separator directly between two times, e.g. the "-" in "8:30-9:00" (after normalization). */
const RANGE_SEPARATOR = /^\s*-\s*/;

/**
 * Pure parser for Japanese/English clock-time expressions, including a start-end range
 * ("8:30〜9:00", "9時〜12時半", "9:00-12:30"). No side effects, no i18n framework.
 * Normalizes full-width input internally, so callers may pass raw pasted text as-is.
 */
export function parseTimeExpression(text: string): ParsedTimeExpression | null {
  const normalized = normalizeTimeText(text);
  const start = matchSingleTime(normalized);
  if (!start) {
    return null;
  }

  const startIndex = normalized.indexOf(start.matchedText);
  const afterStart = normalized.slice(startIndex + start.matchedText.length);
  const separatorMatch = afterStart.match(RANGE_SEPARATOR);
  if (separatorMatch) {
    const remainder = afterStart.slice(separatorMatch[0].length);
    const end = matchSingleTime(remainder);
    // The end time must sit immediately after the separator — otherwise this "-" isn't
    // introducing a time range at all (e.g. unrelated text between two clock mentions).
    if (end && remainder.indexOf(end.matchedText) === 0) {
      const matchedText = normalized.slice(
        startIndex,
        startIndex + start.matchedText.length + separatorMatch[0].length + end.matchedText.length
      );
      return { minutes: start.minutes, endMinutes: end.minutes, matchedText };
    }
  }

  return { minutes: start.minutes, matchedText: start.matchedText };
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

function extractFixedEventFromLine(
  rawLine: string,
  options: { requireHint: boolean }
): CoachProposedFixedEvent | null {
  const normalized = normalizeTimeText(rawLine);

  if (options.requireHint && !FIXED_EVENT_HINTS.test(normalized)) {
    return null;
  }

  const parsed = parseTimeExpression(normalized);
  if (!parsed) {
    return null;
  }

  const title = extractFixedEventTitle(normalized, parsed.matchedText);
  if (!title) {
    return null;
  }

  const startMinutes = parsed.minutes;
  const endMinutes =
    parsed.endMinutes !== undefined
      ? Math.min(MINUTES_PER_DAY, parsed.endMinutes)
      : Math.min(MINUTES_PER_DAY, startMinutes + DEFAULT_FIXED_EVENT_MINUTES);

  if (endMinutes <= startMinutes) {
    return null;
  }

  return { title, startMinutes, endMinutes };
}

/**
 * Detects explicit-time scheduling requests and turns them into CalendarBlock proposals —
 * never Tasks, per design principle 1 (Task has no way to pin a clock time).
 *
 * Two modes:
 * - Single line/message ("22時に寝る予定を立てて"): gated on FIXED_EVENT_HINTS so an
 *   incidental time mention in unrelated chat doesn't misfire.
 * - Multi-line paste (a whole day's plan, one item per line): the hint gate is dropped
 *   per line — pasting "朝ご飯 8:30〜9:00" line by line *is* the request, it never says
 *   "予定に登録して" anywhere. Each line that parses to a time becomes one event; lines
 *   without a parseable time (headers, blank lines) are silently skipped.
 */
export function extractFixedEvents(message: string): CoachProposedFixedEvent[] {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length > 1) {
    return lines
      .map((line) => extractFixedEventFromLine(line, { requireHint: false }))
      .filter((event): event is CoachProposedFixedEvent => event !== null);
  }

  const single = extractFixedEventFromLine(message, { requireHint: true });
  return single ? [single] : [];
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
    const reply =
      fixedEvents.length === 1
        ? `了解です。「${fixedEvents[0].title}」を${formatTime(fixedEvents[0].startMinutes, true)}から今日の予定に固定で入れます。`
        : `了解です。${fixedEvents.length}件を今日の予定に固定で入れます。`;
    return {
      reply,
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
