import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FooterBar } from '@/components/footer-bar';
import { ItemSelectGrid } from '@/components/item-select-grid';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { addOutfit, getOutfit, listOutfitItems, updateOutfit } from '@/lib/db';
import { successFeedback } from '@/lib/haptics';

// Creates an outfit, or edits one (`id`): its name and which items are in it.
export default function OutfitFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ? Number(params.id) : null;
  const db = useSQLiteContext();
  // Kept in tap order, which becomes the order items show in the outfit.
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(editingId === null);
  const [initial, setInitial] = useState<{ name: string; selected: number[] }>({
    name: '',
    selected: [],
  });
  const [saving, run] = useBusy();

  useEffect(() => {
    if (editingId === null) return;
    Promise.all([getOutfit(db, editingId), listOutfitItems(db, editingId)]).then(
      ([outfit, items]) => {
        const loadedName = outfit?.name ?? '';
        const loadedSelected = items.map((item) => item.id);
        setName(loadedName);
        setSelected(loadedSelected);
        setInitial({ name: loadedName, selected: loadedSelected });
        setLoaded(true);
      },
    );
  }, [db, editingId]);

  const canSave = loaded && selected.length >= 2 && name.trim() !== '';
  const leave = useDiscardGuard(
    loaded && (name !== initial.name || selected.join(',') !== initial.selected.join(',')),
  );

  function save() {
    if (!canSave) return;
    run(async () => {
      if (editingId === null) await addOutfit(db, name.trim(), selected);
      else await updateOutfit(db, editingId, name.trim(), selected);
      successFeedback();
      leave(() => router.back());
    }, 'Could not save outfit');
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: editingId === null ? 'New outfit' : 'Edit outfit' }} />
      <ItemSelectGrid
        selected={selected}
        onChange={setSelected}
        header={
          <View style={styles.header}>
            <TextField
              value={name}
              onChangeText={setName}
              placeholder="Outfit name, e.g. Friday office"
              autoCapitalize="sentences"
              returnKeyType="done"
            />
            <ThemedText type="small" themeColor="textSecondary">
              {selected.length < 2
                ? `Tap at least two items${selected.length === 1 ? ' (1 so far)' : ''}. The order you tap is the order they show in.`
                : `${selected.length} items selected${name.trim() === '' ? '. Give the outfit a name to save it.' : ''}`}
            </ThemedText>
          </View>
        }
      />
      <FooterBar>
        <Button
          label={editingId === null ? 'Save outfit' : 'Save changes'}
          onPress={save}
          busy={saving}
          disabled={!canSave}
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
  header: {
    gap: Spacing.two,
  },
});
