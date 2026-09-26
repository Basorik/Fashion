import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ItemPhoto } from '@/components/item-photo';
import { statusLabel } from '@/constants/item-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { useTheme } from '@/hooks/use-theme';
import { formatDay } from '@/lib/dates';
import {
  deleteTrip,
  getTrip,
  listPackingItems,
  removeTripItem,
  setPacked,
  type PackingItem,
  type Trip,
} from '@/lib/trips';

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const db = useSQLiteContext();
  const theme = useTheme();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [, run] = useBusy();

  const load = useCallback(() => {
    getTrip(db, tripId).then(setTrip);
    listPackingItems(db, tripId).then(setItems);
  }, [db, tripId]);

  useFocusEffect(load);

  if (!trip) return <ThemedView style={styles.container} />;
  const current = trip;

  // Ticks straight away, and puts the list back as it was if saving fails.
  async function toggle(item: PackingItem) {
    setItems((list) =>
      list.map((entry) => (entry.id === item.id ? { ...entry, packed: !entry.packed } : entry)),
    );
    try {
      await setPacked(db, current.id, item.id, !item.packed);
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : String(error));
      load();
      return;
    }
    getTrip(db, tripId).then(setTrip);
  }

  function confirmRemove(item: PackingItem) {
    Alert.alert('Remove from list?', item.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await removeTripItem(db, current.id, item.id);
            load();
          }),
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert('Delete packing list?', current.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await deleteTrip(db, current.id);
            router.back();
          }),
      },
    ]);
  }

  const sections = Object.entries(
    items.reduce<Record<string, PackingItem[]>>((groups, item) => {
      (groups[item.category] ??= []).push(item);
      return groups;
    }, {}),
  ).map(([title, data]) => ({ title, data }));

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: '' }} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="title">{current.name}</ThemedText>
            <ThemedText themeColor="textSecondary">
              {[
                current.startOn &&
                  (current.endOn && current.endOn !== current.startOn
                    ? `${formatDay(current.startOn)} – ${formatDay(current.endOn)}`
                    : formatDay(current.startOn)),
                `${current.packedCount} of ${current.itemCount} packed`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
            <View style={styles.row}>
              <Button
                label="Add outfit"
                onPress={() =>
                  router.push({
                    pathname: '/pick-outfit',
                    params: { mode: 'trip', tripId: current.id },
                  })
                }
              />
              <Button
                label="Add items"
                onPress={() =>
                  router.push({ pathname: '/pick-items', params: { tripId: current.id } })
                }
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Add outfits or single items to build the list.
          </ThemedText>
        }
        renderSectionHeader={({ section }) => (
          <ThemedText
            type="caption"
            themeColor="textSecondary"
            style={[styles.sectionTitle, { backgroundColor: theme.background }]}>
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.packed }}
            accessibilityLabel={item.name}
            onPress={() => toggle(item)}
            onLongPress={() => confirmRemove(item)}
            accessibilityHint="Long-press to remove it from the list"
            accessibilityActions={[{ name: 'remove', label: 'Remove from list' }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'remove') confirmRemove(item);
            }}
            style={styles.item}>
            <View
              style={[
                styles.check,
                {
                  borderColor: item.packed ? theme.accent : theme.textSecondary,
                  backgroundColor: item.packed ? theme.accent : 'transparent',
                },
              ]}>
              {item.packed && (
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  ✓
                </ThemedText>
              )}
            </View>
            <ItemPhoto photo={item.photo} name={item.name} style={styles.thumb} />
            <View style={styles.flex}>
              <ThemedText
                style={item.packed && styles.packed}
                themeColor={item.packed ? 'textSecondary' : 'text'}>
                {item.name}
              </ThemedText>
              {item.status && !item.packed && (
                <ThemedText type="small" themeColor="danger">
                  {statusLabel(item.status, item.lentTo)}
                </ThemedText>
              )}
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            {items.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                Long-press an item to remove it.
              </ThemedText>
            )}
            <Button
              label="Delete packing list"
              onPress={confirmDelete}
              variant="danger"
              grow={false}
            />
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  sectionTitle: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 40,
    height: 50,
    borderRadius: Radius.small,
  },
  flex: {
    flex: 1,
  },
  packed: {
    textDecorationLine: 'line-through',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  footer: {
    marginTop: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
});
