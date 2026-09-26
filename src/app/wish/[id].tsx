import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ItemPhoto } from '@/components/item-photo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Tag } from '@/constants/tags';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deletePhoto } from '@/lib/photos';
import {
  deleteWish,
  getWish,
  goesWith,
  listOwnedWithTags,
  listWishTags,
  markWishBought,
  type OwnedItem,
  type Wish,
} from '@/lib/wishlist';

export default function WishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wishId = Number(id);
  const db = useSQLiteContext();
  const theme = useTheme();
  const [wish, setWish] = useState<Wish | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [matches, setMatches] = useState<OwnedItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getWish(db, wishId), listWishTags(db, wishId), listOwnedWithTags(db)]).then(
        ([loaded, loadedTags, owned]) => {
          setWish(loaded);
          setTags(loadedTags);
          if (loaded) {
            const candidate = { category: loaded.category, tags: loadedTags };
            setMatches(owned.filter((item) => goesWith(candidate, item)));
          }
        }
      );
    }, [db, wishId])
  );

  if (!wish) return <ThemedView style={styles.container} />;
  const current = wish;

  async function bought() {
    const itemId = await markWishBought(db, current, tags);
    router.replace({ pathname: '/item/[id]', params: { id: itemId } });
  }

  function confirmDelete() {
    Alert.alert('Remove from wishlist?', current.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteWish(db, current.id);
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
            <Link href={{ pathname: '/add-item', params: { wishId: current.id } }} asChild>
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
            {[current.category, current.brand, current.price === null ? null : current.price.toFixed(2)]
              .filter(Boolean)
              .join(' · ')}
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

        <View style={styles.row}>
          <Button label="I bought it" onPress={bought} primary />
          {current.url && <Button label="Open link" onPress={() => Linking.openURL(current.url!)} />}
        </View>

        <ThemedText type="smallBold">
          Goes with {matches.length} item{matches.length === 1 ? '' : 's'} you own
        </ThemedText>
        {tags.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Add color, style and season tags for a sharper match.
          </ThemedText>
        )}
        <View style={styles.grid}>
          {matches.map((item) => (
            <Link key={item.id} href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
              <Pressable accessibilityLabel={item.name} style={styles.match}>
                <ItemPhoto photo={item.photo} name={item.name} style={styles.matchPhoto} />
                <ThemedText type="small" numberOfLines={1}>
                  {item.name}
                </ThemedText>
              </Pressable>
            </Link>
          ))}
        </View>

        <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.delete}>
          <ThemedText type="small" style={styles.deleteText}>
            Remove from wishlist
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
    paddingBottom: Spacing.six,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 12,
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
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  match: {
    width: '31%',
  },
  matchPhoto: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 8,
    marginBottom: Spacing.one,
  },
  delete: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  deleteText: {
    color: '#D93036',
  },
});
