import React, { ReactNode } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

interface FullScreenSafeAreaProps {
  children: ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
}

/** Full-screen Modal content must wrap itself — parent SafeAreaView does not apply inside Modal. */
export function FullScreenSafeArea({
  children,
  style,
  edges = ['top', 'left', 'right', 'bottom'],
}: FullScreenSafeAreaProps) {
  return (
    <SafeAreaView style={[styles.root, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
