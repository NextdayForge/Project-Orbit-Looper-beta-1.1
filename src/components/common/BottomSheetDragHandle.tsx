import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Theme, useThemedStyles } from '../../theme';

interface BottomSheetDragHandleProps {
  children?: ReactNode;
  style?: ViewStyle;
}

/** Visual handle + optional header content. Attach swipe via `useBottomSheetDismiss` on the sheet root (move-only, no tap capture). */
export function BottomSheetDragHandle({ children, style }: BottomSheetDragHandleProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.dragZone, style]} collapsable={false}>
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
