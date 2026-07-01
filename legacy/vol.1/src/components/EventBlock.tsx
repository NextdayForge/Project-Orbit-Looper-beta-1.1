import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLOR_MAP, ScheduleEvent } from '../types/schedule';
import { formatTime, LayoutEvent } from '../utils/time';
import { theme } from '../theme';

interface EventBlockProps {
  layout: LayoutEvent;
  canvasWidth: number;
  use24Hour: boolean;
  onPress: (event: ScheduleEvent) => void;
}

export function EventBlock({ layout, canvasWidth, use24Hour, onPress }: EventBlockProps) {
  const { event, top, height, column, totalColumns } = layout;
  const colors = COLOR_MAP[event.color];
  const colWidth = canvasWidth / totalColumns;
  const left = column * colWidth + 4;
  const width = colWidth - 8;
  const isShort = event.endMinutes - event.startMinutes <= 15;

  return (
    <TouchableOpacity
      style={[
        styles.block,
        {
          top,
          height,
          left,
          width: Math.max(width, 40),
          backgroundColor: colors.bg,
          borderLeftColor: colors.border,
        },
        isShort && styles.blockShort,
      ]}
      onPress={() => onPress(event)}
      activeOpacity={0.85}
    >
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={isShort ? 1 : 2}>
        {event.title}
      </Text>
      <Text style={styles.time} numberOfLines={1}>
        {formatTime(event.startMinutes, use24Hour)} - {formatTime(event.endMinutes, use24Hour)}
      </Text>
    </TouchableOpacity>
  );
}

export function CurrentTimeIndicator({ pxPerMinute }: { pxPerMinute: number }) {
  const now = new Date();
  const top = (now.getHours() * 60 + now.getMinutes()) * pxPerMinute;
  return (
    <View style={[styles.currentTime, { top }]}>
      <View style={styles.currentDot} />
      <View style={styles.currentLine} />
    </View>
  );
}

export function TimelineCanvas({
  totalHeight,
  pxPerMinute,
  use24Hour,
  isToday,
  layouts,
  onCanvasLayout,
  onCanvasPress,
  onEditEvent,
}: {
  totalHeight: number;
  pxPerMinute: number;
  use24Hour: boolean;
  isToday: boolean;
  layouts: LayoutEvent[];
  onCanvasLayout: (width: number) => void;
  onCanvasPress: (locationY: number) => void;
  onEditEvent: (event: ScheduleEvent) => void;
}) {
  const [canvasWidth, setCanvasWidth] = useState(0);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setCanvasWidth(w);
    onCanvasLayout(w);
  };

  return (
    <Pressable
      style={[styles.canvas, { height: totalHeight }]}
      onPress={(e) => onCanvasPress(e.nativeEvent.locationY)}
      onLayout={handleLayout}
    >
      {hours.map((h) => (
        <View key={h}>
          <View style={[styles.hourLine, { top: h * 60 * pxPerMinute }]} />
          <View style={[styles.halfLine, { top: h * 60 * pxPerMinute + 30 * pxPerMinute }]} />
        </View>
      ))}
      {isToday && <CurrentTimeIndicator pxPerMinute={pxPerMinute} />}
      {canvasWidth > 0 &&
        layouts.map((layout) => (
          <EventBlock
            key={layout.event.id}
            layout={layout}
            canvasWidth={canvasWidth}
            use24Hour={use24Hour}
            onPress={onEditEvent}
          />
        ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    borderLeftWidth: 3,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    elevation: 2,
  },
  blockShort: { justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '600' },
  time: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  currentTime: {
    position: 'absolute',
    left: -6,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 3,
  },
  currentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.destructive,
  },
  currentLine: { flex: 1, height: 2, backgroundColor: theme.destructive },
  canvas: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: theme.separator,
    marginRight: 12,
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.separator,
  },
  halfLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.08)',
  },
});
