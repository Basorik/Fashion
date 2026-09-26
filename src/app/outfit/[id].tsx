import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ItemPhoto } from '@/components/item-photo';
import { Stat } from '@/components/stat';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  deleteOutfit,
  getOutfit,
  listOutfitItems,
  logOutfitWear,
  today,
  undoLastOutfitWear,
  type ItemWithStats,
  type Outfit,
} from '@/lib/db';

export default function OutfitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const outfitId = Number(id);
  const db = useSQLiteContext();
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [items, setItems] = useState<ItemWithStats[]>([]);

  const load = useCallback(() => {
    getOutfit(db, outfitId).then(setOutfit);
    listOutfitItems(db, outfitId).then(setItems);
  }, [db, outfitId]);

  useFocusEffect(load);

  if (!outfit) {
    return <ThemedView style={styles.container} />;
  }

  const current = outfit;
  const woreToday = current.lastWorn === today();

  async function toggleWear() {
    if (woreToday) {
      await undoLastOutfitWear(db, current.id);
    } else {
      await logOutfitWear(db, current.id);
    }
    load();
  }

  function confirmDelete() {
    Alert.alert('Delete outfit?', `${current.name} will be removed. Its items stay in your wardrobe.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteOutfit(db, current.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: current.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.stats}>
          <Stat label="Times worn" value={String(current.wearCount)} />
          <Stat label="Last worn" value={current.lastWorn ?? 'Never'} />
          <Stat label="Items" value={String(items.length)} />
        </View>

        <View style={styles.row}>
          <Button
            label={woreToday ? 'Worn today · Undo' : 'I wore this today'}
            onPress={toggleWear}
            disabled={items.length === 0}
            primary={!woreToday}
          />
        </View>

        {items.map((item) => (
          <Link key={item.id} href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
            <Pressable accessibilityLabel={item.name} style={styles.item}>
              <ItemPhoto photo={item.photo} name={item.name} style={styles.thumb} />
              <View style={styles.itemText}>
                <ThemedText numberOfLines={1}>{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.category} · worn {item.wearCount}×
                </ThemedText>
              </View>
            </Pressable>
          </Link>
        ))}

        <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.deleteButton}>
          <ThemedText type="small" style={styles.deleteText}>
            Delete outfit
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
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  thumb: {
    width: 64,
    height: 80,
    borderRadius: 8,
  },
  itemText: {
    flex: 1,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  deleteText: {
    color: '#D93036',
  },
});
