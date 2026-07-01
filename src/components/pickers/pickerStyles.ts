import { StyleSheet } from 'react-native';
import { Theme } from '../../theme';

export type PickerFieldVariant = 'default' | 'inline' | 'fill';

export function makePickerFieldStyles(theme: Theme) {
  return StyleSheet.create({
    field: {
      backgroundColor: theme.bg,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.separator,
      paddingHorizontal: 14,
      paddingVertical: 11,
      minHeight: 52,
      justifyContent: 'center',
    },
    fieldDefault: {
      alignSelf: 'stretch',
      width: '100%',
    },
    fieldInline: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 48,
      minWidth: 96,
      maxWidth: 112,
      flexShrink: 0,
    },
    fieldFillWrap: {
      width: '100%',
      alignSelf: 'stretch',
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 52,
    },
    fieldDisabled: {
      opacity: 0.45,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 4,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    value: {
      flex: 1,
      minWidth: 0,
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: 0.2,
    },
    valueCompact: {
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    chevronInline: {
      fontSize: 15,
      color: theme.textTertiary,
      fontWeight: '600',
      flexShrink: 0,
      lineHeight: 18,
    },
  });
}

export function makePickerSheetStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.mode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.32)',
    },
    sheet: {
      backgroundColor: theme.elevated,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      paddingBottom: 28,
      ...theme.shadow,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.secondary,
      marginTop: 10,
      marginBottom: 4,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.separator,
    },
    toolbarTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    cancel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textSecondary,
      minWidth: 72,
    },
    done: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.accent,
      minWidth: 72,
      textAlign: 'right',
    },
    pickerWrap: {
      backgroundColor: theme.elevated,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    hint: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
    },
  });
}

export function fieldVariantStyle(
  styles: ReturnType<typeof makePickerFieldStyles>,
  variant: PickerFieldVariant
) {
  if (variant === 'inline') {
    return styles.fieldInline;
  }
  if (variant === 'fill') {
    return styles.fieldFillWrap;
  }
  return styles.fieldDefault;
}
