import { Link, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/button';
import { CategoryChips } from '@/components/category-chips';
import { Chip } from '@/components/chip';
import { ItemPhoto } from '@/components/item-photo';
import { StatusBadge } from '@/components/status-badge';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Category } from '@/constants/categories';
import { statusLabel } from '@/constants/item-status';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDay } from '@/lib/dates';
import { clearWashStatus, listItems, today, type ItemWithStats } from '@/lib/db';
import { formatPrice } from '@/lib/money';
import {
  matchesSearch,
  matchesShow,
  sortItems,
  WardrobeShows,
  WardrobeSorts,
  type WardrobeShow,
  type WardrobeSort,
} from '@/lib/wardrobe-view';

const COLUMNS = 3;

export default function WardrobeScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<Category | undefined>();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ItemWithStats[] | null>(null);
  const [sort, setSort] = useState<WardrobeSort>('newest');
  const [show, setShow] = useState<WardrobeShow>('all');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [clearing, run] = useBusy();
  const theme = useTheme();

  const load = useCallback(() => {
    listItems(db, category).then(setItems);
  }, [db, category]);

  // Reload whenever the screen regains focus, e.g. after adding or deleting an item.
  useFocusEffect(load);

  const tileSize = (width - Spacing.three * 2 - Spacing.two * (COLUMNS - 1)) / COLUMNS;
  const searching = query.trim() !== '';
  const visible =
    items &&
    sortItems(
      items.filter((item) => matchesShow(item, show) && (!searching || matchesSearch(item, query))),
      sort,
    );
  const filtered = searching || show !== 'all';
  const optionsSummary = [
    WardrobeSorts[sort],
    show === 'all' ? null : WardrobeShows[show].toLowerCase(),
  ]
    .filter(Boolean)
    .join(' · ');

  function markAllClean() {
    run(async () => {
      await clearWashStatus(db);
      load();
    });
  }

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
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: optionsOpen }}
        accessibilityLabel={`Sort and filter: ${optionsSummary}`}
        onPress={() => setOptionsOpen((open) => !open)}
        style={styles.optionsToggle}>
        <ThemedText type="small" style={{ color: theme.accent }}>
          {optionsOpen ? 'Hide sort and filter' : `Sort: ${optionsSummary}`}
        </ThemedText>
      </Pressable>
      {optionsOpen && (
        <View style={styles.options}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.optionsLabel}>
            Sort by
          </ThemedText>
          <ChipRow options={WardrobeSorts} selected={sort} onSelect={setSort} />
          <ThemedText type="caption" themeColor="textSecondary" style={styles.optionsLabel}>
            Show
          </ThemedText>
          <ChipRow options={WardrobeShows} selected={show} onSelect={setShow} />
        </View>
      )}
      {show === 'wash' && (visible?.length ?? 0) > 0 && (
        <View style={styles.search}>
          <Button label="Mark everything clean" onPress={markAllClean} busy={clearing} />
        </View>
      )}
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
                {filtered
                  ? 'Nothing matches'
                  : category
                    ? `No ${category.toLowerCase()} yet`
                    : 'Your wardrobe is empty'}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {filtered
                  ? 'Try another word, or change the filter.'
                  : 'Add an item from a photo, a barcode, a link, or by hand.'}
              </ThemedText>
              {!filtered && (
                <View style={styles.emptyAction}>
                  <Button
                    label={category ? `Add ${category.toLowerCase()}` : 'Add your first item'}
                    onPress={() => router.push('/add-item')}
                    variant="primary"
                    grow={false}
                  />
                </View>
              )}
            </View>
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
            <Pressable
              accessibilityLabel={[
                item.name,
                `worn ${item.wearCount} times`,
                costPerWearLabel(item),
                lastWornLabel(item),
                item.status && statusLabel(item.status, item.lentTo),
              ]
                .filter(Boolean)
                .join(', ')}
              style={({ pressed }) => [{ width: tileSize }, pressed && styles.pressed]}>
              <ItemPhoto
                photo={item.photo}
                name={item.name}
                style={[styles.tile, { width: tileSize, height: tileSize * 1.25 }]}
              />
              {item.status && <StatusBadge status={item.status} lentTo={item.lentTo} />}
              <ThemedText type="smallBold" numberOfLines={1}>
                Worn {item.wearCount}×
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {costPerWearLabel(item)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {lastWornLabel(item)}
              </ThemedText>
            </Pressable>
          </Link>
        )}
      />
    </ThemedView>
  );
}

// Unworn items cost their whole price per wear so far (matches the cost-per-wear sort).
function costPerWearLabel(item: ItemWithStats) {
  if (item.price === null) return 'No price';
  return `${formatPrice(item.price / Math.max(item.wearCount, 1))} per wear`;
}

function lastWornLabel(item: ItemWithStats) {
  return item.lastWorn ? `Last ${formatShortDay(item.lastWorn, today())}` : 'Never worn';
}

function ChipRow<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: Record<T, string>;
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}>
      {(Object.keys(options) as T[]).map((key) => (
        <Chip
          key={key}
          label={options[key]}
          selected={key === selected}
          onPress={() => onSelect(key)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  optionsToggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  options: {
    paddingTop: Spacing.one,
  },
  optionsLabel: {
    paddingHorizontal: Spacing.three,
  },
  chipRow: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
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
  emptyAction: {
    marginTop: Spacing.two,
  },
});
