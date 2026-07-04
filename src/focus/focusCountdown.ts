/**
 * Remaining focus seconds, anchored to when focus actually began (`actualStart`),
 * NOT the session's scheduled clock time. This makes the timer a real countdown
 * that starts the moment the user enters focus mode, regardless of whether the
 * session's scheduled start time has arrived yet.
 *
 * - No `actualStart` yet (focus not started) → show the full planned duration.
 * - Otherwise → planned duration minus elapsed since `actualStart`, clamped to
 *   [0, total].
 */
export function resolveRemainingFocusSeconds(
  actualStartIso: string | null | undefined,
  totalSeconds: number,
  nowMs: number = Date.now()
): number {
  const total = Math.max(0, Math.floor(totalSeconds));
  if (!actualStartIso) {
    return total;
  }
  const startedMs = new Date(actualStartIso).getTime();
  if (Number.isNaN(startedMs)) {
    return total;
  }
  const elapsedSeconds = (nowMs - startedMs) / 1000;
  const remaining = total - elapsedSeconds;
  if (remaining <= 0) {
    return 0;
  }
  if (remaining >= total) {
    return total;
  }
  return Math.floor(remaining);
}

export type CountdownLayout = 'mmss' | 'hmmss' | 'hhmmss';

export interface CountdownSlots {
  layout: CountdownLayout;
  slots: string[];
}

export interface CountdownLayoutMetrics {
  digitSlotWidth: number;
  colonSlotWidth: number;
  fontSize: number;
  colonFontSize: number;
  lineHeight: number;
  rowHeight: number;
  rowWidth: number;
}

export const FOCUS_COUNTDOWN_MAX_WIDTH = 228;
const COLON_SLOT_WIDTH = 14;

const LAYOUT_PRESETS: Record<
  CountdownLayout,
  { fontSize: number; digitSlotWidth: number; colonFontSize: number }
> = {
  mmss: { fontSize: 46, digitSlotWidth: 50, colonFontSize: 38 },
  hmmss: { fontSize: 36, digitSlotWidth: 40, colonFontSize: 30 },
  hhmmss: { fontSize: 30, digitSlotWidth: 33, colonFontSize: 24 },
};

function digitCountForLayout(layout: CountdownLayout): number {
  switch (layout) {
    case 'mmss':
      return 4;
    case 'hmmss':
      return 5;
    case 'hhmmss':
      return 6;
  }
}

export function layoutMetrics(layout: CountdownLayout): CountdownLayoutMetrics {
  const preset = LAYOUT_PRESETS[layout];
  const digitCount = digitCountForLayout(layout);
  const lineHeight = Math.floor(preset.fontSize * 1.06);
  const rowWidth = preset.digitSlotWidth * digitCount + COLON_SLOT_WIDTH * 2;

  return {
    digitSlotWidth: preset.digitSlotWidth,
    colonSlotWidth: COLON_SLOT_WIDTH,
    fontSize: preset.fontSize,
    colonFontSize: preset.colonFontSize,
    lineHeight,
    rowHeight: lineHeight + 6,
    rowWidth: Math.min(rowWidth, FOCUS_COUNTDOWN_MAX_WIDTH),
  };
}

export function resolveCountdownLayout(totalSeconds: number): CountdownLayout {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  if (hours >= 10) {
    return 'hhmmss';
  }
  if (hours >= 1) {
    return 'hmmss';
  }
  return 'mmss';
}

export function buildCountdownSlots(totalSeconds: number): CountdownSlots {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad2 = (value: number) => String(value).padStart(2, '0');
  const mm = pad2(minutes);
  const ss = pad2(seconds);

  if (hours >= 10) {
    const hh = pad2(hours);
    return {
      layout: 'hhmmss',
      slots: [hh[0], hh[1], ':', mm[0], mm[1], ':', ss[0], ss[1]],
    };
  }

  if (hours >= 1) {
    return {
      layout: 'hmmss',
      slots: [String(hours), ':', mm[0], mm[1], ':', ss[0], ss[1]],
    };
  }

  return {
    layout: 'mmss',
    slots: [mm[0], mm[1], ':', ss[0], ss[1]],
  };
}
