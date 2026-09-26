import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BarList } from '@/components/bar-list';
import { ItemPhoto } from '@/components/item-photo';
import { Stat } from '@/components/stat';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fromDateString } from '@/lib/dates';
import { getWardrobeStats, type WardrobeStats } from '@/lib/stats';

const money = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function StatsScreen() {
  const db = useSQLiteContext();
  const [stats, setStats] = useState<WardrobeStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      getWardrobeStats(db).then(setStats);
    }, [db])
  );

  if (!stats) return <ThemedView style={styles.container} />;

  if (stats.itemCount === 0) {
    return (
      <ThemedView style={[styles.container, styles.empty]}>
        <ThemedText type="subtitle">No stats yet</ThemedText>
        <ThemedText themeColor="textSecondary">Add items and log what you wear.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tiles}>
          <Stat label="Items" value={String(stats.itemCount)} />
          <Stat label="Outfits" value={String(stats.outfitCount)} />
          <Stat label="Days logged (30d)" value={String(stats.wearsLast30Days)} />
        </View>
        <View style={styles.tiles}>
          <Stat label="Wardrobe value" value={money(stats.totalValue)} />
          <Stat
            label="Avg cost per wear"
            value={stats.avgCostPerWear === null ? '—' : stats.avgCostPerWear.toFixed(2)}
          />
          <Stat label="Worn in last 90d" value={`${Math.round(stats.activeShare * 100)}%`} />
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
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </View>
  );
}

function ItemRow({ items, empty }: { items: WardrobeStats['mostWorn']; empty: string }) {
  if (items.length === 0) {
    return empty ? <ThemedText type="small" themeColor="textSecondary">{empty}</ThemedText> : null;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.items}>
      {items.map((item) => (
        <Link key={item.id} href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
          <Pressable accessibilityLabel={item.name} style={styles.item}>
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
  items: {
    gap: Spacing.two,
  },
  item: {
    width: 88,
  },
  itemPhoto: {
    width: 88,
    height: 110,
    borderRadius: 8,
    marginBottom: Spacing.one,
  },
});
