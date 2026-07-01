import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme, useThemedStyles } from '../../theme';
import { fieldVariantStyle, makePickerFieldStyles, PickerFieldVariant } from './pickerStyles';

interface LooperPickerFieldShellProps {
  label?: string;
  value: string;
  disabled?: boolean;
  variant?: PickerFieldVariant;
  onPress: () => void;
  pressDisabled?: boolean;
}

export function LooperPickerFieldShell({
  label,
  value,
  disabled = false,
  variant = 'default',
  onPress,
  pressDisabled = false,
}: LooperPickerFieldShellProps) {
  const styles = useThemedStyles(makePickerFieldStyles);
  const showChevron = variant === 'default';

  return (
    <TouchableOpacity
      style={[
        styles.field,
        fieldVariantStyle(styles, variant),
        variant === 'default' && styles.fieldDefault,
        variant === 'fill' && styles.fieldFillWrap,
        disabled && styles.fieldDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || pressDisabled}
      activeOpacity={0.75}
    >
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            variant !== 'default' && styles.valueCompact,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
        {showChevron ? <Text style={styles.chevronInline}>›</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function pickerNativeStyle(theme: Theme) {
  return StyleSheet.create({
    picker: {
      width: '100%',
      backgroundColor: theme.elevated,
    },
  }).picker;
}
