import { localEstimateTaskDuration, localEstimateTaskDurationBatch } from '../intelligence/taskEstimate/localTaskDurationEstimate';
import { parseTaskDurationBatchJson } from '../intelligence/taskEstimate/taskDurationSchema';

describe('localEstimateTaskDuration', () => {
  it('estimates short life tasks', () => {
    const result = localEstimateTaskDuration({ title: 'シャワーを浴びる', defaultMinutes: 30 });
    expect(result.estimatedMinutes).toBe(15);
    expect(result.category).toBe('life');
    expect(result.source).toBe('local');
  });

  it('estimates study tasks longer', () => {
    const result = localEstimateTaskDuration({ title: '期末レポート', defaultMinutes: 30 });
    expect(result.estimatedMinutes).toBe(90);
    expect(result.category).toBe('study');
  });

  it('falls back to default for unknown titles', () => {
    const result = localEstimateTaskDuration({ title: 'なにか', defaultMinutes: 45 });
    expect(result.estimatedMinutes).toBe(45);
    expect(result.category).toBe('general');
  });

  it('batch dedupes by normalized title', () => {
    const batch = localEstimateTaskDurationBatch([
      { title: ' ジム ', defaultMinutes: 30 },
      { title: 'ジム', defaultMinutes: 30 },
    ]);
    expect(batch.size).toBe(1);
    expect(batch.get('ジム')?.category).toBe('health');
  });
});

describe('parseTaskDurationBatchJson', () => {
  it('parses and clamps gemini batch output', () => {
    const parsed = parseTaskDurationBatchJson(
      JSON.stringify({
        estimates: [
          { title: '英語の過去問', estimatedMinutes: 47, category: 'study' },
        ],
      }),
      30
    );
    expect(parsed).toEqual([
      { title: '英語の過去問', estimatedMinutes: 45, category: 'study' },
    ]);
  });
});
