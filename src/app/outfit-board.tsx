import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { FooterBar } from '@/components/footer-bar';
import { OutfitBoard } from '@/components/outfit-board';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { getBoard, saveBoard, type BoardPiece } from '@/lib/board';
import { successFeedback } from '@/lib/haptics';

// Arrange an outfit's items on a board: drag to move, pinch to resize, tap to bring forward.
export default function OutfitBoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const outfitId = Number(id);
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [pieces, setPieces] = useState<BoardPiece[] | null>(null);
  const [saving, run] = useBusy();

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

  function save() {
    if (!pieces) return;
    run(async () => {
      await saveBoard(db, outfitId, pieces);
      successFeedback();
      router.back();
    }, 'Could not save layout');
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="small" themeColor="textSecondary">
          Drag to move, pinch to resize, tap to bring to the front.
        </ThemedText>
        {pieces && (
          <OutfitBoard
            pieces={pieces}
            size={size}
            onChange={update}
            onBringToFront={bringToFront}
          />
        )}
      </View>
      <FooterBar>
        <Button
          label="Save layout"
          onPress={save}
          busy={saving}
          disabled={!pieces}
          variant="primary"
        />
      </FooterBar>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
});
