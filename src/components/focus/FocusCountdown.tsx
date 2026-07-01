import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { buildCountdownSlots, layoutMetrics } from '../../focus/focusCountdown';
import { Theme, useThemedStyles } from '../../theme';

const TIMER_FONT = Platform.select({
  ios: 'Menlo-Bold',
  android: 'monospace',
  default: 'monospace',
});

interface FocusCountdownProps {
  remainingSeconds: number;
}

export function FocusCountdown({ remainingSeconds }: FocusCountdownProps) {
  const styles = useThemedStyles(makeStyles);
  const { layout, slots } = buildCountdownSlots(remainingSeconds);
  const metrics = useMemo(() => layoutMetrics(layout), [layout]);

  return (
    <View style={styles.wrap} accessibilityRole="timer">
      <View
        style={[
          styles.row,
          {
            width: metrics.rowWidth,
            height: metrics.rowHeight,
          },
        ]}
      >
        {slots.map((char, index) => {
          const isColon = char === ':';

          if (isColon) {
            return (
              <View
                key={`${layout}-colon-${index}`}
                style={[
                  styles.colonSlot,
                  {
                    width: metrics.colonSlotWidth,
                    height: metrics.rowHeight,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.colon,
                    {
                      fontSize: metrics.colonFontSize,
                      lineHeight: metrics.lineHeight,
                    },
                  ]}
                  allowFontScaling={false}
                >
                  :
                </Text>
              </View>
            );
          }

          return (
            <View
              key={`${layout}-digit-${index}`}
              style={[
                styles.digitSlot,
                {
                  width: metrics.digitSlotWidth,
                  height: metrics.rowHeight,
                },
              ]}
            >
              <Text
                style={[
                  styles.digit,
                  {
                    fontSize: metrics.fontSize,
                    lineHeight: metrics.lineHeight,
                  },
                ]}
                allowFontScaling={false}
              >
                {char}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    digitSlot: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    colonSlot: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 4,
    },
    digit: {
      textAlign: 'center',
      color: theme.text,
      fontFamily: TIMER_FONT,
      fontWeight: Platform.OS === 'android' ? '700' : '400',
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    colon: {
      textAlign: 'center',
      color: theme.textSecondary,
      fontFamily: TIMER_FONT,
      fontWeight: Platform.OS === 'android' ? '700' : '400',
      includeFontPadding: false,
    },
  });
