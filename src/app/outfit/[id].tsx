import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { HeaderTextButton } from '@/components/add-button';
import { Button } from '@/components/button';
import { ItemPhoto } from '@/components/item-photo';
import { OutfitBoard } from '@/components/outfit-board';
import { Stat } from '@/components/stat';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { getBoard, type BoardPiece } from '@/lib/board';
import { formatRelativeDay } from '@/lib/dates';
import {
  deleteOutfit,
  getOutfit,
  listOutfitItems,
  logOutfitWear,
  today,
  undoOutfitWear,
  type ItemWithStats,
  type Outfit,
} from '@/lib/db';
import { warningFeedback } from '@/lib/haptics';

export default function OutfitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const outfitId = Number(id);
  const db = useSQLiteContext();
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [items, setItems] = useState<ItemWithStats[]>([]);
  const [board, setBoard] = useState<BoardPiece[] | null>(null);
  const { width } = useWindowDimensions();
  const [busy, run] = useBusy();

  const load = useCallback(() => {
    getOutfit(db, outfitId).then(setOutfit);
    listOutfitItems(db, outfitId).then(setItems);
    getBoard(db, outfitId).then(({ pieces, arranged }) => setBoard(arranged ? pieces : null));
  }, [db, outfitId]);

  useFocusEffect(load);

  if (!outfit) {
    return <ThemedView style={styles.container} />;
  }

  const current = outfit;
  const now = today();
  const woreToday = current.lastWorn === now;

  function toggleWear() {
    run(async () => {
      if (woreToday) await undoOutfitWear(db, current.id);
      else await logOutfitWear(db, current.id);
      load();
    });
  }

  function confirmDelete() {
    warningFeedback();
    Alert.alert(
      'Delete outfit?',
      `${current.name} will be removed. Its items stay in your wardrobe.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await deleteOutfit(db, current.id);
              router.back();
            }),
        },
      ],
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <HeaderTextButton
              href={{ pathname: '/new-outfit', params: { id: current.id } }}
              label="Edit"
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{current.name}</ThemedText>
        {board && <OutfitBoard pieces={board} size={width - Spacing.three * 2} />}

        <View style={styles.stats}>
          <Stat label="Times worn" value={String(current.wearCount)} />
          <Stat
            label="Last worn"
            value={current.lastWorn ? formatRelativeDay(current.lastWorn, now) : 'Never'}
          />
          <Stat label="Items" value={String(items.length)} />
        </View>

        <View style={styles.row}>
          <Button
            label={woreToday ? 'Worn today · Undo' : 'I wore this today'}
            onPress={toggleWear}
            busy={busy}
            disabled={items.length === 0}
            variant={woreToday ? 'secondary' : 'primary'}
          />
        </View>

        {items.length > 0 && (
          <View style={styles.row}>
            <Button
              label={board ? 'Rearrange board' : 'Arrange on a board'}
              onPress={() => router.push({ pathname: '/outfit-board', params: { id: current.id } })}
            />
          </View>
        )}

        {items.length > 0 && (
          <ThemedText type="caption" themeColor="textSecondary" style={styles.sectionTitle}>
            In this outfit
          </ThemedText>
        )}
        {items.map((item) => (
          <Link key={item.id} href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
            <Pressable
              accessibilityLabel={item.name}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <ItemPhoto photo={item.photo} name={item.name} style={styles.thumb} />
              <View style={styles.itemText}>
                <ThemedText numberOfLines={1}>{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.category} ·{' '}
                  {item.wearCount === 0 ? 'not worn yet' : `worn ${item.wearCount}×`}
                </ThemedText>
              </View>
            </Pressable>
          </Link>
        ))}

        <Button label="Delete outfit" onPress={confirmDelete} variant="danger" />
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
  sectionTitle: {
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
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
    borderRadius: Radius.small,
  },
  itemText: {
    flex: 1,
  },
});
