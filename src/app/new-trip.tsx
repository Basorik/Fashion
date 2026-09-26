import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { MonthGrid } from '@/components/month-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDay, formatMonth } from '@/lib/dates';
import { today } from '@/lib/db';
import { addTrip } from '@/lib/trips';

export default function NewTripScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [cursor, setCursor] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  // First tap sets the start, second tap the end; a third tap starts over.
  function selectDay(day: string) {
    if (!start || end) {
      setStart(day);
      setEnd(null);
    } else if (day < start) {
      setEnd(start);
      setStart(day);
    } else {
      setEnd(day);
    }
  }

  function shiftMonth(delta: number) {
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  async function create() {
    const tripId = await addTrip(db, name.trim(), start, end ?? start);
    router.replace({ pathname: '/trip/[id]', params: { id: tripId } });
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Trip name, e.g. Lisbon weekend"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {start
            ? end
              ? `${formatDay(start)} – ${formatDay(end)}`
              : `${formatDay(start)} · tap the last day`
            : 'Dates (optional): tap the first day, then the last'}
        </ThemedText>
        <View style={styles.monthHeader}>
          <Pressable accessibilityLabel="Previous month" hitSlop={12} onPress={() => shiftMonth(-1)}>
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
          selected={end ?? start ?? ''}
          today={today()}
          marks={Object.fromEntries(
            [start, end].filter((day): day is string => !!day).map((day) => [day, { worn: false, planned: true }])
          )}
          onSelect={selectDay}
        />
        <View style={styles.row}>
          <Button label="Create packing list" onPress={create} disabled={!name.trim()} primary />
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
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  row: {
    flexDirection: 'row',
  },
});
