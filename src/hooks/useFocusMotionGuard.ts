import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  FOCUS_BACKGROUND_AWAY_MS,
  FOCUS_MOTION_CALIBRATION_MS,
  FOCUS_MOTION_MIN_CALIBRATION_SAMPLES,
  FOCUS_MOTION_SMOOTH_ALPHA,
  FOCUS_MOTION_THRESHOLD,
  FOCUS_MOTION_UPDATE_INTERVAL_MS,
  motionLevelFromSample,
  resumeAfterDismissAt,
  shouldShowMotionNudge,
  shouldTriggerBackgroundReturnNudge,
  smoothMotionLevel,
  Vec3,
  vecAverage,
} from '../focus/motionGuard';

export type FocusNudgeReason = 'motion' | 'background_return' | null;

interface UseFocusMotionGuardOptions {
  enabled: boolean;
  threshold?: number;
}

interface UseFocusMotionGuardResult {
  nudgeVisible: boolean;
  nudgeReason: FocusNudgeReason;
  calibrating: boolean;
  supported: boolean;
  dismissNudge: () => void;
  dismissNudgeToResume: () => void;
}

export function useFocusMotionGuard({
  enabled,
  threshold = FOCUS_MOTION_THRESHOLD,
}: UseFocusMotionGuardOptions): UseFocusMotionGuardResult {
  const supported = Platform.OS !== 'web';
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [nudgeReason, setNudgeReason] = useState<FocusNudgeReason>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [recalibrateToken, setRecalibrateToken] = useState(0);
  const nudgeVisibleRef = useRef(false);
  const motionPausedUntilRef = useRef(0);
  const backgroundAtRef = useRef<number | null>(null);

  const dismissNudge = useCallback(() => {
    nudgeVisibleRef.current = false;
    setNudgeVisible(false);
    setNudgeReason(null);
  }, []);

  const dismissNudgeToResume = useCallback(() => {
    dismissNudge();
    motionPausedUntilRef.current = resumeAfterDismissAt(Date.now());
    setRecalibrateToken((token) => token + 1);
  }, [dismissNudge]);

  const showNudge = useCallback((reason: Exclude<FocusNudgeReason, null>) => {
    if (nudgeVisibleRef.current || Date.now() < motionPausedUntilRef.current) {
      return;
    }

    nudgeVisibleRef.current = true;
    setNudgeReason(reason);
    setNudgeVisible(true);

    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !supported) {
      dismissNudge();
      motionPausedUntilRef.current = 0;
      setCalibrating(false);
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'inactive') {
        showNudge('background_return');
      }

      if (nextState === 'background' || nextState === 'inactive') {
        if (backgroundAtRef.current === null) {
          backgroundAtRef.current = Date.now();
        }
        return;
      }

      if (nextState !== 'active' || backgroundAtRef.current === null) {
        return;
      }

      const awayMs = Date.now() - backgroundAtRef.current;
      backgroundAtRef.current = null;
      if (shouldTriggerBackgroundReturnNudge(awayMs, FOCUS_BACKGROUND_AWAY_MS)) {
        showNudge('background_return');
      }
    });

    return () => subscription.remove();
  }, [dismissNudge, enabled, showNudge, supported]);

  useEffect(() => {
    if (!enabled || !supported) {
      return;
    }

    let calibrated = false;
    let baseline: Vec3 = { x: 0, y: 0, z: 0 };
    let smoothed = 0;
    const calibrationSamples: Vec3[] = [];
    const activatedAt = Date.now();

    setCalibrating(true);
    Accelerometer.setUpdateInterval(FOCUS_MOTION_UPDATE_INTERVAL_MS);

    const motionSubscription = Accelerometer.addListener((reading) => {
      const sample: Vec3 = { x: reading.x, y: reading.y, z: reading.z };
      const elapsed = Date.now() - activatedAt;

      if (!calibrated) {
        calibrationSamples.push(sample);
        if (calibrationSamples.length > 20) {
          calibrationSamples.shift();
        }

        if (
          elapsed >= FOCUS_MOTION_CALIBRATION_MS &&
          calibrationSamples.length >= FOCUS_MOTION_MIN_CALIBRATION_SAMPLES
        ) {
          baseline = vecAverage(calibrationSamples);
          calibrated = true;
          smoothed = 0;
          setCalibrating(false);
        }
        return;
      }

      const level = motionLevelFromSample(sample, baseline);
      smoothed = smoothMotionLevel(smoothed, level, FOCUS_MOTION_SMOOTH_ALPHA);
      const now = Date.now();

      if (
        shouldShowMotionNudge(
          smoothed,
          threshold,
          nudgeVisibleRef.current,
          now,
          motionPausedUntilRef.current
        )
      ) {
        showNudge('motion');
      }
    });

    return () => {
      motionSubscription.remove();
      setCalibrating(false);
    };
  }, [enabled, recalibrateToken, showNudge, supported, threshold]);

  return {
    nudgeVisible,
    nudgeReason,
    calibrating,
    supported,
    dismissNudge,
    dismissNudgeToResume,
  };
}
