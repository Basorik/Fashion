import { Link, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ItemPhoto } from '@/components/item-photo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDay } from '@/lib/dates';
import { listRemovedItems, type ItemWithStats } from '@/lib/db';
import { formatPrice } from '@/lib/money';
import { listTrips, type Trip } from '@/lib/trips';
import { listWishesByFit, type WishWithMatches } from '@/lib/wishlist';

type Tab = 'wishlist' | 'trips' | 'removed';

export default function ListsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('wishlist');
  const [wishes, setWishes] = useState<WishWithMatches[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [removed, setRemoved] = useState<ItemWithStats[]>([]);

  useFocusEffect(
    useCallback(() => {
      listWishesByFit(db).then(setWishes);
      listTrips(db).then(setTrips);
      listRemovedItems(db).then(setRemoved);
    }, [db]),
  );

  const segments: { key: Tab; label: string }[] = [
    { key: 'wishlist', label: 'Wishlist' },
    { key: 'trips', label: 'Packing' },
    { key: 'removed', label: 'Removed' },
  ];

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.segments, { backgroundColor: theme.backgroundElement }]}>
        {segments.map((segment) => (
          <Pressable
            key={segment.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === segment.key }}
            onPress={() => setTab(segment.key)}
            style={[styles.segment, tab === segment.key && { backgroundColor: theme.background }]}>
            <ThemedText
              type="smallBold"
              themeColor={tab === segment.key ? 'text' : 'textSecondary'}>
              {segment.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {tab === 'removed' ? (
        <FlatList
          data={removed}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            removed.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {removalSummary(removed)}
              </ThemedText>
            ) : null
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Items you remove from your wardrobe show up here with the reason they went.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
              <Pressable
                accessibilityLabel={item.name}
                style={({ pressed }) => [styles.entry, pressed && styles.pressed]}>
                <ItemPhoto photo={item.photo} name={item.name} style={styles.thumb} />
                <View style={styles.flex}>
                  <ThemedText numberOfLines={1}>{item.name}</ThemedText>
                  <ThemedText type="smallBold">
                    {[item.removedReason, item.removedOn && formatDay(item.removedOn)]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                  {item.removedNote && (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                      {item.removedNote}
                    </ThemedText>
                  )}
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.wearCount === 0 ? 'Never worn' : `Worn ${item.wearCount}×`}
                    {item.price !== null
                      ? ` · ${
                          item.wearCount > 0
                            ? `${formatPrice(item.price / item.wearCount)} per wear`
                            : formatPrice(item.price)
                        }`
                      : ''}
                  </ThemedText>
                </View>
              </Pressable>
            </Link>
          )}
        />
      ) : tab === 'wishlist' ? (
        <FlatList
          data={wishes}
          keyExtractor={(wish) => String(wish.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            wishes.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Sorted by how many things you own each one would go with.
              </ThemedText>
            ) : null
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Save things you&apos;re thinking of buying to see which would go with the most of your
              wardrobe.
            </ThemedText>
          }
          ListFooterComponent={
            <View style={styles.row}>
              <Button
                label="Add to wishlist"
                onPress={() => router.push({ pathname: '/add-item', params: { list: 'wish' } })}
                variant={wishes.length === 0 ? 'primary' : 'secondary'}
              />
            </View>
          }
          renderItem={({ item: wish }) => (
            <Link href={{ pathname: '/wish/[id]', params: { id: wish.id } }} asChild>
              <Pressable
                accessibilityLabel={wish.name}
                style={({ pressed }) => [styles.entry, pressed && styles.pressed]}>
                <ItemPhoto photo={wish.photo} name={wish.name} style={styles.thumb} />
                <View style={styles.flex}>
                  <ThemedText numberOfLines={1}>{wish.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[
                      wish.category,
                      wish.brand,
                      wish.price === null ? null : formatPrice(wish.price),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: theme.accent }}>
                    Goes with {wish.matches} item{wish.matches === 1 ? '' : 's'} you own
                  </ThemedText>
                </View>
              </Pressable>
            </Link>
          )}
        />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(trip) => String(trip.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Make a packing list for your next trip from your outfits and items.
            </ThemedText>
          }
          ListFooterComponent={
            <View style={styles.row}>
              <Button
                label="New packing list"
                onPress={() => router.push('/new-trip')}
                variant={trips.length === 0 ? 'primary' : 'secondary'}
              />
            </View>
          }
          renderItem={({ item: trip }) => (
            <Link href={{ pathname: '/trip/[id]', params: { id: trip.id } }} asChild>
              <Pressable
                accessibilityLabel={trip.name}
                style={({ pressed }) => [
                  styles.tripCard,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="subtitle">{trip.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[
                    trip.startOn &&
                      (trip.endOn && trip.endOn !== trip.startOn
                        ? `${formatDay(trip.startOn)} – ${formatDay(trip.endOn)}`
                        : formatDay(trip.startOn)),
                    `${trip.packedCount} of ${trip.itemCount} packed`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </Pressable>
            </Link>
          )}
        />
      )}
    </ThemedView>
  );
}

// e.g. "5 items removed: 3 donated, 2 sold".
function removalSummary(items: ItemWithStats[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const reason = item.removedReason ?? 'Other';
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const reasons = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `${count} ${reason.toLowerCase()}`)
    .join(', ');
  return `${items.length} item${items.length === 1 ? '' : 's'} removed: ${reasons}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segments: {
    flexDirection: 'row',
    margin: Spacing.three,
    marginBottom: 0,
    borderRadius: Radius.medium,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.small + 2,
  },
  pressed: {
    opacity: 0.7,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
  },
  flex: {
    flex: 1,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  thumb: {
    width: 64,
    height: 80,
    borderRadius: Radius.small,
  },
  tripCard: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
