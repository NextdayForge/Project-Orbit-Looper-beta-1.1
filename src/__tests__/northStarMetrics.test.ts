import {
  compareAroundDate,
  computeNorthStarMetrics,
} from '../intelligence/metrics/northStarMetrics';
import {
  formatComparisonReport,
  formatMetricsReport,
} from '../intelligence/metrics/metricsReport';
import { SessionOutcome } from '../types/session';
import { makeSession } from './fixtures';

function outcome(overrides: Partial<SessionOutcome> = {}): SessionOutcome {
  return {
    estimatedMinutes: 45,
    actualMinutes: 45,
    completed: true,
    estimationRatio: 1,
    startedLate: false,
    interrupted: false,
    focusScore: 1,
    timerUsed: true,
    ...overrides,
  };
}

describe('computeNorthStarMetrics', () => {
  it('活動が無ければすべて null / 0 を返す', () => {
    const metrics = computeNorthStarMetrics([]);

    expect(metrics.fromDate).toBeNull();
    expect(metrics.toDate).toBeNull();
    expect(metrics.execution.actualStartRate).toBeNull();
    expect(metrics.learning.learningDayRate).toBeNull();
    expect(metrics.replan.replanDayRate).toBeNull();
    expect(metrics.retention.activeDayCount).toBe(0);
    expect(metrics.retention.survivedTwoWeeks).toBe(false);
  });

  it('actualStart 発生率を進捗対象セッションに対して数える', () => {
    const sessions = [
      makeSession({ date: '2026-07-01', actualStart: '2026-07-01T09:00:00.000Z' }),
      makeSession({ date: '2026-07-01' }),
      makeSession({ date: '2026-07-01' }),
      makeSession({ date: '2026-07-01', actualStart: '2026-07-01T13:00:00.000Z' }),
    ];

    const { execution } = computeNorthStarMetrics(sessions);

    expect(execution.plannedSessionCount).toBe(4);
    expect(execution.startedSessionCount).toBe(2);
    expect(execution.actualStartRate).toBeCloseTo(0.5);
  });

  it('タイマーを通さない完了を timedCompletionRate で分離する', () => {
    const sessions = [
      // タイマー経由の完了
      makeSession({
        date: '2026-07-01',
        status: 'completed',
        completed: true,
        actualStart: '2026-07-01T09:00:00.000Z',
        outcome: outcome({ timerUsed: true }),
      }),
      // 「完了」だけ押された（学習信号なし）
      makeSession({
        date: '2026-07-01',
        status: 'completed',
        completed: true,
        outcome: outcome({ timerUsed: false }),
      }),
    ];

    const { execution } = computeNorthStarMetrics(sessions);

    expect(execution.completedSessionCount).toBe(2);
    expect(execution.timedCompletedSessionCount).toBe(1);
    expect(execution.timedCompletionRate).toBeCloseTo(0.5);
  });

  it('rescheduled セッションは進捗対象から除外されるが再計画として数える', () => {
    const sessions = [
      makeSession({ date: '2026-07-01', status: 'rescheduled' }),
      makeSession({ date: '2026-07-01', actualStart: '2026-07-01T14:00:00.000Z' }),
    ];

    const metrics = computeNorthStarMetrics(sessions);

    // isDayProgressSession が rescheduled を除くので分母は 1
    expect(metrics.execution.plannedSessionCount).toBe(1);
    expect(metrics.replan.rescheduledSessionCount).toBe(1);
    expect(metrics.replan.replanDayCount).toBe(1);
    expect(metrics.replan.replanDayRate).toBeCloseTo(1);
  });

  it('ユーザー削除（cancelled + archived）は進捗対象にも活動日にも数えない', () => {
    const sessions = [
      makeSession({ date: '2026-07-01', status: 'cancelled', archived: true }),
      makeSession({ date: '2026-07-02', actualStart: '2026-07-02T09:00:00.000Z' }),
    ];

    const metrics = computeNorthStarMetrics(sessions);

    expect(metrics.execution.plannedSessionCount).toBe(1);
    expect(metrics.retention.activeDayCount).toBe(1);
    expect(metrics.fromDate).toBe('2026-07-02');
  });

  it('予定が生成されただけの日は活動日に数えない', () => {
    const sessions = [
      makeSession({ date: '2026-07-01' }), // planned のまま = 手を動かしていない
      makeSession({ date: '2026-07-02', completed: true, status: 'completed', outcome: outcome() }),
    ];

    const metrics = computeNorthStarMetrics(sessions);

    expect(metrics.retention.activeDayCount).toBe(1);
    expect(metrics.retention.firstActiveDate).toBe('2026-07-02');
  });

  it('学習が成立した日（timerUsed の outcome がある日）の割合を出す', () => {
    const sessions = [
      makeSession({
        date: '2026-07-01',
        status: 'completed',
        completed: true,
        outcome: outcome({ timerUsed: true }),
      }),
      makeSession({
        date: '2026-07-02',
        status: 'completed',
        completed: true,
        outcome: outcome({ timerUsed: false }),
      }),
    ];

    const { learning } = computeNorthStarMetrics(sessions);

    expect(learning.activeDayCount).toBe(2);
    expect(learning.learningDayCount).toBe(1);
    expect(learning.learningDayRate).toBeCloseTo(0.5);
  });

  it('連続日数と2週間の谷の判定を出す', () => {
    const dates = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-10', '2026-07-16'];
    const sessions = dates.map((date) =>
      makeSession({ date, actualStart: `${date}T09:00:00.000Z` })
    );

    const { retention } = computeNorthStarMetrics(sessions);

    expect(retention.firstActiveDate).toBe('2026-07-01');
    expect(retention.lastActiveDate).toBe('2026-07-16');
    expect(retention.activeDayCount).toBe(5);
    expect(retention.spanDays).toBe(16);
    expect(retention.longestStreakDays).toBe(3);
    expect(retention.currentStreakDays).toBe(1);
    // 07-01 起点の14日窓は 07-14 まで（07-16 は外）
    expect(retention.activeDaysInFirst14).toBe(4);
    expect(retention.survivedTwoWeeks).toBe(true);
  });

  it('14日以内で終わっていれば谷を越えていない', () => {
    const sessions = ['2026-07-01', '2026-07-05'].map((date) =>
      makeSession({ date, actualStart: `${date}T09:00:00.000Z` })
    );

    const { retention } = computeNorthStarMetrics(sessions);

    expect(retention.survivedTwoWeeks).toBe(false);
    expect(retention.activeDaysInFirst14).toBe(2);
  });

  it('同じ日の複数セッションは活動日を重複して数えない', () => {
    const sessions = [
      makeSession({ date: '2026-07-01', actualStart: '2026-07-01T09:00:00.000Z' }),
      makeSession({ date: '2026-07-01', actualStart: '2026-07-01T11:00:00.000Z' }),
      makeSession({ date: '2026-07-01', status: 'skipped' }),
    ];

    const { retention } = computeNorthStarMetrics(sessions);

    expect(retention.activeDayCount).toBe(1);
    expect(retention.longestStreakDays).toBe(1);
  });
});

describe('期間指定', () => {
  const sessions = [
    makeSession({ date: '2026-07-01', actualStart: 'x' }),
    makeSession({ date: '2026-07-05' }),
    makeSession({ date: '2026-07-10', actualStart: 'x' }),
  ];

  it('from / to の両端を含む', () => {
    const m = computeNorthStarMetrics(sessions, { from: '2026-07-05', to: '2026-07-10' });

    expect(m.execution.plannedSessionCount).toBe(2);
    expect(m.execution.startedSessionCount).toBe(1);
    expect(m.execution.actualStartRate).toBeCloseTo(0.5);
  });

  it('from だけ・to だけの指定も効く', () => {
    expect(
      computeNorthStarMetrics(sessions, { from: '2026-07-06' }).execution.plannedSessionCount
    ).toBe(1);
    expect(
      computeNorthStarMetrics(sessions, { to: '2026-07-04' }).execution.plannedSessionCount
    ).toBe(1);
  });

  it('期間を省略すると全期間', () => {
    expect(computeNorthStarMetrics(sessions).execution.plannedSessionCount).toBe(3);
  });

  it('範囲外しか無ければ空の結果になる', () => {
    const m = computeNorthStarMetrics(sessions, { from: '2026-08-01' });

    expect(m.execution.actualStartRate).toBeNull();
    expect(m.daily).toHaveLength(0);
    expect(m.fromDate).toBeNull();
  });
});

describe('日別系列', () => {
  it('セッションのある日だけを日付昇順で返す', () => {
    const m = computeNorthStarMetrics([
      makeSession({ date: '2026-07-03', actualStart: 'x' }),
      makeSession({ date: '2026-07-01' }),
      makeSession({ date: '2026-07-01', actualStart: 'x' }),
    ]);

    expect(m.daily.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-03']);
    expect(m.daily[0].actualStartRate).toBeCloseTo(0.5);
    expect(m.daily[1].actualStartRate).toBeCloseTo(1);
  });

  it('その日に学習信号があったかを持つ', () => {
    const m = computeNorthStarMetrics([
      makeSession({
        date: '2026-07-01',
        status: 'completed',
        completed: true,
        outcome: outcome({ timerUsed: true }),
      }),
      makeSession({
        date: '2026-07-02',
        status: 'completed',
        completed: true,
        outcome: outcome({ timerUsed: false }),
      }),
    ]);

    expect(m.daily[0].hasLearningSignal).toBe(true);
    expect(m.daily[1].hasLearningSignal).toBe(false);
  });

  it('rescheduled は進捗の分母から外れるが日別の再計画数には出る', () => {
    const m = computeNorthStarMetrics([
      makeSession({ date: '2026-07-01', status: 'rescheduled' }),
      makeSession({ date: '2026-07-01', actualStart: 'x' }),
    ]);

    expect(m.daily[0].plannedSessionCount).toBe(1);
    expect(m.daily[0].rescheduledSessionCount).toBe(1);
  });
});

describe('compareAroundDate', () => {
  const sessions = [
    // 施策前: 4件中1件だけ開始（25%）
    makeSession({ date: '2026-07-01', actualStart: 'x' }),
    makeSession({ date: '2026-07-01' }),
    makeSession({ date: '2026-07-02' }),
    makeSession({ date: '2026-07-02' }),
    // 施策後: 4件中3件開始（75%）
    makeSession({ date: '2026-07-10', actualStart: 'x' }),
    makeSession({ date: '2026-07-10', actualStart: 'x' }),
    makeSession({ date: '2026-07-11', actualStart: 'x' }),
    makeSession({ date: '2026-07-11' }),
  ];

  it('splitDate 当日は「後」に含む', () => {
    const c = compareAroundDate(sessions, '2026-07-10');

    expect(c.before.execution.plannedSessionCount).toBe(4);
    expect(c.after.execution.plannedSessionCount).toBe(4);
  });

  it('前後の率と差分を出す', () => {
    const c = compareAroundDate(sessions, '2026-07-10');

    expect(c.actualStartRate.before).toBeCloseTo(0.25);
    expect(c.actualStartRate.after).toBeCloseTo(0.75);
    expect(c.actualStartRate.delta).toBeCloseTo(0.5);
  });

  it('片側にデータが無ければ差分は null', () => {
    const c = compareAroundDate(sessions, '2026-06-01');

    expect(c.before.execution.actualStartRate).toBeNull();
    expect(c.actualStartRate.delta).toBeNull();
  });

  it('累積では薄まる改善を、期間を切ると正しく捉える', () => {
    // 前に大量の低い実績があると、累積値は改善を過小評価する
    const many = Array.from({ length: 20 }, () => makeSession({ date: '2026-07-01' }));
    const few = Array.from({ length: 4 }, () =>
      makeSession({ date: '2026-07-10', actualStart: 'x' })
    );
    const all = [...many, ...few];

    expect(computeNorthStarMetrics(all).execution.actualStartRate).toBeCloseTo(4 / 24);

    const c = compareAroundDate(all, '2026-07-10');
    expect(c.actualStartRate.before).toBeCloseTo(0);
    expect(c.actualStartRate.after).toBeCloseTo(1);
  });
});

describe('formatComparisonReport', () => {
  it('前後の率と差分をpt表記で載せる', () => {
    const sessions = [
      makeSession({ date: '2026-07-01' }),
      makeSession({ date: '2026-07-10', actualStart: 'x' }),
    ];

    const report = formatComparisonReport(compareAroundDate(sessions, '2026-07-10'));

    expect(report).toContain('タイマー開始率  ★: 0% → 100%  (+100pt)');
    expect(report).toContain('2026-07-10（この日から「後」）');
    expect(report).toContain('n=1 の観察であり対照実験ではない');
  });
});

describe('formatMetricsReport', () => {
  it('活動が無くてもクラッシュせずダッシュ表記になる', () => {
    const report = formatMetricsReport(computeNorthStarMetrics([]));

    expect(report).toContain('活動記録なし');
    expect(report).toContain('タイマー開始率: —');
  });

  it('主要指標をパーセントと実数で載せる', () => {
    const sessions = [
      makeSession({
        date: '2026-07-01',
        status: 'completed',
        completed: true,
        actualStart: '2026-07-01T09:00:00.000Z',
        outcome: outcome({ timerUsed: true }),
      }),
      makeSession({ date: '2026-07-01' }),
    ];

    const report = formatMetricsReport(computeNorthStarMetrics(sessions));

    expect(report).toContain('タイマー開始率: 50%  (1/2)');
    expect(report).toContain('2026-07-01 〜 2026-07-01');
  });
});
