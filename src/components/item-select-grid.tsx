import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CategoryChips } from '@/components/category-chips';
import { ItemPhoto } from '@/components/item-photo';
import { StatusBadge } from '@/components/status-badge';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import type { Category } from '@/constants/categories';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listItems, type ItemWithStats } from '@/lib/db';
import { matchesSearch } from '@/lib/wardrobe-view';

const COLUMNS = 3;

type Props = {
  // Selected item ids, in tap order (shown as numbers on the tiles).
  selected: number[];
  onChange: (selected: number[]) => void;
  header?: React.ReactElement;
};

// Multi-select grid of wardrobe items with a category filter.
export function ItemSelectGrid({ selected, onChange, header }: Props) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<ItemWithStats[]>([]);
  const [category, setCategory] = useState<Category | undefined>();
  const [query, setQuery] = useState('');

  useEffect(() => {
    // Archived items are put away, so they aren't offered here.
    listItems(db, category).then((all) => setItems(all.filter((item) => !item.archivedAt)));
  }, [db, category]);

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  }

  const visible = query.trim() ? items.filter((item) => matchesSearch(item, query)) : items;
  const tileSize = (width - Spacing.three * 2 - Spacing.two * (COLUMNS - 1)) / COLUMNS;

  return (
    <FlatList
      data={visible}
      keyExtractor={(item) => String(item.id)}
      numColumns={COLUMNS}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.gridRow}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, brand, color…"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel="Search wardrobe"
          />
          <View style={styles.chips}>
            <CategoryChips selected={category} onSelect={setCategory} />
          </View>
        </View>
      }
      ListEmptyComponent={
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          {query.trim()
            ? 'Nothing matches. Try another word.'
            : category
              ? `No ${category.toLowerCase()} in your wardrobe`
              : 'Add items to your wardrobe first'}
        </ThemedText>
      }
      renderItem={({ item }) => {
        const order = selected.indexOf(item.id);
        const isSelected = order !== -1;
        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={isSelected ? `${item.name}, number ${order + 1}` : item.name}
            onPress={() => toggle(item.id)}
            style={{ width: tileSize }}>
            <ItemPhoto
              photo={item.photo}
              name={item.name}
              style={[
                styles.tile,
                {
                  width: tileSize,
                  height: tileSize * 1.25,
                  borderColor: isSelected ? theme.accent : 'transparent',
                },
              ]}
            />
            {isSelected && (
              <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  {order + 1}
                </ThemedText>
              </View>
            )}
            {item.status && <StatusBadge status={item.status} lentTo={item.lentTo} />}
            <ThemedText type="small" numberOfLines={1}>
              {item.name}
            </ThemedText>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    padding: Spacing.three,
    gap: Spacing.three,
    flexGrow: 1,
  },
  gridRow: {
    gap: Spacing.two,
  },
  header: {
    gap: Spacing.two,
  },
  chips: {
    marginHorizontal: -Spacing.three,
  },
  tile: {
    borderRadius: Radius.medium,
    borderWidth: 3,
    marginBottom: Spacing.one,
  },
  badge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
});
