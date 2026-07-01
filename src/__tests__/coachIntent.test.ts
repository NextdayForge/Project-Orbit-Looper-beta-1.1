import {
  buildAdviceTasks,
  detectLocalConsultIntent,
  extractRegisterTasks,
  isAffirmativeReply,
} from '../intelligence/coach/coachIntent';

describe('coachIntent', () => {
  it('extracts register tasks from natural language', () => {
    expect(extractRegisterTasks('英語の勉強をタスクに登録して')).toEqual([
      { title: '英語の勉強', priority: 3 },
    ]);
  });

  it('builds advice steps for cleanup goals', () => {
    const steps = buildAdviceTasks('部屋の片付け');
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps[0].title).toMatch(/5分/);
  });

  it('detects register intent with auto schedule', () => {
    const result = detectLocalConsultIntent('プログラミング課題を登録して');
    expect(result?.intent).toBe('register_tasks');
    expect(result?.autoSchedule).toBe(true);
    expect(result?.proposedTasks.length).toBeGreaterThan(0);
  });

  it('detects advice intent with schedule offer', () => {
    const result = detectLocalConsultIntent('部屋の片付けをしたいんだけど何をすればいい？');
    expect(result?.intent).toBe('advice');
    expect(result?.offerSchedule).toBe(true);
    expect(result?.autoSchedule).toBe(false);
  });

  it('recognizes affirmative confirmation', () => {
    expect(isAffirmativeReply('はい、お願いします')).toBe(true);
    expect(isAffirmativeReply('組み込んで')).toBe(true);
  });
});
