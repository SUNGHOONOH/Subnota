import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';

import BrickBlock from '../../../components/BrickBlock';

export const BRICK_HEIGHT = 68;
export const BRICK_GAP = 7;

export interface CalendarDisplayBrick {
  id: string;
  day: number;
  note: string;
  order: number;
  scheduledAt?: number;
  time?: string | null;
  title: string;
  tone: 'ink' | 'clay' | 'olive' | 'steel';
}

export interface DropPreview {
  day: number;
  id: string;
  order: number;
}

interface DraggableBrickProps {
  brick: CalendarDisplayBrick;
  columnWidth: number;
  index: number;
  onDelete: (brick: CalendarDisplayBrick) => void;
  onDragStateChange: (isDragging: boolean) => void;
  onMove: (id: string, day: number, order: number) => void;
  onOpen: (brick: CalendarDisplayBrick) => void;
  onPreview: (preview: DropPreview | null) => void;
  orientation?: 'columns' | 'rows';
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const DraggableBrick = ({
  brick,
  columnWidth,
  index,
  onDelete,
  onDragStateChange,
  onMove,
  onOpen,
  onPreview,
  orientation = 'columns',
}: DraggableBrickProps) => {
  const drag = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const moveBrick = useCallback(
    (translationX: number, translationY: number) => {
      const dayDelta =
        orientation === 'rows'
          ? Math.round(translationY / 94)
          : Math.round(translationX / columnWidth);
      const orderDelta =
        orientation === 'rows'
          ? Math.round(translationX / Math.max(1, columnWidth))
          : Math.round(translationY / (BRICK_HEIGHT + BRICK_GAP));
      const nextDay = clamp(brick.day + dayDelta, 0, 6);
      const nextOrder = Math.max(0, index + orderDelta);

      onMove(brick.id, nextDay, nextOrder);
    },
    [brick.day, brick.id, columnWidth, index, onMove, orientation],
  );

  const previewBrick = useCallback(
    (translationX: number, translationY: number) => {
      const dayDelta =
        orientation === 'rows'
          ? Math.round(translationY / 94)
          : Math.round(translationX / columnWidth);
      const orderDelta =
        orientation === 'rows'
          ? Math.round(translationX / Math.max(1, columnWidth))
          : Math.round(translationY / (BRICK_HEIGHT + BRICK_GAP));

      onPreview({
        id: brick.id,
        day: clamp(brick.day + dayDelta, 0, 6),
        order: Math.max(0, index + orderDelta),
      });
    },
    [brick.day, brick.id, columnWidth, index, onPreview, orientation],
  );

  const finishInteraction = useCallback(
    (openedByTap: boolean) => {
      Animated.parallel([
        Animated.spring(drag, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsDragging(false);
        onDragStateChange(false);
        onPreview(null);
        if (openedByTap) {
          onOpen(brick);
        }
      });
    },
    [brick, drag, onDragStateChange, onOpen, onPreview, scale],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
        },
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
        },
        onPanResponderGrant: () => {
          longPressTimer.current = setTimeout(() => {
            onDelete(brick);
            finishInteraction(false);
          }, 600);
          setIsDragging(true);
          onDragStateChange(true);
          Animated.spring(scale, {
            toValue: 1.04,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderMove: (_event, gestureState) => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          drag.setValue({ x: gestureState.dx, y: gestureState.dy });
          previewBrick(gestureState.dx, gestureState.dy);
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          const isTap =
            Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6;

          if (!isTap) {
            moveBrick(gestureState.dx, gestureState.dy);
          }

          finishInteraction(isTap);
        },
        onPanResponderTerminate: () => {
          finishInteraction(false);
        },
      }),
    [
      brick,
      drag,
      finishInteraction,
      moveBrick,
      onDelete,
      onDragStateChange,
      previewBrick,
      scale,
    ],
  );

  const animatedBrickStyle = useMemo(
    () => ({
      elevation: isDragging ? 1000 : index + 1,
      opacity: isDragging ? 0.92 : 1,
      transform: [{ translateX: drag.x }, { translateY: drag.y }, { scale }],
      zIndex: isDragging ? 1000 : index + 1,
    }),
    [drag.x, drag.y, index, isDragging, scale],
  );

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.brickOffset,
        index % 2 === 1 && styles.brickInset,
        animatedBrickStyle,
      ]}
    >
      <BrickBlock
        emptyNoteCompact={orientation === 'rows'}
        note={brick.note}
        time={brick.time}
        title={brick.title}
        tone={brick.tone}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  brickOffset: {
    position: 'relative',
    width: '100%',
  },
  brickInset: {
    paddingLeft: 7,
  },
});

export default DraggableBrick;
