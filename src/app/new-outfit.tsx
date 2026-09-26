import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { ItemSelectGrid } from '@/components/item-select-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addOutfit } from '@/lib/db';

export default function NewOutfitScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  // Kept in tap order, which becomes the order items show in the outfit.
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = selected.length >= 2 && name.trim() !== '' && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await addOutfit(db, name.trim(), selected);
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert('Could not save outfit', String(error));
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ItemSelectGrid
        selected={selected}
        onChange={setSelected}
        header={
          <View style={styles.header}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Outfit name, e.g. Friday office"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { backgroundColor: theme.backgroundElement, color: theme.text },
              ]}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {selected.length === 0
                ? 'Pick at least two items'
                : `${selected.length} item${selected.length === 1 ? '' : 's'} selected`}
            </ThemedText>
          </View>
        }
      />
      <View style={[styles.footer, { borderTopColor: theme.backgroundSelected }]}>
        <Button
          label={saving ? 'Saving…' : 'Save outfit'}
          onPress={save}
          disabled={!canSave}
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
  header: {
    gap: Spacing.two,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
