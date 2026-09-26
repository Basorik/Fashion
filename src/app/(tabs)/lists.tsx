import { Link, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ItemPhoto } from '@/components/item-photo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDay } from '@/lib/dates';
import { listTrips, type Trip } from '@/lib/trips';
import { listWishesByFit, type WishWithMatches } from '@/lib/wishlist';

type Tab = 'wishlist' | 'trips';

export default function ListsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('wishlist');
  const [wishes, setWishes] = useState<WishWithMatches[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);

  useFocusEffect(
    useCallback(() => {
      listWishesByFit(db).then(setWishes);
      listTrips(db).then(setTrips);
    }, [db]),
  );

  const segments: { key: Tab; label: string }[] = [
    { key: 'wishlist', label: 'Wishlist' },
    { key: 'trips', label: 'Packing lists' },
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
            <ThemedText type="smallBold">{segment.label}</ThemedText>
          </Pressable>
        ))}
      </View>

      {tab === 'wishlist' ? (
        <FlatList
          data={wishes}
          keyExtractor={(wish) => String(wish.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.headerRow}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                Sorted by how many things you own each one would go with.
              </ThemedText>
            </View>
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
              />
            </View>
          }
          renderItem={({ item: wish }) => (
            <Link href={{ pathname: '/wish/[id]', params: { id: wish.id } }} asChild>
              <Pressable accessibilityLabel={wish.name} style={styles.entry}>
                <ItemPhoto photo={wish.photo} name={wish.name} style={styles.thumb} />
                <View style={styles.flex}>
                  <ThemedText numberOfLines={1}>{wish.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[wish.category, wish.brand, wish.price === null ? null : wish.price.toFixed(2)]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                  <ThemedText type="smallBold">
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
              <Button label="New packing list" onPress={() => router.push('/new-trip')} />
            </View>
          }
          renderItem={({ item: trip }) => (
            <Link href={{ pathname: '/trip/[id]', params: { id: trip.id } }} asChild>
              <Pressable
                accessibilityLabel={trip.name}
                style={[styles.tripCard, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">{trip.name}</ThemedText>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segments: {
    flexDirection: 'row',
    margin: Spacing.three,
    marginBottom: 0,
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
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
    borderRadius: 8,
  },
  tripCard: {
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
