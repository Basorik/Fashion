import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { HeaderTextButton } from '@/components/add-button';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ItemPhoto } from '@/components/item-photo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Tag } from '@/constants/tags';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { warningFeedback } from '@/lib/haptics';
import { formatPrice } from '@/lib/money';
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
  const [busy, run] = useBusy();
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
        },
      );
    }, [db, wishId]),
  );

  if (!wish) return <ThemedView style={styles.container} />;
  const current = wish;

  function bought() {
    run(async () => {
      const itemId = await markWishBought(db, current, tags);
      router.replace({ pathname: '/item/[id]', params: { id: itemId } });
    }, 'Could not move to wardrobe');
  }

  function confirmDelete() {
    warningFeedback();
    Alert.alert('Remove from wishlist?', current.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await deleteWish(db, current.id);
            if (current.photo) deletePhoto(current.photo);
            router.back();
          }),
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <HeaderTextButton
              href={{ pathname: '/add-item', params: { wishId: current.id } }}
              label="Edit"
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ItemPhoto photo={current.photo} name={current.name} style={styles.photo} />
        <View style={styles.heading}>
          <ThemedText type="caption" themeColor="textSecondary">
            {[current.category, current.brand].filter(Boolean).join(' · ')}
          </ThemedText>
          <ThemedText type="title">{current.name}</ThemedText>
          {current.price !== null && (
            <ThemedText type="subtitle" themeColor="textSecondary">
              {formatPrice(current.price)}
            </ThemedText>
          )}
        </View>
        {tags.length > 0 && (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <Chip key={`${tag.group}:${tag.value}`} label={tag.value} />
            ))}
          </View>
        )}

        <View style={styles.row}>
          <Button label="I bought it" onPress={bought} busy={busy} variant="primary" />
          {current.url && (
            <Button label="Open link" onPress={() => WebBrowser.openBrowserAsync(current.url!)} />
          )}
        </View>

        <ThemedText type="caption" themeColor="textSecondary" style={styles.sectionTitle}>
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

        <Button label="Remove from wishlist" onPress={confirmDelete} variant="danger" />
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
    borderRadius: Radius.large,
  },
  heading: {
    gap: Spacing.one,
  },
  sectionTitle: {
    marginTop: Spacing.two,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
    borderRadius: Radius.medium,
    marginBottom: Spacing.one,
  },
});
