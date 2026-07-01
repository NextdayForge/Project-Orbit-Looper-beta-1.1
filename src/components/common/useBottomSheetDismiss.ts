import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

/** Downward drag distance (px) needed to dismiss. */
export const BOTTOM_SHEET_DISMISS_DRAG_THRESHOLD = 36;
/** Flick velocity needed to dismiss with a short drag. */
export const BOTTOM_SHEET_DISMISS_VELOCITY = 0.2;
/** Top area of the sheet (px) where swipe-to-dismiss is active. */
export const BOTTOM_SHEET_DRAG_ZONE_HEIGHT = 148;
const DISMISS_ANIMATION_DISTANCE = 360;

export function useBottomSheetDismiss(
  isOpen: boolean,
  onClose: () => void,
  disabled = false
) {
  const translateY = useRef(new Animated.Value(0)).current;
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      translateY.setValue(0);
      touchStartY.current = null;
    }
  }, [isOpen, translateY]);

  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => {
          if (disabled) {
            touchStartY.current = null;
            return false;
          }
          touchStartY.current = evt.nativeEvent.locationY;
          return false;
        },
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (disabled || touchStartY.current === null) {
            return false;
          }
          if (touchStartY.current > BOTTOM_SHEET_DRAG_ZONE_HEIGHT) {
            return false;
          }
          return gesture.dy > 4 && gesture.dy > Math.abs(gesture.dx) * 0.7;
        },
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderTerminationRequest: () => true,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            translateY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          touchStartY.current = null;
          if (
            gesture.dy > BOTTOM_SHEET_DISMISS_DRAG_THRESHOLD ||
            gesture.vy > BOTTOM_SHEET_DISMISS_VELOCITY
          ) {
            Animated.timing(translateY, {
              toValue: DISMISS_ANIMATION_DISTANCE,
              duration: 180,
              useNativeDriver: true,
            }).start(onClose);
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
        onPanResponderTerminate: () => {
          touchStartY.current = null;
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
      }).panHandlers,
    [disabled, onClose, translateY]
  );

  return { translateY, panHandlers };
}
