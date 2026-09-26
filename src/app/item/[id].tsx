import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ItemPhoto } from '@/components/item-photo';
import { Stat } from '@/components/stat';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Tag } from '@/constants/tags';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteItem,
  getItem,
  listItemTags,
  listWornWith,
  logWear,
  today,
  undoLastWear,
  type ItemWithStats,
} from '@/lib/db';
import { deletePhoto } from '@/lib/photos';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const db = useSQLiteContext();
  const theme = useTheme();
  const [item, setItem] = useState<ItemWithStats | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [wornWith, setWornWith] = useState<Awaited<ReturnType<typeof listWornWith>>>([]);

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
  const woreToday = current.lastWorn === today();
  const costPerWear =
    current.price !== null && current.wearCount > 0 ? current.price / current.wearCount : null;

  async function wear() {
    await logWear(db, current.id);
    load();
  }

  async function undo() {
    await undoLastWear(db, current.id);
    load();
  }

  function confirmDelete() {
    Alert.alert('Delete item?', `${current.name} and its wear history will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteItem(db, current.id);
          if (current.photo) deletePhoto(current.photo);
          router.back();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: current.name,
          headerRight: () => (
            <Link href={{ pathname: '/add-item', params: { id: current.id } }} asChild>
              <Pressable accessibilityRole="button" hitSlop={12}>
                <ThemedText>Edit</ThemedText>
              </Pressable>
            </Link>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ItemPhoto photo={current.photo} name={current.name} style={styles.photo} />

        <View>
          <ThemedText type="subtitle">{current.name}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {[current.category, current.brand].filter(Boolean).join(' · ')}
          </ThemedText>
        </View>

        {tags.length > 0 && (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <View
                key={`${tag.group}:${tag.value}`}
                style={[styles.tag, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small">{tag.value}</ThemedText>
              </View>
            ))}
          </View>
        )}

        <View style={styles.stats}>
          <Stat label="Times worn" value={String(current.wearCount)} />
          <Stat label="Last worn" value={current.lastWorn ?? 'Never'} />
          <Stat label="Cost per wear" value={costPerWear === null ? '—' : costPerWear.toFixed(2)} />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={woreToday ? undo : wear}
          style={[styles.button, { backgroundColor: woreToday ? theme.backgroundElement : theme.text }]}>
          <ThemedText type="smallBold" style={{ color: woreToday ? theme.text : theme.background }}>
            {woreToday ? 'Worn today · Undo' : 'I wore this today'}
          </ThemedText>
        </Pressable>

        {wornWith.length > 0 && (
          <>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
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
          </>
        )}

        <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.deleteButton}>
          <ThemedText type="small" style={styles.deleteText}>
            Delete item
          </ThemedText>
        </Pressable>
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
    gap: Spacing.three,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 12,
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
  tag: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  sectionTitle: {
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
    borderRadius: 8,
    marginBottom: Spacing.one,
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: Spacing.three,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  deleteText: {
    color: '#D93036',
  },
});
