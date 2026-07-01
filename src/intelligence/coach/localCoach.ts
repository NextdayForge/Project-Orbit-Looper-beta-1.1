import {
  buildAdviceTasks,
  buildScheduleAction,
  detectLocalConsultIntent,
  dtoToCoachReply,
  extractGoalTopic,
  extractRegisterTasks,
} from './coachIntent';
import { summarizePlan } from './coachContext';
import { CoachConsultInput, CoachContextInput, CoachReply } from './types';

const TIRED_WORDS = ['疲', 'つかれ', '眠', 'ねむ', 'しんど', 'だる', 'きつ', '無理', 'バテ'];
const MOTIVATED_WORDS = ['やる気', '集中', 'いける', '頑張', 'がんば', '元気'];
const PLAN_WORDS = ['予定', 'プラン', '組み', 'なぜ', '意図', '理由'];

/** Deterministic explanation used when Gemini is unavailable. */
export function localExplain(input: CoachContextInput): CoachReply {
  if (!input.plan) {
    return {
      source: 'local',
      text: 'まだ今日のプランがありません。カレンダーの「AIでスケジュール作成」か、コーチに「英語の勉強を登録して」と話しかけると、タスクを作って配置できます。',
    };
  }

  const summary = summarizePlan(input.plan, input.tasks);
  const sessionHint =
    summary.sessions.length > 0
      ? `いまは${summary.sessions.slice(0, 2).map((s) => `${s.time} ${s.title}`).join('、')}などが入っています。`
      : 'まだセッションは空いています。';

  const parts: string[] = [
    `今日は「${summary.dayTypeTitle}」、${summary.dayTypeTagline}です。`,
    sessionHint,
  ];

  if (summary.reasons.length > 0) {
    parts.push(`${summary.reasons.slice(0, 2).join('。')}。`);
  }

  parts.push(
    `目標は集中 約${summary.targetFocusMinutes}分・${summary.targetSessionCount}本。タスクの追加は「〜を登録して」、進め方の相談は「〜したいけど何から？」と聞いてください。`
  );

  return { source: 'local', text: parts.join('') };
}

/** Heuristic consultation when Gemini is unavailable or fails. */
export function localConsult(input: CoachConsultInput): CoachReply {
  const structured = detectLocalConsultIntent(input.message);
  if (structured) {
    const mapped = dtoToCoachReply(structured);
    return { source: 'local', text: mapped.text, action: mapped.action };
  }

  const message = input.message;

  if (TIRED_WORDS.some((word) => message.includes(word))) {
    const lightTasks = buildAdviceTasks('休息と最低限のタスク');
    return {
      source: 'local',
      text: '無理は禁物です。大事な1〜2件だけに絞り、短い休憩を挟みましょう。軽めの流れに組み替えることもできます。組み替えますか？',
      action: buildScheduleAction(
        [{ title: '15分だけ最重要タスク', estimatedMinutes: 15, priority: 2 }],
        { autoApply: false }
      ),
    };
  }

  if (MOTIVATED_WORDS.some((word) => message.includes(word))) {
    const next = input.plan
      ? summarizePlan(input.plan, input.tasks).sessions[0]
      : null;
    const nextHint = next ? `次は ${next.time} の「${next.title}」から始めましょう。` : '集中できる最初の25分ブロックから始めましょう。';
    return {
      source: 'local',
      text: `いい調子ですね。${nextHint} 追加でやりたいことがあれば、タスク名をそのまま教えてください。`,
    };
  }

  if (PLAN_WORDS.some((word) => message.includes(word)) && input.plan) {
    const summary = summarizePlan(input.plan, input.tasks);
    return {
      source: 'local',
      text: `今日は${summary.dayTypeTitle}として、${summary.targetSessionCount}本・約${summary.targetFocusMinutes}分を目標に組んでいます。${summary.reasons[0] ?? '無理のない順番で進められる構成です。'}`,
    };
  }

  const registerTasks = extractRegisterTasks(message);
  if (registerTasks.length > 0) {
    const titles = registerTasks.map((task) => task.title).join('、');
    return {
      source: 'local',
      text: `「${titles}」ですね。タスク化して今日の空き時間に配置できます。`,
      action: buildScheduleAction(registerTasks, { autoApply: true }),
    };
  }

  if (/したい/.test(message)) {
    const goal = extractGoalTopic(message);
    const steps = buildAdviceTasks(goal);
    const stepText = steps.map((step, index) => `${index + 1}. ${step.title}`).join(' ');
    return {
      source: 'local',
      text: `${goal || 'その目標'}なら、次の順番がやりやすいです。${stepText} 今日の予定に組み込みますか？`,
      action: buildScheduleAction(steps, { autoApply: false }),
    };
  }

  return {
    source: 'local',
    text: '具体的に教えてください。例:「レポート執筆をタスクに登録して」「部屋の片付け、何から始めればいい？」「今日は疲れている」。タスク登録は自動で予定に入れます。',
  };
}
