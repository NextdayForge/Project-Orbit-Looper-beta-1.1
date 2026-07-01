export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const FOCUS_MOTION_THRESHOLD = 0.06;
export const FOCUS_MOTION_RESUME_AFTER_DISMISS_MS = 10_000;
export const FOCUS_MOTION_CALIBRATION_MS = 150;
export const FOCUS_MOTION_MIN_CALIBRATION_SAMPLES = 3;
export const FOCUS_BACKGROUND_AWAY_MS = 400;
export const FOCUS_MOTION_SMOOTH_ALPHA = 0.88;
export const FOCUS_MOTION_UPDATE_INTERVAL_MS = 30;

export function vecMagnitude(v: Vec3): number {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
}

export function vecSubtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vecAverage(samples: Vec3[]): Vec3 {
  if (samples.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  const sum = samples.reduce(
    (acc, sample) => ({
      x: acc.x + sample.x,
      y: acc.y + sample.y,
      z: acc.z + sample.z,
    }),
    { x: 0, y: 0, z: 0 }
  );

  return {
    x: sum.x / samples.length,
    y: sum.y / samples.length,
    z: sum.z / samples.length,
  };
}

export function motionLevelFromSample(sample: Vec3, baseline: Vec3): number {
  return vecMagnitude(vecSubtract(sample, baseline));
}

export function smoothMotionLevel(
  previous: number,
  next: number,
  alpha = FOCUS_MOTION_SMOOTH_ALPHA
): number {
  return previous * (1 - alpha) + next * alpha;
}

export function shouldShowMotionNudge(
  smoothedLevel: number,
  threshold: number,
  nudgeVisible: boolean,
  now: number,
  pausedUntil = 0
): boolean {
  if (nudgeVisible || now < pausedUntil) {
    return false;
  }
  return smoothedLevel > threshold;
}

export function resumeAfterDismissAt(now: number): number {
  return now + FOCUS_MOTION_RESUME_AFTER_DISMISS_MS;
}

export function shouldTriggerBackgroundReturnNudge(
  awayMs: number,
  minAwayMs = FOCUS_BACKGROUND_AWAY_MS
): boolean {
  return awayMs >= minAwayMs;
}
