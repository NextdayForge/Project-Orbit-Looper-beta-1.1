import React, { useMemo, useRef } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DragMode } from '../presentation/calendar';
import { CalendarDisplayEvent } from '../presentation/calendar/CalendarDisplayEvent';
import { formatTime, LayoutEvent, snapToMinutes } from '../utils/time';
import { Theme, useTheme, useThemedStyles } from '../theme';

const RESIZE_HANDLE_HEIGHT = 12;
const DRAG_THRESHOLD_PX = 8;

export interface TimelineDragHandlers {
  onBeginDrag: (eventId: string, mode: DragMode) => boolean;
  onDragMove: (deltaMinutes: number) => void;
  onDragResize: (endMinutes: number) => void;
  onDragCommit: () => Promise<void>;
  onDragCancel: () => void;
}

interface EventBlockProps {
  layout: LayoutEvent;
  canvasWidth: number;
  use24Hour: boolean;
  pxPerMinute: number;
  canDrag: boolean;
  dragPreview?: { startMinutes: number; endMinutes: number } | null;
  dragHandlers?: TimelineDragHandlers;
  onPress: (event: CalendarDisplayEvent) => void;
}

export function EventBlock({
  layout,
  canvasWidth,
  use24Hour,
  pxPerMinute,
  canDrag,
  dragPreview,
  dragHandlers,
  onPress,
}: EventBlockProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { event, top, height, column, totalColumns } = layout;
  const colors = theme.eventColors[event.color];
  const colWidth = canvasWidth / totalColumns;
  const left = column * colWidth + 4;
  const width = colWidth - 8;
  const isShort = event.endMinutes - event.startMinutes <= 15;

  const startMinutes = dragPreview?.startMinutes ?? event.startMinutes;
  const endMinutes = dragPreview?.endMinutes ?? event.endMinutes;
  const blockTop = dragPreview ? startMinutes * pxPerMinute : top;
  const blockHeight = dragPreview
    ? Math.max((endMinutes - startMinutes) * pxPerMinute, height)
    : height;

  const dragModeRef = useRef<DragMode>('move');
  const dragActiveRef = useRef(false);
  const originEndRef = useRef(event.endMinutes);
  const touchStartYRef = useRef(0);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canDrag && !!dragHandlers,
        onMoveShouldSetPanResponder: (_, gesture) =>
          canDrag && !!dragHandlers && Math.abs(gesture.dy) > DRAG_THRESHOLD_PX,
        onPanResponderGrant: (evt) => {
          touchStartYRef.current = evt.nativeEvent.locationY;
          dragActiveRef.current = false;
          originEndRef.current = event.endMinutes;
        },
        onPanResponderMove: (_, gesture) => {
          if (!dragHandlers) {
            return;
          }

          if (!dragActiveRef.current) {
            if (Math.abs(gesture.dy) <= DRAG_THRESHOLD_PX) {
              return;
            }

            dragModeRef.current =
              touchStartYRef.current > height - RESIZE_HANDLE_HEIGHT ? 'resize' : 'move';
            dragActiveRef.current = dragHandlers.onBeginDrag(event.id, dragModeRef.current);
            if (!dragActiveRef.current) {
              return;
            }
          }

          if (dragModeRef.current === 'move') {
            const deltaMinutes = snapToMinutes(gesture.dy / pxPerMinute, 5);
            dragHandlers.onDragMove(deltaMinutes);
            return;
          }

          const newEnd = originEndRef.current + snapToMinutes(gesture.dy / pxPerMinute, 5);
          dragHandlers.onDragResize(newEnd);
        },
        onPanResponderRelease: async () => {
          if (dragActiveRef.current && dragHandlers) {
            await dragHandlers.onDragCommit();
          } else {
            onPress(event);
          }
          dragActiveRef.current = false;
        },
        onPanResponderTerminate: () => {
          if (dragActiveRef.current && dragHandlers) {
            dragHandlers.onDragCancel();
          }
          dragActiveRef.current = false;
        },
      }),
    [canDrag, dragHandlers, event, height, onPress, pxPerMinute]
  );

  const blockContent = (
    <>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={isShort ? 1 : 2}>
        {event.title}
      </Text>
      <Text style={styles.time} numberOfLines={1}>
        {formatTime(startMinutes, use24Hour)} - {formatTime(endMinutes, use24Hour)}
      </Text>
    </>
  );

  if (canDrag && dragHandlers) {
    return (
      <View
        style={[
          styles.block,
          {
            top: blockTop,
            height: blockHeight,
            left,
            width: Math.max(width, 40),
            backgroundColor: colors.bg,
            borderLeftColor: colors.border,
          },
          isShort && styles.blockShort,
        ]}
        {...panResponder.panHandlers}
      >
        {blockContent}
      </View>
    );
  }

  return (
    <Pressable
      style={[
        styles.block,
        {
          top: blockTop,
          height: blockHeight,
          left,
          width: Math.max(width, 40),
          backgroundColor: colors.bg,
          borderLeftColor: colors.border,
        },
        isShort && styles.blockShort,
      ]}
      onPress={() => onPress(event)}
    >
      {blockContent}
    </Pressable>
  );
}

export function CurrentTimeIndicator({ pxPerMinute }: { pxPerMinute: number }) {
  const styles = useThemedStyles(makeStyles);
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
  editableEventIds,
  dragPreview,
  dragHandlers,
  onCanvasLayout,
  onCanvasPress,
  onEditEvent,
}: {
  totalHeight: number;
  pxPerMinute: number;
  use24Hour: boolean;
  isToday: boolean;
  layouts: LayoutEvent[];
  editableEventIds: Set<string>;
  dragPreview?: { eventId: string; startMinutes: number; endMinutes: number } | null;
  dragHandlers?: TimelineDragHandlers;
  onCanvasLayout: (width: number) => void;
  onCanvasPress: (locationY: number) => void;
  onEditEvent: (event: CalendarDisplayEvent) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [canvasWidth, setCanvasWidth] = React.useState(0);
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
            pxPerMinute={pxPerMinute}
            canDrag={editableEventIds.has(layout.event.id)}
            dragPreview={
              dragPreview?.eventId === layout.event.id
                ? {
                    startMinutes: dragPreview.startMinutes,
                    endMinutes: dragPreview.endMinutes,
                  }
                : null
            }
            dragHandlers={dragHandlers}
            onPress={onEditEvent}
          />
        ))}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
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
    borderTopColor: theme.hairlineSoft,
  },
  });
