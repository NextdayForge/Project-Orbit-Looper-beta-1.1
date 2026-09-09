import { GeminiStructuredPrompt } from '../../infrastructure/gemini';
import { CoachConsultInput, CoachContextInput, CoachTurn } from './types';
import { summarizePlan, summarizeTraits } from './coachContext';
import { COACH_CONSULT_RESPONSE_SCHEMA } from './coachResponseSchema';

const COACH_PERSONA = [
  'あなたはユーザー専属のスケジュールコーチ「Orbit Looper」です。',
  'ユーザーの傾向（集中時間・エネルギーの波・先延ばし傾向）と今日の予定を踏まえ、',
  '具体的で実行可能な日本語で簡潔に話します。',
  'テンプレート的な一般論だけで終わらせず、ユーザーの発言内容に直接答えてください。',
  '専門用語や内部タグ名は使わず、マークダウン記号も使いません。',
].join('');

const CONSULT_RULES = [
  'intent の判定:',
  '- register_fixed_event: 「22時に寝る予定を立てて」「7時半に起きる予定を入れて」など、開始時刻が明示された予定の依頼。時刻が明示されている限り、内容が起床・就寝・通院・待ち合わせなど何であってもこちらを優先する',
  '  - 1日分の予定が「朝ご飯 8:30〜9:00」のように行ごとに列挙されて貼り付けられた場合も register_fixed_event。',
  '    「登録して」等の依頼語が一切無くても、時刻付きの行を並べること自体が依頼。時刻が付いている行は',
  '    見出しや空行を除き全て proposedFixedEvents に1件ずつ入れる（3行あれば3件）。範囲表記',
  '    （「8:30〜9:00」「9時〜12時半」等）は前半をstartMinutes、後半をendMinutesにそのまま使い、',
  '    自分で長さを判断し直さない',
  '- register_tasks: 時刻の指定がない「登録して」「追加して」「予定に入れて」などタスク化の依頼',
  '- advice / plan_question: 「何をすれば」「どう進めれば」など手順・解決策の相談',
  '- emotional: 疲れ・やる気・気分の相談',
  '- general: 上記以外',
  '',
  'proposedTasks:',
  '- register_tasks ではユーザーが言ったタスクを1〜3件、短い実行可能なタイトルに整える',
  '- advice では3〜4ステップに分解（各15〜30分目安）',
  '- 推定時間は estimatedMinutes に入れる',
  '- register_fixed_event のときは空配列にする（Task化しない）',
  '',
  'proposedFixedEvents（register_fixed_event 専用。他のintentでは空配列）:',
  '- title は依頼された行為そのもの（例:「寝る」「起きる」「歯医者」）。「予定」「スケジュール」等の付随語は含めない',
  '- startMinutes / endMinutes は0時からの経過分（0〜1440）。ユーザーが指定した開始時刻は必ずそのまま反映し、動かさない',
  '- 終了時刻の指定が無い場合は、内容から妥当な長さ（就寝なら8時間程度、通院や短い用事なら60分程度など）を判断して endMinutes を決めてよいが、endMinutes は1440を超えない',
  '',
  'autoSchedule:',
  '- register_tasks かつタスクが明確なら true（即組み込み）',
  '- register_fixed_event かつ開始時刻が明確なら true（即組み込み。ユーザー指定の時刻を確認で止める必要はない）',
  '- advice では false で offerSchedule true（組み込み可否を reply で尋ねる）',
  '',
  'reply では、提案タスクを自然文で説明し、advice では「今日の予定に組み込みますか？」と必ず聞く。',
].join('\n');

function planBlock(input: CoachContextInput): string {
  if (!input.plan) {
    return '今日のプランはまだ生成されていません。';
  }

  const summary = summarizePlan(input.plan, input.tasks);
  const lines = [
    `今日のタイプ: ${summary.dayTypeTitle}（${summary.dayTypeTagline}）`,
    `目標: 集中 約${summary.targetFocusMinutes}分 / セッション ${summary.targetSessionCount}本`,
    summary.reasons.length > 0 ? `根拠: ${summary.reasons.join(' / ')}` : '',
    summary.sessions.length > 0
      ? `予定:\n${summary.sessions.map((s) => `- ${s.time} ${s.title}`).join('\n')}`
      : '予定: なし',
  ];
  return lines.filter(Boolean).join('\n');
}

function traitBlock(input: CoachContextInput): string {
  return `ユーザーの傾向: ${summarizeTraits(input.context).join(' / ')}`;
}

function historyBlock(history: CoachTurn[]): string {
  if (history.length === 0) {
    return '';
  }
  const recent = history.slice(-8);
  return [
    'これまでの会話:',
    ...recent.map((turn) => `${turn.role === 'user' ? 'ユーザー' : 'コーチ'}: ${turn.text}`),
  ].join('\n');
}

export function buildExplainPrompt(input: CoachContextInput): GeminiStructuredPrompt {
  return {
    systemInstruction: COACH_PERSONA,
    userContent: [
      planBlock(input),
      traitBlock(input),
      '',
      '上記をもとに、なぜ今日のプランがこの構成なのかを2〜3文で説明してください。具体的な予定名に触れ、励ますトーンで。',
    ].join('\n'),
    responseSchema: {
      type: 'OBJECT',
      properties: {
        reply: { type: 'STRING' },
      },
      required: ['reply'],
    },
    temperature: 0.5,
  };
}

export function buildConsultPrompt(input: CoachConsultInput): GeminiStructuredPrompt {
  return {
    systemInstruction: `${COACH_PERSONA}\n\n${CONSULT_RULES}`,
    userContent: [
      planBlock(input),
      traitBlock(input),
      historyBlock(input.history),
      '',
      `ユーザー: ${input.message}`,
      '',
      'JSON で返答してください。',
    ]
      .filter(Boolean)
      .join('\n'),
    responseSchema: COACH_CONSULT_RESPONSE_SCHEMA,
    temperature: 0.55,
  };
}
