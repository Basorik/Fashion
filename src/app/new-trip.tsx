import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { FooterBar } from '@/components/footer-bar';
import { MonthGrid, MonthHeader } from '@/components/month-grid';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { formatDay, formatMonth } from '@/lib/dates';
import { today } from '@/lib/db';
import { addTrip } from '@/lib/trips';

export default function NewTripScreen() {
  const db = useSQLiteContext();
  const [creating, run] = useBusy();
  const [name, setName] = useState('');
  const [cursor, setCursor] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }));
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

  function create() {
    run(async () => {
      const tripId = await addTrip(db, name.trim(), start, end ?? start);
      router.replace({ pathname: '/trip/[id]', params: { id: tripId } });
    }, 'Could not create packing list');
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="Trip name, e.g. Lisbon weekend"
          autoCapitalize="words"
          returnKeyType="done"
        />
        <ThemedText type="small" themeColor="textSecondary">
          {start
            ? end
              ? `${formatDay(start)} – ${formatDay(end)}`
              : `${formatDay(start)} · tap the last day`
            : 'Dates (optional): tap the first day, then the last'}
        </ThemedText>
        <MonthHeader title={formatMonth(cursor.year, cursor.month)} onShift={shiftMonth} />
        <MonthGrid
          year={cursor.year}
          month={cursor.month}
          selected={end ?? start ?? ''}
          today={today()}
          marks={Object.fromEntries(
            [start, end]
              .filter((day): day is string => !!day)
              .map((day) => [day, { worn: false, planned: true }]),
          )}
          onSelect={selectDay}
        />
      </ScrollView>
      <FooterBar>
        <Button
          label="Create packing list"
          onPress={create}
          busy={creating}
          disabled={!name.trim()}
          variant="primary"
        />
      </FooterBar>
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
});
