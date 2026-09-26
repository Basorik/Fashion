import { Link, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { OutfitCollage } from '@/components/outfit-collage';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listOutfits, type Outfit } from '@/lib/db';

const COLUMNS = 2;

export default function OutfitsScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [outfits, setOutfits] = useState<Outfit[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      listOutfits(db).then(setOutfits);
    }, [db]),
  );

  const tileSize = (width - Spacing.three * 2 - Spacing.three * (COLUMNS - 1)) / COLUMNS;

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={outfits ?? []}
        keyExtractor={(outfit) => String(outfit.id)}
        numColumns={COLUMNS}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={
          outfits === null ? null : (
            <View style={styles.empty}>
              <ThemedText type="subtitle">No outfits yet</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Put a few items from your wardrobe together, or let Shuffle deal you one.
              </ThemedText>
              <View style={styles.emptyActions}>
                <Button
                  label="New outfit"
                  onPress={() => router.push('/new-outfit')}
                  variant="primary"
                  grow={false}
                />
                <Button label="Shuffle" onPress={() => router.push('/shuffle')} grow={false} />
              </View>
            </View>
          )
        }
        renderItem={({ item: outfit }) => (
          <Link href={{ pathname: '/outfit/[id]', params: { id: outfit.id } }} asChild>
            <Pressable
              accessibilityLabel={`${outfit.name}, worn ${outfit.wearCount} times`}
              style={({ pressed }) => [{ width: tileSize }, pressed && styles.pressed]}>
              <OutfitCollage photos={outfit.photos} size={tileSize} />
              <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
                {outfit.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {outfit.wearCount === 0 ? 'Not worn yet' : `Worn ${outfit.wearCount}×`}
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
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    flex: 1,
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.six,
  },
  emptyText: {
    textAlign: 'center',
  },
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
