import { AiScheduleItem, AiTaskInput, DEFAULT_PRIORITY, EventColor, ScheduleEvent, TaskPriority } from '../types/schedule';
import { generateId, isValidMinutes, timeToMinutes, toDateKey } from '../utils/time';
import { carryOverFromTasks, isAuxiliaryEvent, parsePriorityFromText } from './schedulePlanner';
import {
  buildOptimizedSchedule,
  formatFreeSlots,
  getFreeSlots,
  ParsedTask,
  refineAiSchedule,
  validateSchedule,
} from './scheduleOptimizer';

const SYSTEM_PROMPT = `
あなたはプロの時間管理コーチ兼スケジューラーです。ユーザーのタスクを、指定日の空き時間に最適配置した5分刻みスケジュールを作成してください。

【絶対禁止】
- 既存予定の削除・クリア・上書きを提案・実行しない
- 空の配列を返して既存予定を消すような応答をしない
- 「削除」「消去」はスケジュール生成の指示として解釈しない

【最優先ルール】
1. 既存予定（完了・固定）と絶対に重複しない
2. 提示された「空き時間帯」の中に配置する
3. 優先度1（最高）のタスクを最適な時間帯に先に配置
4. startTime / endTime は必ず "HH:MM" 形式（例: "09:00", "14:30"）

【出力形式】JSON配列のみ:
{ "title", "startTime": "HH:MM", "endTime": "HH:MM", "durationMinutes", "type": "task"|"buffer"|"power_nap"|"break", "category", "priority"?: number }
`;

const TASK_RULES: Record<
  string,
  { title: string; minutes: number; category: string; type?: AiScheduleItem['type'] }
> = {
  英語: { title: '英語の過去問', minutes: 25, category: 'study' },
  数学: { title: '数学（微積）', minutes: 30, category: 'study' },
  微積: { title: '数学（微積）', minutes: 30, category: 'study' },
  ベース: { title: 'ベースの練習', minutes: 20, category: 'music' },
  片付け: { title: '部屋の片付け', minutes: 15, category: 'life' },
  運動: { title: '運動・ストレッチ', minutes: 30, category: 'health' },
  昼寝: { title: 'パワーナップ', minutes: 20, category: 'rest', type: 'power_nap' },
  ナップ: { title: 'パワーナップ', minutes: 20, category: 'rest', type: 'power_nap' },
  会議: { title: 'ミーティング', minutes: 30, category: 'work' },
  勉強: { title: '勉強', minutes: 25, category: 'study' },
};

function colorForItem(type: AiScheduleItem['type'], category?: string): EventColor {
  if (type === 'buffer' || type === 'break') return 'teal';
  if (type === 'power_nap') return 'orange';
  switch (category) {
    case 'study':
      return 'blue';
    case 'music':
      return 'purple';
    case 'life':
    case 'health':
      return 'green';
    case 'work':
      return 'red';
    default:
      return 'blue';
  }
}

function resolveTaskRule(title: string): { minutes: number; category: string; type: AiScheduleItem['type'] } {
  for (const [key, rule] of Object.entries(TASK_RULES)) {
    if (title.includes(key)) {
      return { minutes: rule.minutes, category: rule.category, type: rule.type ?? 'task' };
    }
  }
  return { minutes: 20, category: 'general', type: 'task' };
}

export function tasksFromInputs(inputs: AiTaskInput[]): ParsedTask[] {
  return inputs
    .filter((t) => t.title.trim())
    .map((input) => {
      const { clean, priority: parsedPriority } = parsePriorityFromText(input.title.trim());
      const rule = resolveTaskRule(clean);
      return {
        id: generateId(),
        title: clean,
        minutes: rule.minutes,
        category: rule.category,
        type: rule.type,
        priority: input.priority ?? parsedPriority,
      };
    });
}

function resolveTaskMeta(
  item: AiScheduleItem,
  parsedTasks: ParsedTask[],
  usedIds: Set<string>
): ParsedTask | undefined {
  if (item.sourceTaskId) {
    const byId = parsedTasks.find((t) => t.id === item.sourceTaskId);
    if (byId) return byId;
  }
  const byTitle = parsedTasks.find((t) => t.title === item.title && t.id && !usedIds.has(t.id));
  if (byTitle) return byTitle;
  return parsedTasks.find((t) => t.id && !usedIds.has(t.id));
}

function aiItemsToEvents(items: AiScheduleItem[], dateKey: string, parsedTasks: ParsedTask[]): ScheduleEvent[] {
  const usedIds = new Set<string>();
  const result: ScheduleEvent[] = [];

  for (const item of items) {
    const isAux = item.type === 'buffer' || item.type === 'break';
    const meta = !isAux ? resolveTaskMeta(item, parsedTasks, usedIds) : undefined;
    if (meta?.id) usedIds.add(meta.id);

    let start = timeToMinutes(item.startTime);
    let end = timeToMinutes(item.endTime);
    if (!isValidMinutes(start) && isValidMinutes(end) && item.durationMinutes) {
      start = end - item.durationMinutes;
    }
    if (!isValidMinutes(end) && isValidMinutes(start) && item.durationMinutes) {
      end = start + item.durationMinutes;
    }
    if (!isValidMinutes(start) || !isValidMinutes(end) || end <= start) continue;

    result.push({
      id: meta?.id ?? generateId(),
      date: dateKey,
      title: item.title,
      startMinutes: start,
      endMinutes: end,
      color: colorForItem(item.type, item.category),
      priority: (meta?.priority ?? item.priority ?? DEFAULT_PRIORITY) as TaskPriority,
      note: isAux ? item.category : meta?.category !== 'general' ? meta?.category : undefined,
      isAuxiliary: isAux,
      completed: false,
    });
  }

  return result;
}

function formatExistingEvents(existing: ScheduleEvent[]): string {
  if (existing.length === 0) return 'なし';
  return existing
    .map((e) => {
      const p = e.priority ?? DEFAULT_PRIORITY;
      return `[P${p}] ${e.title} ${Math.floor(e.startMinutes / 60)}:${String(e.startMinutes % 60).padStart(2, '0')}-${Math.floor(e.endMinutes / 60)}:${String(e.endMinutes % 60).padStart(2, '0')}${e.locked ? ' (固定)' : ''}${e.completed ? ' (完了)' : ''}`;
    })
    .join('\n');
}

function parseScheduleResponse(content: string): AiScheduleItem[] | null {
  const trimmed = content.trim();
  try {
    const parsed = JSON.parse(trimmed) as AiScheduleItem[] | { schedule?: AiScheduleItem[] };
    const items = Array.isArray(parsed) ? parsed : parsed.schedule;
    if (!items || !Array.isArray(items) || items.length === 0) return null;
    return items.filter((item) => item.title && (item.startTime || item.durationMinutes));
  } catch {
    const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;
    try {
      const parsed = JSON.parse(jsonMatch[0]) as AiScheduleItem[];
      return parsed.filter((item) => item.title && (item.startTime || item.durationMinutes));
    } catch {
      return null;
    }
  }
}

function buildUserPrompt(
  dateKey: string,
  existing: ScheduleEvent[],
  bufferMinutes: number,
  tasks: ParsedTask[]
): string {
  const freeSlots = getFreeSlots(dateKey, existing, bufferMinutes);
  const todayKey = toDateKey(new Date());
  const nowHint =
    dateKey === todayKey
      ? `現在時刻: ${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')}\n`
      : '';
  const taskList = tasks
    .map((t) => `- ${t.title}（${t.minutes}分, 優先度${t.priority ?? 3}）`)
    .join('\n');

  return `${nowHint}日付: ${dateKey}
バッファ: ${bufferMinutes}分

【既存予定（削除・変更禁止）】
${formatExistingEvents(existing)}

【空き時間帯】
${formatFreeSlots(freeSlots)}

【新規に配置するタスクのみ】
${taskList}

上記タスクを空き時間に追加配置したJSON配列を返してください。既存予定はそのまま残してください。`;
}

async function callGemini(
  dateKey: string,
  existing: ScheduleEvent[],
  bufferMinutes: number,
  tasks: ParsedTask[]
): Promise<AiScheduleItem[] | null> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-2.5-flash';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: buildUserPrompt(dateKey, existing, bufferMinutes, tasks) }] }],
          generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!content) return null;
    return parseScheduleResponse(content);
  } catch {
    return null;
  }
}

function findOverflowTasks(tasks: ParsedTask[], placed: ScheduleEvent[]): ParsedTask[] {
  const placedIds = new Set(placed.filter((e) => !e.isAuxiliary).map((e) => e.id));
  return tasks.filter((t) => t.id && !placedIds.has(t.id));
}

export async function generateAiSchedule(
  taskInputs: AiTaskInput[],
  targetDate: Date,
  existingEvents: ScheduleEvent[],
  bufferMinutes = 5
): Promise<ScheduleEvent[]> {
  const now = new Date();
  const dateKey = toDateKey(targetDate);
  const dayExisting = existingEvents.filter((e) => e.date === dateKey && !isAuxiliaryEvent(e));

  const tasks = tasksFromInputs(taskInputs);
  if (tasks.length === 0) return [];

  const aiResult = await callGemini(dateKey, dayExisting, bufferMinutes, tasks);

  let items: AiScheduleItem[];
  if (aiResult && aiResult.length > 0) {
    items = refineAiSchedule(aiResult, tasks, dateKey, dayExisting, bufferMinutes, now);
    if (!validateSchedule(items, dayExisting)) {
      items = buildOptimizedSchedule(tasks, dateKey, dayExisting, bufferMinutes, now);
    }
  } else {
    items = buildOptimizedSchedule(tasks, dateKey, dayExisting, bufferMinutes, now);
  }

  const dayEvents = aiItemsToEvents(items, dateKey, tasks);
  const overflow = findOverflowTasks(tasks, dayEvents);

  if (overflow.length > 0) {
    const base = [...existingEvents.filter((e) => e.date !== dateKey), ...dayExisting, ...dayEvents];
    const full = carryOverFromTasks(base, overflow, dateKey, bufferMinutes, now);
    return full.filter((e) => !existingEvents.some((ex) => ex.id === e.id));
  }

  return dayEvents;
}

export { SYSTEM_PROMPT, tasksFromInputs as parseTasksFromInputs };
