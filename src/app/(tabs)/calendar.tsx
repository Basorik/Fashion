import { Link, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ItemPhoto } from '@/components/item-photo';
import { MonthGrid, MonthHeader } from '@/components/month-grid';
import { TodaySuggestions } from '@/components/today-suggestions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
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
  const [, run] = useBusy();

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

  const now = new Date();
  const showingToday =
    selected === today && cursor.year === now.getFullYear() && cursor.month === now.getMonth();

  function goToToday() {
    setSelected(today);
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  }

  const isPastOrToday = selected <= today;
  const isFutureOrToday = selected >= today;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TodaySuggestions />

        <MonthHeader title={formatMonth(cursor.year, cursor.month)} onShift={shiftMonth} />
        <MonthGrid
          year={cursor.year}
          month={cursor.month}
          selected={selected}
          today={today}
          marks={marks}
          onSelect={setSelected}
        />

        <View style={styles.dayTitle}>
          <ThemedText type="subtitle" style={styles.flex}>
            {selected === today ? 'Today' : formatDay(selected)}
          </ThemedText>
          {!showingToday && (
            <Button label="Back to today" onPress={goToToday} variant="plain" grow={false} />
          )}
        </View>

        {detail?.plans.map((plan) => (
          <View
            key={plan.planId}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.cardText}>
              <ThemedText type="caption" themeColor="textSecondary">
                Planned
              </ThemedText>
              <Link href={{ pathname: '/outfit/[id]', params: { id: plan.outfitId } }}>
                <ThemedText type="smallBold">{plan.name}</ThemedText>
              </Link>
            </View>
            {isPastOrToday && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Wore ${plan.name}`}
                style={styles.cardAction}
                onPress={() =>
                  run(async () => {
                    await logOutfitWear(db, plan.outfitId, selected);
                    await removePlan(db, plan.planId);
                    load();
                  })
                }>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  Wore it
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove plan ${plan.name}`}
              style={styles.cardAction}
              onPress={() =>
                run(async () => {
                  await removePlan(db, plan.planId);
                  load();
                })
              }>
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
              <ThemedText type="caption" themeColor="textSecondary">
                Wore outfit
              </ThemedText>
              <Link href={{ pathname: '/outfit/[id]', params: { id: outfit.outfitId } }}>
                <ThemedText type="smallBold">{outfit.name}</ThemedText>
              </Link>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove wear of ${outfit.name}`}
              style={styles.cardAction}
              onPress={() =>
                Alert.alert(
                  'Remove this wear?',
                  `${outfit.name} and its items will count one less wear.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () =>
                        run(async () => {
                          await removeOutfitWear(db, outfit.wearId);
                          load();
                        }),
                    },
                  ],
                )
              }>
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
                <Pressable
                  accessibilityLabel={item.name}
                  style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
                  <ItemPhoto photo={item.photo} name={item.name} style={styles.itemPhoto} />
                  <ThemedText type="small" numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        )}

        {detail &&
          detail.items.length === 0 &&
          detail.plans.length === 0 &&
          detail.outfits.length === 0 && (
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
  dayTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.two,
    marginRight: -Spacing.three,
  },
  flex: {
    flex: 1,
  },
  cardAction: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  cardText: {
    flex: 1,
    paddingVertical: Spacing.two,
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
    borderRadius: Radius.small,
    marginBottom: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
