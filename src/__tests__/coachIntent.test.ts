import {
  buildAdviceTasks,
  detectLocalConsultIntent,
  extractFixedEvents,
  extractRegisterTasks,
  isAffirmativeReply,
  normalizeTimeText,
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

describe('normalizeTimeText', () => {
  it.each([
    ['８：３０', '8:30'],
    ['０９：００', '09:00'],
    ['8：30〜9：00', '8:30-9:00'],
    ['8:30～9:00', '8:30-9:00'],
    ['8:30ー9:00', '8:30-9:00'],
    ['8:30-9:00', '8:30-9:00'],
    ['朝ご飯　8：30', '朝ご飯 8:30'],
  ])('normalizes "%s" to "%s"', (input, expected) => {
    expect(normalizeTimeText(input)).toBe(expected);
  });

  it('is idempotent', () => {
    const once = normalizeTimeText('朝ご飯　８：３０～９：００');
    expect(normalizeTimeText(once)).toBe(once);
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

  it('parses full-width digits, colon, and space without a caller having to normalize first', () => {
    const result = parseTimeExpression('朝ご飯　８：３０');
    expect(result?.minutes).toBe(8 * 60 + 30);
  });

  describe('ranges', () => {
    it.each([
      ['8:30〜9:00', 8 * 60 + 30, 9 * 60],
      ['8:30～9:00', 8 * 60 + 30, 9 * 60],
      ['8:30-9:00', 8 * 60 + 30, 9 * 60],
      ['8：30～9：00', 8 * 60 + 30, 9 * 60],
      ['9時〜12時半', 9 * 60, 12 * 60 + 30],
      ['9:00-12:30', 9 * 60, 12 * 60 + 30],
    ])('parses "%s" as start=%i end=%i', (text, expectedStart, expectedEnd) => {
      const result = parseTimeExpression(text);
      expect(result?.minutes).toBe(expectedStart);
      expect(result?.endMinutes).toBe(expectedEnd);
    });

    it('leaves endMinutes undefined for a single time (no range)', () => {
      expect(parseTimeExpression('22時')?.endMinutes).toBeUndefined();
    });

    it('does not treat an unrelated dash as a range when no time follows it directly', () => {
      const result = parseTimeExpression('9:00-会議室Aで待ち合わせ、後で13:00にも確認');
      expect(result?.minutes).toBe(9 * 60);
      expect(result?.endMinutes).toBeUndefined();
    });
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

  describe('multi-line bulk paste', () => {
    it('reproduces the reported bug: a full-width, dash-separated day plan pasted as 4 lines', () => {
      const message = [
        '朝ご飯　8：30～9：00',
        '午前活動　9：00～12：30',
        '昼ごはん　12：30～13：00',
        '午後活動　13：00～17：00',
      ].join('\n');

      const events = extractFixedEvents(message);

      expect(events).toEqual([
        { title: '朝ご飯', startMinutes: 8 * 60 + 30, endMinutes: 9 * 60 },
        { title: '午前活動', startMinutes: 9 * 60, endMinutes: 12 * 60 + 30 },
        { title: '昼ごはん', startMinutes: 12 * 60 + 30, endMinutes: 13 * 60 },
        { title: '午後活動', startMinutes: 13 * 60, endMinutes: 17 * 60 },
      ]);
    });

    it('does not require a "予定を登録して"-style verb on each line', () => {
      const message = '会議 10:00-11:00\n昼食 12:00-13:00';
      const events = extractFixedEvents(message);
      expect(events.map((e) => e.title)).toEqual(['会議', '昼食']);
    });

    it('skips header/blank lines that have no parseable time', () => {
      const message = ['今日の予定です', '', '会議 10:00-11:00', '以上です'].join('\n');
      const events = extractFixedEvents(message);
      expect(events).toEqual([
        { title: '会議', startMinutes: 10 * 60, endMinutes: 11 * 60 },
      ]);
    });

    it('still requires the hint word for a single-line (non-bulk) message', () => {
      // A single line with a time but no scheduling verb — same guard as before,
      // bulk mode only relaxes the gate once there is more than one line.
      expect(extractFixedEvents('10:00に会議')).toEqual([]);
    });
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

  it('replies with a count, not a single title, for a multi-line bulk paste', () => {
    const message = [
      '朝ご飯　8：30～9：00',
      '午前活動　9：00～12：30',
      '昼ごはん　12：30～13：00',
    ].join('\n');

    const result = detectLocalConsultIntent(message);
    expect(result?.intent).toBe('register_fixed_event');
    expect(result?.proposedFixedEvents).toHaveLength(3);
    expect(result?.reply).toContain('3件');
  });
});
