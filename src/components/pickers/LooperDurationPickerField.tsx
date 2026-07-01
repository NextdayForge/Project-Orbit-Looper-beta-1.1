import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { createElement, useRef, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { durationLabel } from '../../utils/time';
import { useTheme } from '../../theme';
import { LooperPickerFieldShell, pickerNativeStyle } from './LooperPickerFieldShell';
import { PickerFieldVariant } from './pickerStyles';
import { LooperPickerSheet, pickerThemeProps } from './LooperPickerSheet';
import {
  clampDurationMinutes,
  durationToPickerDate,
  pickerDateToDuration,
} from './pickerUtils';

interface LooperDurationPickerFieldProps {
  value: number;
  onChange: (minutes: number) => void;
  label?: string;
  disabled?: boolean;
  minMinutes?: number;
  maxMinutes?: number;
  minuteInterval?: 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;
  variant?: PickerFieldVariant;
}

function WebDurationPicker({
  value,
  onChange,
  disabled,
  minMinutes,
  maxMinutes,
  minuteInterval,
  children,
}: {
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
  minMinutes: number;
  maxMinutes: number;
  minuteInterval: number;
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

  const hours = String(Math.floor(value / 60)).padStart(2, '0');
  const minutes = String(value % 60).padStart(2, '0');

  return (
    <>
      <Pressable onPress={openPicker} disabled={disabled}>
        {children}
      </Pressable>
      {createElement('input', {
        ref: inputRef,
        type: 'time',
        value: `${hours}:${minutes}`,
        disabled,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          const [h, m] = event.target.value.split(':').map(Number);
          if (Number.isFinite(h) && Number.isFinite(m)) {
            onChange(clampDurationMinutes(h * 60 + m, minMinutes, maxMinutes, minuteInterval));
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

export function LooperDurationPickerField({
  value,
  onChange,
  label,
  disabled = false,
  minMinutes = 5,
  maxMinutes = 480,
  minuteInterval = 5,
  variant = 'default',
}: LooperDurationPickerFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => durationToPickerDate(value));

  const openPicker = () => {
    if (disabled) {
      return;
    }
    setDraft(durationToPickerDate(clampDurationMinutes(value, minMinutes, maxMinutes, minuteInterval)));
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
  };

  const commitPicker = () => {
    onChange(clampDurationMinutes(pickerDateToDuration(draft), minMinutes, maxMinutes, minuteInterval));
    closePicker();
  };

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      closePicker();
      if (event.type === 'set' && date) {
        onChange(clampDurationMinutes(pickerDateToDuration(date), minMinutes, maxMinutes, minuteInterval));
      }
      return;
    }
    if (date) {
      setDraft(date);
    }
  };

  return (
    <>
      <WebDurationPicker
        value={value}
        onChange={onChange}
        disabled={disabled}
        minMinutes={minMinutes}
        maxMinutes={maxMinutes}
        minuteInterval={minuteInterval}
      >
        <LooperPickerFieldShell
          label={label}
          value={durationLabel(0, value)}
          disabled={disabled}
          variant={variant}
          onPress={openPicker}
          pressDisabled={Platform.OS === 'web'}
        />
      </WebDurationPicker>

      {open && Platform.OS === 'ios' ? (
        <LooperPickerSheet
          visible
          title={label ?? '所要時間'}
          hint={`${minMinutes}分〜${durationLabel(0, maxMinutes)}`}
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
          value={durationToPickerDate(value)}
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
