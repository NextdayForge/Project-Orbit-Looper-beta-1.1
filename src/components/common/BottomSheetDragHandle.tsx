import React, { ReactNode } from 'react';
import {
  GestureResponderHandlers,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Theme, useThemedStyles } from '../../theme';

interface BottomSheetDragHandleProps {
  children?: ReactNode;
  style?: ViewStyle;
  /**
   * `panHandlers` from `useBottomSheetDismiss`. Spread here (on this small
   * handle+header zone) rather than on the whole sheet, so "drag to dismiss"
   * is scoped to wherever this component is rendered — no pixel-threshold
   * math needed (see useBottomSheetDismiss for why that was unreliable).
   */
  panHandlers?: GestureResponderHandlers;
}

/** Visual handle + optional header content. Pass `panHandlers` from `useBottomSheetDismiss` to enable swipe-to-dismiss on this zone. */
export function BottomSheetDragHandle({ children, style, panHandlers }: BottomSheetDragHandleProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.dragZone, style]} collapsable={false} {...panHandlers}>
      <View style={styles.handleRow}>
        <View style={styles.handle} />
      </View>
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
      marginBottom: 8,
    },
  });
