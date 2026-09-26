import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { OutfitCollage } from '@/components/outfit-collage';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listOutfits, type Outfit } from '@/lib/db';

const COLUMNS = 2;

export default function OutfitsScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [outfits, setOutfits] = useState<Outfit[]>([]);

  useFocusEffect(
    useCallback(() => {
      listOutfits(db).then(setOutfits);
    }, [db]),
  );

  const tileSize = (width - Spacing.three * 2 - Spacing.three * (COLUMNS - 1)) / COLUMNS;

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={outfits}
        keyExtractor={(outfit) => String(outfit.id)}
        numColumns={COLUMNS}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText type="subtitle">No outfits yet</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              Tap + to put items from your wardrobe together.
            </ThemedText>
          </View>
        }
        renderItem={({ item: outfit }) => (
          <Link href={{ pathname: '/outfit/[id]', params: { id: outfit.id } }} asChild>
            <Pressable accessibilityLabel={outfit.name} style={{ width: tileSize }}>
              <OutfitCollage photos={outfit.photos} size={tileSize} />
              <ThemedText type="small" numberOfLines={1} style={styles.name}>
                {outfit.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Worn {outfit.wearCount}×
              </ThemedText>
            </Pressable>
          </Link>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grid: {
    padding: Spacing.three,
    gap: Spacing.three,
    flexGrow: 1,
  },
  gridRow: {
    gap: Spacing.three,
  },
  name: {
    marginTop: Spacing.one,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.six,
  },
  emptyText: {
    marginTop: Spacing.two,
    textAlign: 'center',
  },
});
