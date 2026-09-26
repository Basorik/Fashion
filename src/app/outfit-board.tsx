import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { OutfitBoard } from '@/components/outfit-board';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getBoard, saveBoard, type BoardPiece } from '@/lib/board';

// Arrange an outfit's items on a board: drag to move, pinch to resize, tap to bring forward.
export default function OutfitBoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const outfitId = Number(id);
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [pieces, setPieces] = useState<BoardPiece[] | null>(null);

  useEffect(() => {
    getBoard(db, outfitId).then(({ pieces: loaded }) => setPieces(loaded));
  }, [db, outfitId]);

  const size = width - Spacing.three * 2;

  function update(changed: BoardPiece) {
    setPieces(
      (current) => current?.map((piece) => (piece.id === changed.id ? changed : piece)) ?? null,
    );
  }

  function bringToFront(pieceId: number) {
    setPieces((current) => {
      if (!current) return current;
      const piece = current.find((entry) => entry.id === pieceId);
      return piece ? [...current.filter((entry) => entry.id !== pieceId), piece] : current;
    });
  }

  async function save() {
    if (!pieces) return;
    await saveBoard(db, outfitId, pieces);
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        Drag to move, pinch to resize, tap to bring to the front.
      </ThemedText>
      {pieces && (
        <OutfitBoard pieces={pieces} size={size} onChange={update} onBringToFront={bringToFront} />
      )}
      <View style={styles.row}>
        <Button label="Save layout" onPress={save} disabled={!pieces} primary />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
  },
});
