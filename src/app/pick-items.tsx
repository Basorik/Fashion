import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { FooterBar } from '@/components/footer-bar';
import { ItemSelectGrid } from '@/components/item-select-grid';
import { ThemedView } from '@/components/themed-view';
import { useBusy } from '@/hooks/use-busy';
import { addTripItems } from '@/lib/trips';

// Adds single items to a packing list.
export default function PickItemsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const db = useSQLiteContext();
  const [selected, setSelected] = useState<number[]>([]);
  const [adding, run] = useBusy();

  function add() {
    run(async () => {
      await addTripItems(db, Number(tripId), selected);
      router.back();
    }, 'Could not add items');
  }

  return (
    <ThemedView style={styles.container}>
      <ItemSelectGrid selected={selected} onChange={setSelected} />
      <FooterBar>
        <Button
          label={
            selected.length
              ? `Add ${selected.length} item${selected.length === 1 ? '' : 's'}`
              : 'Add items'
          }
          onPress={add}
          busy={adding}
          disabled={selected.length === 0}
          variant="primary"
        />
      </FooterBar>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
