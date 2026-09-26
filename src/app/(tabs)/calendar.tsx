import { Link, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ItemPhoto } from '@/components/item-photo';
import { MonthGrid } from '@/components/month-grid';
import { TodaySuggestions } from '@/components/today-suggestions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getDayDetail,
  getDayMarks,
  removeOutfitWear,
  removePlan,
  type DayDetail,
  type DayMarks,
} from '@/lib/calendar';
import { formatDay, formatMonth, toDateString } from '@/lib/dates';
import { logOutfitWear, today as getToday } from '@/lib/db';

export default function CalendarScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const today = getToday();
  const [cursor, setCursor] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }));
  const [selected, setSelected] = useState(today);
  const [marks, setMarks] = useState<DayMarks>({});
  const [detail, setDetail] = useState<DayDetail | null>(null);

  const load = useCallback(() => {
    const from = toDateString(new Date(cursor.year, cursor.month, 1));
    const to = toDateString(new Date(cursor.year, cursor.month + 1, 0));
    getDayMarks(db, from, to).then(setMarks);
    getDayDetail(db, selected).then(setDetail);
  }, [db, cursor, selected]);

  useFocusEffect(load);

  function shiftMonth(delta: number) {
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  const isPastOrToday = selected <= today;
  const isFutureOrToday = selected >= today;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TodaySuggestions />

        <View style={styles.monthHeader}>
          <Pressable
            accessibilityLabel="Previous month"
            hitSlop={12}
            onPress={() => shiftMonth(-1)}>
            <ThemedText type="subtitle">‹</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">{formatMonth(cursor.year, cursor.month)}</ThemedText>
          <Pressable accessibilityLabel="Next month" hitSlop={12} onPress={() => shiftMonth(1)}>
            <ThemedText type="subtitle">›</ThemedText>
          </Pressable>
        </View>
        <MonthGrid
          year={cursor.year}
          month={cursor.month}
          selected={selected}
          today={today}
          marks={marks}
          onSelect={setSelected}
        />

        <ThemedText type="subtitle" style={styles.dayTitle}>
          {selected === today ? 'Today' : formatDay(selected)}
        </ThemedText>

        {detail?.plans.map((plan) => (
          <View
            key={plan.planId}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.cardText}>
              <ThemedText type="small" themeColor="textSecondary">
                Planned
              </ThemedText>
              <Link href={{ pathname: '/outfit/[id]', params: { id: plan.outfitId } }}>
                <ThemedText type="smallBold">{plan.name}</ThemedText>
              </Link>
            </View>
            {isPastOrToday && (
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  await logOutfitWear(db, plan.outfitId, selected);
                  await removePlan(db, plan.planId);
                  load();
                }}>
                <ThemedText type="smallBold">Wore it</ThemedText>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove plan ${plan.name}`}
              onPress={async () => {
                await removePlan(db, plan.planId);
                load();
              }}>
              <ThemedText type="small" themeColor="textSecondary">
                Remove
              </ThemedText>
            </Pressable>
          </View>
        ))}

        {detail?.outfits.map((outfit) => (
          <View
            key={outfit.wearId}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.cardText}>
              <ThemedText type="small" themeColor="textSecondary">
                Wore outfit
              </ThemedText>
              <Link href={{ pathname: '/outfit/[id]', params: { id: outfit.outfitId } }}>
                <ThemedText type="smallBold">{outfit.name}</ThemedText>
              </Link>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove wear of ${outfit.name}`}
              onPress={async () => {
                await removeOutfitWear(db, outfit.wearId);
                load();
              }}>
              <ThemedText type="small" themeColor="textSecondary">
                Remove
              </ThemedText>
            </Pressable>
          </View>
        ))}

        {detail && detail.items.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.items}>
            {detail.items.map((item) => (
              <Link
                key={item.id}
                href={{ pathname: '/item/[id]', params: { id: item.id } }}
                asChild>
                <Pressable accessibilityLabel={item.name} style={styles.item}>
                  <ItemPhoto photo={item.photo} name={item.name} style={styles.itemPhoto} />
                  <ThemedText type="small" numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        )}

        {detail && detail.items.length === 0 && detail.plans.length === 0 && (
          <ThemedText themeColor="textSecondary">Nothing logged or planned.</ThemedText>
        )}

        <View style={styles.actions}>
          {isPastOrToday && (
            <Button
              label="Log an outfit"
              onPress={() =>
                router.push({ pathname: '/pick-outfit', params: { date: selected, mode: 'log' } })
              }
            />
          )}
          {isFutureOrToday && (
            <Button
              label="Plan an outfit"
              onPress={() =>
                router.push({ pathname: '/pick-outfit', params: { date: selected, mode: 'plan' } })
              }
            />
          )}
        </View>
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
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  dayTitle: {
    marginTop: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 8,
    padding: Spacing.three,
  },
  cardText: {
    flex: 1,
  },
  items: {
    gap: Spacing.two,
  },
  item: {
    width: 80,
  },
  itemPhoto: {
    width: 80,
    height: 100,
    borderRadius: 8,
    marginBottom: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
