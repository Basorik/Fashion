import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ItemSelectGrid } from '@/components/item-select-grid';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addTripItems } from '@/lib/trips';

// Adds single items to a packing list.
export default function PickItemsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const db = useSQLiteContext();
  const theme = useTheme();
  const [selected, setSelected] = useState<number[]>([]);

  async function add() {
    await addTripItems(db, Number(tripId), selected);
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <ItemSelectGrid selected={selected} onChange={setSelected} />
      <View style={[styles.footer, { borderTopColor: theme.backgroundSelected }]}>
        <Button
          label={
            selected.length
              ? `Add ${selected.length} item${selected.length === 1 ? '' : 's'}`
              : 'Add items'
          }
          onPress={add}
          disabled={selected.length === 0}
          primary
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
