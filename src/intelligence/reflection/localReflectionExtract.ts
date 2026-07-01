import { ExtractedReflection, ReflectionExtractInput, ReflectionExtractResult } from './types';
import { clampScale, normalizeStringList } from './reflectionSchema';

const TIRED_WORDS = ['疲', 'つかれ', '眠', 'ねむ', 'しんど', 'だる', 'きつ', '無理', 'だめ'];
const ENERGY_WORDS = ['元気', 'やる気', '集中', 'いけた', '調子', '快調'];
const WIN_HINTS = ['できた', '完了', '集中', '進んだ', 'うまく', '達成', '良かった'];
const BLOCK_HINTS = ['遅', '眠', '中断', '先延', 'つまず', '失敗', '間に合わ', 'できな'];

function splitSentences(text: string): string[] {
  return text
    .split(/[\n。！？!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function hasPositiveEnergySignal(journal: string): boolean {
  if (/集中(でき|が)(な|ません|切れ)/.test(journal)) {
    return false;
  }
  return ENERGY_WORDS.some((w) => journal.includes(w));
}

/** Deterministic extraction when Gemini is unavailable. */
export function localExtractReflection(input: ReflectionExtractInput): ReflectionExtractResult {
  const journal = input.journal.trim();
  const sentences = splitSentences(journal);

  let mood = 3;
  let energy = 3;
  if (TIRED_WORDS.some((w) => journal.includes(w))) {
    mood = 2;
    energy = 2;
  }
  if (hasPositiveEnergySignal(journal)) {
    mood = Math.max(mood, 4);
    energy = Math.max(energy, 4);
  }

  const wins: string[] = [];
  const blockers: string[] = [];

  for (const sentence of sentences) {
    if (WIN_HINTS.some((w) => sentence.includes(w)) && wins.length < 4) {
      wins.push(sentence.slice(0, 80));
    } else if (BLOCK_HINTS.some((w) => sentence.includes(w)) && blockers.length < 4) {
      blockers.push(sentence.slice(0, 80));
    }
  }

  if (wins.length === 0 && sentences.length > 0 && !TIRED_WORDS.some((w) => sentences[0].includes(w))) {
    wins.push(sentences[0].slice(0, 80));
  }
  if (blockers.length === 0 && TIRED_WORDS.some((w) => journal.includes(w))) {
    blockers.push('疲労や集中の低下があった');
  }

  const data: ExtractedReflection = { mood, energy, wins, blockers };
  return { data, source: 'local' };
}

export function parseExtractedReflectionJson(raw: string): ExtractedReflection | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      mood: clampScale(parsed.mood),
      energy: clampScale(parsed.energy),
      wins: normalizeStringList(parsed.wins),
      blockers: normalizeStringList(parsed.blockers),
    };
  } catch {
    return null;
  }
}
