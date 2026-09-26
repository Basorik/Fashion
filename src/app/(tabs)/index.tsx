import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CategoryChips } from '@/components/category-chips';
import { ItemPhoto } from '@/components/item-photo';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Category } from '@/constants/categories';
import { Radius, Spacing } from '@/constants/theme';
import { listItems, type ItemWithStats } from '@/lib/db';

const COLUMNS = 3;

// True when every word typed appears in the item's name, brand or tags.
function matchesSearch(item: ItemWithStats, query: string) {
  const haystack = [item.name, item.brand, item.tagText].join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export default function WardrobeScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<Category | undefined>();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ItemWithStats[] | null>(null);

  // Reload whenever the screen regains focus, e.g. after adding or deleting an item.
  useFocusEffect(
    useCallback(() => {
      listItems(db, category).then(setItems);
    }, [db, category]),
  );

  const tileSize = (width - Spacing.three * 2 - Spacing.two * (COLUMNS - 1)) / COLUMNS;
  const visible = query.trim() ? (items ?? []).filter((item) => matchesSearch(item, query)) : items;
  const searching = query.trim() !== '';

  return (
    <ThemedView style={styles.container}>
      <View style={styles.search}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, brand, color…"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search wardrobe"
        />
      </View>
      <View>
        <CategoryChips selected={category} onSelect={setCategory} />
      </View>
      <FlatList
        data={visible ?? []}
        keyExtractor={(item) => String(item.id)}
        numColumns={COLUMNS}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          visible === null ? null : (
            <View style={styles.empty}>
              <ThemedText type="subtitle" style={styles.center}>
                {searching
                  ? 'Nothing matches'
                  : category
                    ? `No ${category.toLowerCase()} yet`
                    : 'Your wardrobe is empty'}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {searching
                  ? 'Try another word, or clear the search.'
                  : 'Tap + to add an item from a photo, a barcode, a link, or by hand.'}
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
            <Pressable
              accessibilityLabel={`${item.name}, worn ${item.wearCount} times`}
              style={({ pressed }) => [{ width: tileSize }, pressed && styles.pressed]}>
              <ItemPhoto
                photo={item.photo}
                name={item.name}
                style={[styles.tile, { width: tileSize, height: tileSize * 1.25 }]}
              />
              <ThemedText type="small" numberOfLines={1}>
                {item.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.wearCount === 0 ? 'Not worn yet' : `Worn ${item.wearCount}×`}
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
  search: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  grid: {
    padding: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
    flexGrow: 1,
  },
  gridRow: {
    gap: Spacing.two,
  },
  tile: {
    borderRadius: Radius.medium,
    marginBottom: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },
  center: {
    textAlign: 'center',
  },
});
