import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CategoryChips } from '@/components/category-chips';
import { ItemPhoto } from '@/components/item-photo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Category } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { listItems, type ItemWithStats } from '@/lib/db';

const COLUMNS = 3;

export default function WardrobeScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<Category | undefined>();
  const [items, setItems] = useState<ItemWithStats[]>([]);

  // Reload whenever the screen regains focus, e.g. after adding or deleting an item.
  useFocusEffect(
    useCallback(() => {
      listItems(db, category).then(setItems);
    }, [db, category])
  );

  const tileSize = (width - Spacing.three * 2 - Spacing.two * (COLUMNS - 1)) / COLUMNS;

  return (
    <ThemedView style={styles.container}>
      <View>
        <CategoryChips selected={category} onSelect={setCategory} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        numColumns={COLUMNS}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText type="subtitle">
              {category ? `No ${category.toLowerCase()} yet` : 'Your wardrobe is empty'}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              Tap + to add an item from a photo, a barcode, or by hand.
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
            <Pressable accessibilityLabel={item.name} style={{ width: tileSize }}>
              <ItemPhoto
                photo={item.photo}
                name={item.name}
                style={[styles.tile, { width: tileSize, height: tileSize * 1.25 }]}
              />
              <ThemedText type="small" numberOfLines={1}>
                {item.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Worn {item.wearCount}×
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
    gap: Spacing.two,
  },
  tile: {
    borderRadius: 8,
    marginBottom: Spacing.one,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.six,
  },
  emptyText: {
    marginTop: Spacing.two,
  },
});
