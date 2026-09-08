import {
  buildAdviceTasks,
  detectLocalConsultIntent,
  extractFixedEvents,
  extractRegisterTasks,
  isAffirmativeReply,
  parseTimeExpression,
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

describe('parseTimeExpression', () => {
  it.each([
    ['22:00', 22 * 60],
    ['9:05', 9 * 60 + 5],
    ['22時', 22 * 60],
    ['22時半', 22 * 60 + 30],
    ['22時30分', 22 * 60 + 30],
    ['午後10時', 22 * 60],
    ['午後10時半', 22 * 60 + 30],
    ['午後10時30分', 22 * 60 + 30],
    ['午前7時', 7 * 60],
    ['午前7時半', 7 * 60 + 30],
    ['10pm', 22 * 60],
    ['10PM', 22 * 60],
    ['10:30pm', 22 * 60 + 30],
    ['10am', 10 * 60],
  ])('parses "%s" as %i minutes since midnight', (text, expectedMinutes) => {
    expect(parseTimeExpression(text)?.minutes).toBe(expectedMinutes);
  });

  it('returns null when no time expression is present', () => {
    expect(parseTimeExpression('明日の予定を確認して')).toBeNull();
  });

  it('rejects an out-of-range hour', () => {
    expect(parseTimeExpression('25時に集合')).toBeNull();
  });
});

describe('extractFixedEvents', () => {
  it.each([
    ['22時に寝る予定を立てて', '寝る', 22 * 60],
    ['22:00に寝る予定を入れて', '寝る', 22 * 60],
    ['22時半に寝る予定を入れて', '寝る', 22 * 60 + 30],
    ['午後10時に寝る予定を立てて', '寝る', 22 * 60],
    ['10pmに寝る予定を立てて', '寝る', 22 * 60],
    ['7時半に起きる予定を入れて', '起きる', 7 * 60 + 30],
    ['15時に検診の予定を登録して', '検診', 15 * 60],
  ])('extracts "%s" as title=%s startMinutes=%i', (text, expectedTitle, expectedStart) => {
    const events = extractFixedEvents(text);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe(expectedTitle);
    expect(events[0].startMinutes).toBe(expectedStart);
    expect(events[0].endMinutes).toBeGreaterThan(events[0].startMinutes);
  });

  it('defaults to a 60-minute block when no end time is given', () => {
    const [sleepEvent] = extractFixedEvents('22時に寝る予定を立てて');
    expect(sleepEvent.endMinutes - sleepEvent.startMinutes).toBe(60);

    const [checkupEvent] = extractFixedEvents('15時に検診の予定を登録して');
    expect(checkupEvent.endMinutes - checkupEvent.startMinutes).toBe(60);
  });

  it('clamps the end time at the day boundary instead of crossing midnight', () => {
    const [event] = extractFixedEvents('23時半に寝る予定を立てて');
    expect(event.startMinutes).toBe(23 * 60 + 30);
    expect(event.endMinutes).toBe(24 * 60);
  });

  it('does not fire on a bare clock-time mention with no scheduling verb', () => {
    expect(extractFixedEvents('22時にはもう眠くなる')).toEqual([]);
  });

  it('does not fire when there is no parseable time', () => {
    expect(extractFixedEvents('寝る予定を立てて')).toEqual([]);
  });
});

describe('detectLocalConsultIntent — fixed events', () => {
  it('routes an explicit-time request to register_fixed_event, not register_tasks', () => {
    const result = detectLocalConsultIntent('22時に寝る予定を立てて');
    expect(result?.intent).toBe('register_fixed_event');
    expect(result?.autoSchedule).toBe(true);
    expect(result?.proposedTasks).toEqual([]);
    expect(result?.proposedFixedEvents).toEqual([
      { title: '寝る', startMinutes: 22 * 60, endMinutes: 23 * 60 },
    ]);
  });
});
