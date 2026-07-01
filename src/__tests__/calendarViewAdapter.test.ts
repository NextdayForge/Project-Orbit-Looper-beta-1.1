import { buildDomainDisplayEvents } from '../presentation/calendar/CalendarViewAdapter';

describe('buildDomainDisplayEvents', () => {
  it('does not duplicate routine blocks when they exist in persisted and readonly lists', () => {
    const routineBlock = {
      id: 'routine:routine-1:2026-06-29',
      title: '朝ランニング',
      date: '2026-06-29',
      startMinutes: 420,
      endMinutes: 480,
      type: 'fixed' as const,
      locked: true,
      source: 'system' as const,
      recurring: true,
    };

    const events = buildDomainDisplayEvents({
      tasks: [],
      sessions: [],
      calendarBlocks: [routineBlock],
      readonlyBlocks: [routineBlock],
    });

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('block-routine:routine-1:2026-06-29');
  });
});
