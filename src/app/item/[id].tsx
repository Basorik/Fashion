import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { HeaderTextButton } from '@/components/add-button';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ItemPhoto } from '@/components/item-photo';
import { Stat } from '@/components/stat';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Tag } from '@/constants/tags';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { useTheme } from '@/hooks/use-theme';
import { formatDay, formatRelativeDay } from '@/lib/dates';
import {
  deleteItem,
  getItem,
  listItemTags,
  listWornWith,
  logWear,
  restoreItem,
  today,
  undoWear,
  type ItemWithStats,
} from '@/lib/db';
import { formatPrice } from '@/lib/money';
import { deletePhoto } from '@/lib/photos';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const db = useSQLiteContext();
  const theme = useTheme();
  const [item, setItem] = useState<ItemWithStats | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [wornWith, setWornWith] = useState<Awaited<ReturnType<typeof listWornWith>>>([]);
  const [busy, run] = useBusy();

  const load = useCallback(() => {
    getItem(db, itemId).then(setItem);
    listWornWith(db, itemId).then(setWornWith);
    listItemTags(db, itemId).then(setTags);
  }, [db, itemId]);

  useFocusEffect(load);

  if (!item) {
    return <ThemedView style={styles.container} />;
  }

  const current = item;
  const now = today();
  const woreToday = current.lastWorn === now;
  const costPerWear =
    current.price !== null && current.wearCount > 0 ? current.price / current.wearCount : null;

  function toggleWear() {
    run(async () => {
      if (woreToday) await undoWear(db, current.id);
      else await logWear(db, current.id);
      load();
    });
  }

  function restore() {
    run(async () => {
      await restoreItem(db, current.id);
      load();
    });
  }

  function confirmDelete() {
    Alert.alert('Delete for good?', `${current.name} and its wear history will be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await deleteItem(db, current.id);
            if (current.photo) deletePhoto(current.photo);
            router.back();
          }),
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <HeaderTextButton
              href={{ pathname: '/add-item', params: { id: current.id } }}
              label="Edit"
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ItemPhoto photo={current.photo} name={current.name} style={styles.photo} />

        <View style={styles.heading}>
          <ThemedText type="caption" themeColor="textSecondary">
            {[current.category, current.brand].filter(Boolean).join(' · ')}
          </ThemedText>
          <ThemedText type="title">{current.name}</ThemedText>
        </View>

        {current.removedOn && (
          <View style={[styles.removed, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">
              Removed {formatDay(current.removedOn)}
              {current.removedReason ? ` · ${current.removedReason}` : ''}
            </ThemedText>
            {current.removedNote && (
              <ThemedText type="small" themeColor="textSecondary">
                {current.removedNote}
              </ThemedText>
            )}
          </View>
        )}

        {tags.length > 0 && (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <Chip
                key={`${tag.group}:${tag.value}`}
                label={tag.group === 'Color season' ? `${tag.value} palette` : tag.value}
              />
            ))}
          </View>
        )}

        <View style={styles.stats}>
          <Stat label="Times worn" value={String(current.wearCount)} />
          <Stat
            label="Last worn"
            value={current.lastWorn ? formatRelativeDay(current.lastWorn, now) : 'Never'}
          />
          <Stat
            label={costPerWear === null ? 'Price' : 'Cost per wear'}
            value={
              costPerWear !== null
                ? formatPrice(costPerWear)
                : current.price !== null
                  ? formatPrice(current.price)
                  : '—'
            }
          />
        </View>

        <View style={styles.row}>
          {current.removedOn ? (
            <Button label="Put back in wardrobe" onPress={restore} busy={busy} />
          ) : (
            <Button
              label={woreToday ? 'Worn today · Undo' : 'I wore this today'}
              onPress={toggleWear}
              busy={busy}
              variant={woreToday ? 'secondary' : 'primary'}
            />
          )}
        </View>

        {wornWith.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="caption" themeColor="textSecondary">
              Most often worn with
            </ThemedText>
            <View style={styles.pairs}>
              {wornWith.map((other) => (
                <Link
                  key={other.id}
                  href={{ pathname: '/item/[id]', params: { id: other.id } }}
                  asChild>
                  <Pressable accessibilityLabel={other.name} style={styles.pair}>
                    <ItemPhoto photo={other.photo} name={other.name} style={styles.pairPhoto} />
                    <ThemedText type="small" numberOfLines={1}>
                      {other.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {other.times}× together
                    </ThemedText>
                  </Pressable>
                </Link>
              ))}
            </View>
          </View>
        )}

        {current.removedOn ? (
          <Button label="Delete for good" onPress={confirmDelete} variant="danger" />
        ) : (
          <Button
            label="Remove from wardrobe"
            onPress={() => router.push({ pathname: '/remove-item', params: { id: current.id } })}
            variant="danger"
          />
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: Radius.large,
  },
  heading: {
    gap: Spacing.one,
  },
  removed: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
  },
  section: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  pairs: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pair: {
    flex: 1,
    maxWidth: '33%',
  },
  pairPhoto: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: Radius.medium,
    marginBottom: Spacing.one,
  },
});
