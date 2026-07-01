import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { createElement, useRef, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { minutesToTime } from '../../utils/time';
import { useTheme } from '../../theme';
import { LooperPickerFieldShell, pickerNativeStyle } from './LooperPickerFieldShell';
import { PickerFieldVariant } from './pickerStyles';
import { LooperPickerSheet, pickerThemeProps } from './LooperPickerSheet';
import { minutesToPickerDate, pickerDateToMinutes } from './pickerUtils';

interface LooperTimePickerFieldProps {
  value: number;
  onChange: (minutes: number) => void;
  label?: string;
  disabled?: boolean;
  minuteInterval?: 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;
  variant?: PickerFieldVariant;
}

function WebTimePicker({
  value,
  onChange,
  disabled,
  children,
}: {
  value: number;
  onChange: (minutes: number) => void;
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
        type: 'time',
        value: minutesToTime(value),
        disabled,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          const [hours, minutes] = event.target.value.split(':').map(Number);
          if (Number.isFinite(hours) && Number.isFinite(minutes)) {
            onChange(hours * 60 + minutes);
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

export function LooperTimePickerField({
  value,
  onChange,
  label,
  disabled = false,
  minuteInterval = 5,
  variant = 'default',
}: LooperTimePickerFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => minutesToPickerDate(value));

  const openPicker = () => {
    if (disabled) {
      return;
    }
    setDraft(minutesToPickerDate(value));
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
  };

  const commitPicker = () => {
    onChange(pickerDateToMinutes(draft));
    closePicker();
  };

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      closePicker();
      if (event.type === 'set' && date) {
        onChange(pickerDateToMinutes(date));
      }
      return;
    }
    if (date) {
      setDraft(date);
    }
  };

  return (
    <>
      <WebTimePicker value={value} onChange={onChange} disabled={disabled}>
        <LooperPickerFieldShell
          label={label}
          value={minutesToTime(value)}
          disabled={disabled}
          variant={variant}
          onPress={openPicker}
          pressDisabled={Platform.OS === 'web'}
        />
      </WebTimePicker>

      {open && Platform.OS === 'ios' ? (
        <LooperPickerSheet
          visible
          title={label ?? '時刻'}
          onCancel={closePicker}
          onConfirm={commitPicker}
        >
          <DateTimePicker
            value={draft}
            mode="time"
            display="spinner"
            minuteInterval={minuteInterval}
            onChange={handleChange}
            style={pickerNativeStyle(theme)}
            {...pickerThemeProps(theme)}
          />
        </LooperPickerSheet>
      ) : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={minutesToPickerDate(value)}
          mode="time"
          display="spinner"
          minuteInterval={minuteInterval}
          onChange={handleChange}
          {...pickerThemeProps(theme)}
        />
      ) : null}
    </>
  );
}
