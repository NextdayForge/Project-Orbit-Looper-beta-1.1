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
縺ゅ↑縺溘・繝励Ο縺ｮ譎る俣邂｡逅・さ繝ｼ繝∝・繧ｹ繧ｱ繧ｸ繝･繝ｼ繝ｩ繝ｼ縺ｧ縺吶ゅΘ繝ｼ繧ｶ繝ｼ縺ｮ繧ｿ繧ｹ繧ｯ繧偵∵欠螳壽律縺ｮ遨ｺ縺肴凾髢薙↓譛驕ｩ驟咲ｽｮ縺励◆5蛻・綾縺ｿ繧ｹ繧ｱ繧ｸ繝･繝ｼ繝ｫ繧剃ｽ懈・縺励※縺上□縺輔＞縲・
縲千ｵｶ蟇ｾ遖∵ｭ｢縲・- 譌｢蟄倅ｺ亥ｮ壹・蜑企勁繝ｻ繧ｯ繝ｪ繧｢繝ｻ荳頑嶌縺阪ｒ謠先｡医・螳溯｡後＠縺ｪ縺・- 遨ｺ縺ｮ驟榊・繧定ｿ斐＠縺ｦ譌｢蟄倅ｺ亥ｮ壹ｒ豸医☆繧医≧縺ｪ蠢懃ｭ斐ｒ縺励↑縺・- 縲悟炎髯､縲阪梧ｶ亥悉縲阪・繧ｹ繧ｱ繧ｸ繝･繝ｼ繝ｫ逕滓・縺ｮ謖・､ｺ縺ｨ縺励※隗｣驥医＠縺ｪ縺・
縲先怙蜆ｪ蜈医Ν繝ｼ繝ｫ縲・1. 譌｢蟄倅ｺ亥ｮ夲ｼ亥ｮ御ｺ・・蝗ｺ螳夲ｼ峨→邨ｶ蟇ｾ縺ｫ驥崎､・＠縺ｪ縺・2. 謠千､ｺ縺輔ｌ縺溘檎ｩｺ縺肴凾髢灘ｸｯ縲阪・荳ｭ縺ｫ驟咲ｽｮ縺吶ｋ
3. 蜆ｪ蜈亥ｺｦ1・域怙鬮假ｼ峨・繧ｿ繧ｹ繧ｯ繧呈怙驕ｩ縺ｪ譎る俣蟶ｯ縺ｫ蜈医↓驟咲ｽｮ
4. startTime / endTime 縺ｯ蠢・★ "HH:MM" 蠖｢蠑擾ｼ井ｾ・ "09:00", "14:30"・・
縲仙・蜉帛ｽ｢蠑上遷SON驟榊・縺ｮ縺ｿ:
{ "title", "startTime": "HH:MM", "endTime": "HH:MM", "durationMinutes", "type": "task"|"buffer"|"power_nap"|"break", "category", "priority"?: number }
`;

const TASK_RULES: Record<
  string,
  { title: string; minutes: number; category: string; type?: AiScheduleItem['type'] }
> = {
  闍ｱ隱・ { title: '闍ｱ隱槭・驕主悉蝠・, minutes: 25, category: 'study' },
  謨ｰ蟄ｦ: { title: '謨ｰ蟄ｦ・亥ｾｮ遨搾ｼ・, minutes: 30, category: 'study' },
  蠕ｮ遨・ { title: '謨ｰ蟄ｦ・亥ｾｮ遨搾ｼ・, minutes: 30, category: 'study' },
  繝吶・繧ｹ: { title: '繝吶・繧ｹ縺ｮ邱ｴ鄙・, minutes: 20, category: 'music' },
  迚・ｻ倥￠: { title: '驛ｨ螻九・迚・ｻ倥￠', minutes: 15, category: 'life' },
  驕句虚: { title: '驕句虚繝ｻ繧ｹ繝医Ξ繝・メ', minutes: 30, category: 'health' },
  譏ｼ蟇・ { title: '繝代Ρ繝ｼ繝翫ャ繝・, minutes: 20, category: 'rest', type: 'power_nap' },
  繝翫ャ繝・ { title: '繝代Ρ繝ｼ繝翫ャ繝・, minutes: 20, category: 'rest', type: 'power_nap' },
  莨夊ｭｰ: { title: '繝溘・繝・ぅ繝ｳ繧ｰ', minutes: 30, category: 'work' },
  蜍牙ｼｷ: { title: '蜍牙ｼｷ', minutes: 25, category: 'study' },
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
  if (existing.length === 0) return '縺ｪ縺・;
  return existing
    .map((e) => {
      const p = e.priority ?? DEFAULT_PRIORITY;
      return `[P${p}] ${e.title} ${Math.floor(e.startMinutes / 60)}:${String(e.startMinutes % 60).padStart(2, '0')}-${Math.floor(e.endMinutes / 60)}:${String(e.endMinutes % 60).padStart(2, '0')}${e.locked ? ' (蝗ｺ螳・' : ''}${e.completed ? ' (螳御ｺ・' : ''}`;
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
      ? `迴ｾ蝨ｨ譎ょ綾: ${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')}\n`
      : '';
  const taskList = tasks
    .map((t) => `- ${t.title}・・{t.minutes}蛻・ 蜆ｪ蜈亥ｺｦ${t.priority ?? 3}・荏)
    .join('\n');

  return `${nowHint}譌･莉・ ${dateKey}
繝舌ャ繝輔ぃ: ${bufferMinutes}蛻・
縲先里蟄倅ｺ亥ｮ夲ｼ亥炎髯､繝ｻ螟画峩遖∵ｭ｢・峨・${formatExistingEvents(existing)}

縲千ｩｺ縺肴凾髢灘ｸｯ縲・${formatFreeSlots(freeSlots)}

縲先眠隕上↓驟咲ｽｮ縺吶ｋ繧ｿ繧ｹ繧ｯ縺ｮ縺ｿ縲・${taskList}

荳願ｨ倥ち繧ｹ繧ｯ繧堤ｩｺ縺肴凾髢薙↓霑ｽ蜉驟咲ｽｮ縺励◆JSON驟榊・繧定ｿ斐＠縺ｦ縺上□縺輔＞縲よ里蟄倅ｺ亥ｮ壹・縺昴・縺ｾ縺ｾ谿九＠縺ｦ縺上□縺輔＞縲Ａ;
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
