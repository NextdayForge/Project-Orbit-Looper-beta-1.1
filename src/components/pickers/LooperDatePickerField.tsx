import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { createElement, useRef, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { useTheme } from '../../theme';
import { LooperPickerFieldShell, pickerNativeStyle } from './LooperPickerFieldShell';
import { PickerFieldVariant } from './pickerStyles';
import { LooperPickerSheet, pickerThemeProps } from './LooperPickerSheet';
import {
  dateKeyToPickerDate,
  formatPickerDateLabel,
  pickerDateToDateKey,
} from './pickerUtils';

interface LooperDatePickerFieldProps {
  value: string;
  onChange: (dateKey: string) => void;
  label?: string;
  disabled?: boolean;
  variant?: PickerFieldVariant;
  minimumDate?: Date;
  maximumDate?: Date;
}

function WebDatePicker({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (dateKey: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const openPicker = () => {
    if (disabled) {
      return;
    }
    const input = inputRef.current;
    if (!input) {
      return;
    }
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.click();
  };

  return (
    <>
      <Pressable onPress={openPicker} disabled={disabled}>
        {children}
      </Pressable>
      {createElement('input', {
        ref: inputRef,
        type: 'date',
        value,
        disabled,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          if (event.target.value) {
            onChange(event.target.value);
          }
        },
        style: {
          position: 'absolute',
          opacity: 0,
          width: 1,
          height: 1,
          pointerEvents: 'none',
        },
      })}
    </>
  );
}

export function LooperDatePickerField({
  value,
  onChange,
  label,
  disabled = false,
  variant = 'default',
  minimumDate,
  maximumDate,
}: LooperDatePickerFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => dateKeyToPickerDate(value));
  const compact = variant === 'fill' || variant === 'inline';

  const openPicker = () => {
    if (disabled) {
      return;
    }
    setDraft(dateKeyToPickerDate(value));
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
  };

  const commitPicker = () => {
    onChange(pickerDateToDateKey(draft));
    closePicker();
  };

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      closePicker();
      if (event.type === 'set' && date) {
        onChange(pickerDateToDateKey(date));
      }
      return;
    }
    if (date) {
      setDraft(date);
    }
  };

  return (
    <>
      <WebDatePicker value={value} onChange={onChange} disabled={disabled}>
        <LooperPickerFieldShell
          label={label}
          value={formatPickerDateLabel(value, compact)}
          disabled={disabled}
          variant={variant}
          onPress={openPicker}
          pressDisabled={Platform.OS === 'web'}
        />
      </WebDatePicker>

      {open && Platform.OS === 'ios' ? (
        <LooperPickerSheet
          visible
          title={label ?? '日付'}
          onCancel={closePicker}
          onConfirm={commitPicker}
        >
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={handleChange}
            style={pickerNativeStyle(theme)}
            {...pickerThemeProps(theme)}
          />
        </LooperPickerSheet>
      ) : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={dateKeyToPickerDate(value)}
          mode="date"
          display="calendar"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
          {...pickerThemeProps(theme)}
        />
      ) : null}
    </>
  );
}
