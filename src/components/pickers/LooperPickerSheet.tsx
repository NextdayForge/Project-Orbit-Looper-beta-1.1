import React from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme, useThemedStyles } from '../../theme';
import { BottomSheetDragHandle } from '../common/BottomSheetDragHandle';
import { modalAnimation } from '../common/modalAnimation';
import { useBottomSheetDismiss } from '../common/useBottomSheetDismiss';
import { makePickerSheetStyles } from './pickerStyles';

interface LooperPickerSheetProps {
  visible: boolean;
  title: string;
  hint?: string;
  onCancel: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}

export function LooperPickerSheet({
  visible,
  title,
  hint,
  onCancel,
  onConfirm,
  children,
}: LooperPickerSheetProps) {
  const styles = useThemedStyles(makePickerSheetStyles);
  const { translateY, panHandlers } = useBottomSheetDismiss(visible, onCancel);

  return (
    <Modal transparent animationType={modalAnimation('slide')} visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <BottomSheetDragHandle panHandlers={panHandlers} onClose={onCancel}>
            <View style={styles.toolbar}>
              <TouchableOpacity onPress={onCancel} hitSlop={12}>
                <Text style={styles.cancel}>キャンセル</Text>
              </TouchableOpacity>
              <Text style={styles.toolbarTitle}>{title}</Text>
              <TouchableOpacity onPress={onConfirm} hitSlop={12}>
                <Text style={styles.done}>完了</Text>
              </TouchableOpacity>
            </View>
          </BottomSheetDragHandle>
          <View style={styles.pickerWrap}>{children}</View>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          {Platform.OS === 'ios' ? <View style={{ height: 8 }} /> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

export function pickerThemeProps(theme: Theme) {
  return {
    themeVariant: theme.mode === 'dark' ? ('dark' as const) : ('light' as const),
    accentColor: theme.accent,
    textColor: theme.text,
  };
}
