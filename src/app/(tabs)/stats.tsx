import { Link, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BarList } from '@/components/bar-list';
import { Button } from '@/components/button';
import { ItemPhoto } from '@/components/item-photo';
import { Stat } from '@/components/stat';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ColorSeasons } from '@/constants/color-seasons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getColorSeasonOverview, type ColorSeasonOverview } from '@/lib/color-seasons';
import { fromDateString } from '@/lib/dates';
import { formatPrice } from '@/lib/money';
import { getWardrobeStats, type WardrobeStats } from '@/lib/stats';

const money = (value: number) => formatPrice(Math.round(value));

export default function StatsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [stats, setStats] = useState<WardrobeStats | null>(null);
  const [seasons, setSeasons] = useState<ColorSeasonOverview | null>(null);

  useFocusEffect(
    useCallback(() => {
      getWardrobeStats(db).then(setStats);
      getColorSeasonOverview(db).then(setSeasons);
    }, [db]),
  );

  if (!stats) return <ThemedView style={styles.container} />;

  if (stats.itemCount === 0) {
    return (
      <ThemedView style={[styles.container, styles.empty]}>
        <ThemedText type="subtitle">No stats yet</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Add items and log what you wear to see what earns its place.
        </ThemedText>
        <View style={styles.emptyAction}>
          <Button
            label="Add an item"
            onPress={() => router.push('/add-item')}
            variant="primary"
            grow={false}
          />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tiles}>
          <Stat label="Items" value={String(stats.itemCount)} />
          <Stat label="Outfits" value={String(stats.outfitCount)} />
          <Stat label="Days logged, last 30" value={String(stats.wearsLast30Days)} />
        </View>
        <View style={styles.tiles}>
          <Stat label="Wardrobe value" value={money(stats.totalValue)} />
          <Stat
            label="Avg cost per wear"
            value={stats.avgCostPerWear === null ? '—' : formatPrice(stats.avgCostPerWear)}
          />
          <Stat label="Worn in last 90 days" value={`${Math.round(stats.activeShare * 100)}%`} />
        </View>

        <Section title="Most worn">
          <ItemRow items={stats.mostWorn} empty="Log some wears to see favorites." />
        </Section>

        <Section title="Least worn">
          <ItemRow items={stats.leastWorn} empty="" />
        </Section>

        <Section title="By category">
          <BarList rows={stats.byCategory.map(({ label, count }) => ({ label, value: count }))} />
        </Section>

        {stats.byColor.length > 0 && (
          <Section title="By color">
            <BarList rows={stats.byColor.map(({ label, count }) => ({ label, value: count }))} />
          </Section>
        )}

        <Section title="Color season">
          <Link href="/color-season" asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.seasonCard,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">
                {seasons?.mine
                  ? `You're a ${seasons.mine}: ${seasons.counts[seasons.mine]} item${
                      seasons.counts[seasons.mine] === 1 ? '' : 's'
                    } in your shades`
                  : 'Pick your color season'}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.accent }}>
                {seasons?.mine ? 'See them ›' : 'See which clothes suit your coloring ›'}
              </ThemedText>
            </Pressable>
          </Link>
          {seasons && ColorSeasons.some((season) => seasons.counts[season] > 0) && (
            <BarList
              rows={ColorSeasons.map((season) => ({
                label: season,
                value: seasons.counts[season],
              }))}
            />
          )}
        </Section>

        {stats.spendingByMonth.length > 0 && (
          <Section title="Spending by month added">
            <BarList
              rows={stats.spendingByMonth.map(({ label, amount }) => ({
                label: fromDateString(`${label}-01`).toLocaleDateString(undefined, {
                  month: 'short',
                  year: '2-digit',
                }),
                value: amount,
              }))}
              format={money}
            />
          </Section>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="caption" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function ItemRow({ items, empty }: { items: WardrobeStats['mostWorn']; empty: string }) {
  if (items.length === 0) {
    return empty ? (
      <ThemedText type="small" themeColor="textSecondary">
        {empty}
      </ThemedText>
    ) : null;
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.items}>
      {items.map((item) => (
        <Link key={item.id} href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
          <Pressable
            accessibilityLabel={item.name}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <ItemPhoto photo={item.photo} name={item.name} style={styles.itemPhoto} />
            <ThemedText type="small" numberOfLines={1}>
              {item.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.wearCount === 0 ? 'Never worn' : `${item.wearCount}×`}
            </ThemedText>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  center: {
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: Spacing.two,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: -Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  seasonCard: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  items: {
    gap: Spacing.two,
  },
  item: {
    width: 88,
  },
  itemPhoto: {
    width: 88,
    height: 110,
    borderRadius: Radius.medium,
    marginBottom: Spacing.one,
  },
});
