import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

/** Downward drag distance (px) needed to dismiss. */
export const BOTTOM_SHEET_DISMISS_DRAG_THRESHOLD = 36;
/** Flick velocity needed to dismiss with a short drag. */
export const BOTTOM_SHEET_DISMISS_VELOCITY = 0.2;
const DISMISS_ANIMATION_DISTANCE = 360;

/**
 * Swipe-to-dismiss gesture for a bottom sheet.
 *
 * IMPORTANT: spread the returned `panHandlers` on the small drag-handle zone
 * (`BottomSheetDragHandle`), NOT on the whole sheet. An earlier version
 * attached them to the sheet root and used `evt.nativeEvent.locationY`
 * (thresholded against a fixed pixel zone) to restrict dragging to the top of
 * the sheet — `locationY`'s reference frame is one of the most notoriously
 * inconsistent values across RN platforms/versions (it's relative to
 * whichever nested view actually received the touch, which differs between
 * web's polyfill and real Android/iOS), so the same code could pass on web
 * and silently never satisfy the threshold on-device. Scoping the responder
 * to the handle zone structurally removes the need for any location math —
 * a touch either starts inside that small component's bounds or it doesn't.
 */
export function useBottomSheetDismiss(
  isOpen: boolean,
  onClose: () => void,
  disabled = false
) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      translateY.setValue(0);
    }
  }, [isOpen, translateY]);

  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        // Never claim on touch-start: lets ordinary taps (including any
        // button placed inside the handle zone) pass through untouched.
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (disabled) {
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
          if (
            gesture.dy > BOTTOM_SHEET_DISMISS_DRAG_THRESHOLD ||
            gesture.vy > BOTTOM_SHEET_DISMISS_VELOCITY
          ) {
            Animated.timing(translateY, {
              toValue: DISMISS_ANIMATION_DISTANCE,
              duration: 180,
              // Must match the imperative `setValue` used in
              // onPanResponderMove above. Mixing `setValue` (JS) with a
              // useNativeDriver:true animation "moves" the node to native,
              // after which later `setValue` calls silently stop updating
              // the view on Android/iOS.
              useNativeDriver: false,
            }).start(onClose);
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 0,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 0,
          }).start();
        },
      }).panHandlers,
    [disabled, onClose, translateY]
  );

  return { translateY, panHandlers };
}
