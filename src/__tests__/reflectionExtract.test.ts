import { localExtractReflection, parseExtractedReflectionJson } from '../intelligence/reflection/localReflectionExtract';

describe('localExtractReflection', () => {
  it('detects fatigue and maps low mood/energy', () => {
    const result = localExtractReflection({
      date: '2026-06-28',
      journal: '今日は疲れた。午後眠くて集中できなかった。',
    });
    expect(result.source).toBe('local');
    expect(result.data.mood).toBeLessThanOrEqual(3);
    expect(result.data.energy).toBeLessThanOrEqual(3);
    expect(result.data.blockers.length).toBeGreaterThan(0);
  });

  it('parses valid Gemini JSON', () => {
    const parsed = parseExtractedReflectionJson(
      JSON.stringify({
        mood: 4,
        energy: 3,
        wins: ['朝集中できた'],
        blockers: ['昼食後に眠かった'],
      })
    );
    expect(parsed).toEqual({
      mood: 4,
      energy: 3,
      wins: ['朝集中できた'],
      blockers: ['昼食後に眠かった'],
    });
  });
});
