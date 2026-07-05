import React, { ReactNode } from 'react';
import {
  GestureResponderHandlers,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Theme, useThemedStyles } from '../../theme';

interface BottomSheetDragHandleProps {
  children?: ReactNode;
  style?: ViewStyle;
  /**
   * `panHandlers` from `useBottomSheetDismiss`. Spread here (on this small
   * handle+header zone) rather than on the whole sheet.
   */
  panHandlers?: GestureResponderHandlers;
  /**
   * When provided, the handle bar becomes a tap target that closes the sheet.
   * Tap hit-testing is reliable inside RN `Modal`s on every platform, unlike
   * PanResponder drag (flaky in the Modal's separate native window), so this
   * guarantees a working dismiss affordance on the bar itself.
   */
  onClose?: () => void;
}

/** Visual handle + optional header content. Pass `panHandlers` (swipe) and/or `onClose` (tap the bar) to dismiss. */
export function BottomSheetDragHandle({ children, style, panHandlers, onClose }: BottomSheetDragHandleProps) {
  const styles = useThemedStyles(makeStyles);

  const handleBar = (
    <View style={styles.handleRow}>
      <View style={styles.handle} />
      {onClose ? <Text style={styles.hint}>スワイプ / タップで閉じる</Text> : null}
    </View>
  );

  return (
    <View style={[styles.dragZone, style]} collapsable={false} {...panHandlers}>
      {onClose ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="閉じる"
          onPress={onClose}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 40, right: 40 }}
        >
          {handleBar}
        </TouchableOpacity>
      ) : (
        handleBar
      )}
      {children ? <View style={styles.headerContent}>{children}</View> : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    dragZone: {
      alignSelf: 'stretch',
      width: '100%',
      paddingBottom: 6,
    },
    handleRow: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      // Taller, full-width grab area so the "pull down to close" gesture is
      // easy to start anywhere across the top of the sheet, not just on the bar.
      paddingVertical: 6,
    },
    headerContent: {
      alignSelf: 'stretch',
      width: '100%',
    },
    handle: {
      width: 44,
      height: 5,
      backgroundColor: theme.textTertiary,
      borderRadius: 3,
      marginTop: 8,
      marginBottom: 6,
    },
    hint: {
      fontSize: 10,
      color: theme.textTertiary,
      marginBottom: 2,
    },
  });
