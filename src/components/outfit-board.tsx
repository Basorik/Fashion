import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ItemPhoto } from '@/components/item-photo';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BoardPiece } from '@/lib/board';

// Default tile width as a fraction of the board width (height is 5:4).
const TILE = 0.38;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;

type Props = {
  pieces: BoardPiece[];
  size: number;
  // When set, pieces can be dragged, pinched and tapped to the front.
  onChange?: (piece: BoardPiece) => void;
  onBringToFront?: (id: number) => void;
};

export function OutfitBoard({ pieces, size, onChange, onBringToFront }: Props) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.board,
        { width: size, height: size, backgroundColor: theme.backgroundElement },
      ]}>
      {pieces.map((piece) =>
        onChange ? (
          <DraggablePiece
            key={piece.id}
            piece={piece}
            size={size}
            onChange={onChange}
            onBringToFront={onBringToFront}
          />
        ) : (
          <StaticPiece key={piece.id} piece={piece} size={size} />
        ),
      )}
    </View>
  );
}

function tileBox(size: number) {
  const width = size * TILE;
  return { width, height: width * 1.25 };
}

function StaticPiece({ piece, size }: { piece: BoardPiece; size: number }) {
  const { width, height } = tileBox(size);
  return (
    <View
      style={[
        styles.piece,
        {
          width,
          height,
          left: piece.x * size - width / 2,
          top: piece.y * size - height / 2,
          transform: [{ scale: piece.scale }],
        },
      ]}>
      <ItemPhoto photo={piece.photo} name={piece.name} style={styles.photo} />
    </View>
  );
}

function DraggablePiece({
  piece,
  size,
  onChange,
  onBringToFront,
}: {
  piece: BoardPiece;
  size: number;
  onChange: (piece: BoardPiece) => void;
  onBringToFront?: (id: number) => void;
}) {
  const { width, height } = tileBox(size);
  const x = useSharedValue(piece.x * size);
  const y = useSharedValue(piece.y * size);
  const scale = useSharedValue(piece.scale);
  const start = useSharedValue({ x: 0, y: 0, scale: 1 });

  function report(nextX: number, nextY: number, nextScale: number) {
    onChange({ ...piece, x: nextX / size, y: nextY / size, scale: nextScale });
  }

  const pan = Gesture.Pan()
    .onStart(() => {
      start.value = { x: x.value, y: y.value, scale: scale.value };
    })
    .onUpdate((event) => {
      x.value = Math.min(Math.max(start.value.x + event.translationX, 0), size);
      y.value = Math.min(Math.max(start.value.y + event.translationY, 0), size);
    })
    .onEnd(() => {
      scheduleOnRN(report, x.value, y.value, scale.value);
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      start.value = { x: x.value, y: y.value, scale: scale.value };
    })
    .onUpdate((event) => {
      scale.value = Math.min(Math.max(start.value.scale * event.scale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      scheduleOnRN(report, x.value, y.value, scale.value);
    });

  const tap = Gesture.Tap().onEnd(() => {
    if (onBringToFront) scheduleOnRN(onBringToFront, piece.id);
  });

  const animatedStyle = useAnimatedStyle(() => ({
    left: x.value - width / 2,
    top: y.value - height / 2,
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, pinch, tap)}>
      <Animated.View style={[styles.piece, { width, height }, animatedStyle]}>
        <ItemPhoto photo={piece.photo} name={piece.name} style={styles.photo} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  board: {
    borderRadius: Radius.large,
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.small,
  },
});
