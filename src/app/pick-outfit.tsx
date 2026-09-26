import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { OutfitCollage } from '@/components/outfit-collage';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { planOutfit } from '@/lib/calendar';
import { formatDay } from '@/lib/dates';
import { listOutfits, logOutfitWear, type Outfit } from '@/lib/db';
import { addTripOutfit } from '@/lib/trips';

// Picks an outfit to log as worn (mode=log) or plan (mode=plan) on `date`,
// or to add to a packing list (mode=trip, `tripId`).
export default function PickOutfitScreen() {
  const { date, mode, tripId } = useLocalSearchParams<{
    date?: string;
    mode: 'log' | 'plan' | 'trip';
    tripId?: string;
  }>();
  const db = useSQLiteContext();
  const [outfits, setOutfits] = useState<Outfit[]>([]);

  useFocusEffect(
    useCallback(() => {
      listOutfits(db).then(setOutfits);
    }, [db])
  );

  async function pick(outfit: Outfit) {
    if (mode === 'trip') {
      await addTripOutfit(db, Number(tripId), outfit.id);
    } else if (mode === 'plan') {
      await planOutfit(db, outfit.id, date!);
    } else {
      await logOutfitWear(db, outfit.id, date!);
    }
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title:
            mode === 'trip'
              ? 'Add outfit to list'
              : `${mode === 'plan' ? 'Plan' : 'Log'} outfit · ${formatDay(date!)}`,
        }}
      />
      <FlatList
        data={outfits}
        keyExtractor={(outfit) => String(outfit.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Create an outfit on the Outfits tab first.
          </ThemedText>
        }
        renderItem={({ item: outfit }) => (
          <Pressable accessibilityRole="button" onPress={() => pick(outfit)} style={styles.row}>
            <OutfitCollage photos={outfit.photos} size={64} />
            <View style={styles.text}>
              <ThemedText>{outfit.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Worn {outfit.wearCount}× · last {outfit.lastWorn ?? 'never'}
              </ThemedText>
            </View>
          </Pressable>
        )}
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
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
});
