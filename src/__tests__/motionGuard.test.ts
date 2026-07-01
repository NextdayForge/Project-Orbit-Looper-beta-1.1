import {
  FOCUS_MOTION_RESUME_AFTER_DISMISS_MS,
  FOCUS_MOTION_THRESHOLD,
  motionLevelFromSample,
  resumeAfterDismissAt,
  shouldShowMotionNudge,
  shouldTriggerBackgroundReturnNudge,
  smoothMotionLevel,
  vecAverage,
} from '../focus/motionGuard';

describe('motionGuard', () => {
  it('computes motion level from baseline deviation', () => {
    const baseline = { x: 0, y: 0, z: 1 };
    const moved = { x: 0.4, y: 0.2, z: 0.8 };
    expect(motionLevelFromSample(moved, baseline)).toBeCloseTo(0.4899, 3);
  });

  it('averages calibration samples', () => {
    const avg = vecAverage([
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 1.2 },
    ]);
    expect(avg).toEqual({ x: 0, y: 0, z: 1.1 });
  });

  it('smooths motion level', () => {
    expect(smoothMotionLevel(0.2, 0.6)).toBeCloseTo(0.552, 2);
  });

  it('does not re-trigger while nudge is already visible', () => {
    const now = 10_000;
    expect(
      shouldShowMotionNudge(
        FOCUS_MOTION_THRESHOLD + 0.1,
        FOCUS_MOTION_THRESHOLD,
        true,
        now
      )
    ).toBe(false);

    expect(
      shouldShowMotionNudge(
        FOCUS_MOTION_THRESHOLD + 0.1,
        FOCUS_MOTION_THRESHOLD,
        false,
        now
      )
    ).toBe(true);
  });

  it('pauses motion detection after dismiss to resume', () => {
    const now = 10_000;
    const pausedUntil = resumeAfterDismissAt(now);
    expect(pausedUntil - now).toBe(FOCUS_MOTION_RESUME_AFTER_DISMISS_MS);
    expect(
      shouldShowMotionNudge(
        FOCUS_MOTION_THRESHOLD + 0.1,
        FOCUS_MOTION_THRESHOLD,
        false,
        now,
        pausedUntil
      )
    ).toBe(false);
    expect(
      shouldShowMotionNudge(
        FOCUS_MOTION_THRESHOLD + 0.1,
        FOCUS_MOTION_THRESHOLD,
        false,
        pausedUntil,
        pausedUntil
      )
    ).toBe(true);
  });

  it('triggers background return nudge after minimum away time', () => {
    expect(shouldTriggerBackgroundReturnNudge(300)).toBe(false);
    expect(shouldTriggerBackgroundReturnNudge(500)).toBe(true);
  });
});
