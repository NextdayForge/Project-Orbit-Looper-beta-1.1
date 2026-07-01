import { TaskPriority } from '../../types/schedule';
import { CoachConsultStructuredDto } from './coachResponseSchema';
import { CoachProposedTask, CoachScheduleAction } from './types';

const AFFIRMATIVE = /^(はい|うん|ok|okay|お願い|組み込|入れて|追加|やって|それで|いいよ|大丈夫)/i;
const NEGATIVE = /^(いいえ|やめ|不要|結構|いらない|キャンセル)/i;

const REGISTER_HINTS = /登録|追加|組み込|入れて|タスクに|予定に|スケジュール|配置/;
const ADVICE_HINTS = /何をすれば|どうすれば|どうしたら|方法|手順|コツ|進め方|何から|わからない|分からない/;

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

export function dtoToCoachReply(dto: CoachConsultStructuredDto): {
  text: string;
  action?: CoachScheduleAction;
} {
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
