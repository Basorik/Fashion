import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteItem, getItem, logWear, today, undoLastWear, type ItemWithStats } from '@/lib/db';
import { deletePhoto, photoUri } from '@/lib/photos';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const db = useSQLiteContext();
  const theme = useTheme();
  const [item, setItem] = useState<ItemWithStats | null>(null);

  const load = useCallback(() => {
    getItem(db, itemId).then(setItem);
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
          deletePhoto(current.photo);
          router.back();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: current.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={{ uri: photoUri(current.photo) }} style={styles.photo} contentFit="cover" />

        <View>
          <ThemedText type="subtitle">{current.name}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {[current.category, current.color].filter(Boolean).join(' · ')}
          </ThemedText>
        </View>

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

        <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.deleteButton}>
          <ThemedText type="small" style={styles.deleteText}>
            Delete item
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
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
  stat: {
    flex: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.one,
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
