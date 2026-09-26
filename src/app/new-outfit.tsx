import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/button';
import { CategoryChips } from '@/components/category-chips';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Category } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addOutfit, listItems, type ItemWithStats } from '@/lib/db';
import { photoUri } from '@/lib/photos';

const COLUMNS = 3;

export default function NewOutfitScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<ItemWithStats[]>([]);
  const [category, setCategory] = useState<Category | undefined>();
  // Kept in tap order, which becomes the order items show in the outfit.
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listItems(db, category).then(setItems);
  }, [db, category]);

  function toggle(id: number) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

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

  const tileSize = (width - Spacing.three * 2 - Spacing.two * (COLUMNS - 1)) / COLUMNS;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Outfit name, e.g. Friday office"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {selected.length === 0
            ? 'Pick at least two items'
            : `${selected.length} item${selected.length === 1 ? '' : 's'} selected`}
        </ThemedText>
      </View>
      <View>
        <CategoryChips selected={category} onSelect={setCategory} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        numColumns={COLUMNS}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {category ? `No ${category.toLowerCase()} in your wardrobe` : 'Add items to your wardrobe first'}
          </ThemedText>
        }
        renderItem={({ item }) => {
          const order = selected.indexOf(item.id);
          const isSelected = order !== -1;
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={item.name}
              onPress={() => toggle(item.id)}
              style={{ width: tileSize }}>
              <Image
                source={{ uri: photoUri(item.photo) }}
                style={[
                  styles.tile,
                  {
                    width: tileSize,
                    height: tileSize * 1.25,
                    borderColor: isSelected ? theme.text : 'transparent',
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
                contentFit="cover"
              />
              {isSelected && (
                <View style={[styles.badge, { backgroundColor: theme.text }]}>
                  <ThemedText type="smallBold" style={{ color: theme.background }}>
                    {order + 1}
                  </ThemedText>
                </View>
              )}
              <ThemedText type="small" numberOfLines={1}>
                {item.name}
              </ThemedText>
            </Pressable>
          );
        }}
      />
      <View style={[styles.footer, { borderTopColor: theme.backgroundSelected }]}>
        <Button label={saving ? 'Saving…' : 'Save outfit'} onPress={save} disabled={!canSave} primary />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  grid: {
    padding: Spacing.three,
    gap: Spacing.three,
    flexGrow: 1,
  },
  gridRow: {
    gap: Spacing.two,
  },
  tile: {
    borderRadius: 8,
    borderWidth: 3,
    marginBottom: Spacing.one,
  },
  badge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
